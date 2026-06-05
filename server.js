// ── Upload server — ApuntesArgentina
// Maneja las operaciones con el bucket R2 de Cloudflare.
// Corre en localhost:3002 separado del servidor de Vite.
// Uso: node server.js  (o npm run server)

import 'dotenv/config'
import express from 'express'
import multer from 'multer'
import cors from 'cors'
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { compress as compressPdf } from 'compress-pdf'
import sharp from 'sharp'
import JSZip from 'jszip'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomBytes } from 'crypto'

const PORT   = process.env.UPLOAD_PORT || 3002
const BUCKET = process.env.CF_R2_BUCKET_NAME

// ── S3 client (Cloudflare R2) ──────────────────────────────────────────────
const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.CF_R2_ENDPOINT,
  credentials: {
    accessKeyId:     process.env.CF_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY,
  },
})

// ── Express setup ──────────────────────────────────────────────────────────
const app = express()

app.use(cors({
  origin: (origin, cb) => cb(null, true), // permite cualquier localhost en desarrollo
}))

app.use(express.json())

// Multer: memory storage, 50 MB max, solo tipos permitidos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = [
      'application/pdf',
      'image/png', 'image/jpeg', 'image/jpg',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ]
    if (ok.includes(file.mimetype)) cb(null, true)
    else cb(new Error(`Tipo no permitido: ${file.mimetype}`))
  },
})

// ── Helpers ────────────────────────────────────────────────────────────────

/** Lista todos los objetos del bucket y construye el árbol uni/carrera/materia */
async function buildTree() {
  const all = []
  let token

  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      ContinuationToken: token,
    }))
    all.push(...(res.Contents ?? []))
    token = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (token)

  const tree = { universities: [], careers: {}, subjects: {} }

  for (const obj of all) {
    const parts = obj.Key.split('/')
    if (parts.length < 3 || obj.Key === 'index.json') continue

    const [uni, career, subject] = parts

    if (!tree.universities.includes(uni))              tree.universities.push(uni)
    if (!tree.careers[uni])                            tree.careers[uni] = []
    if (!tree.careers[uni].includes(career))           tree.careers[uni].push(career)
    if (!tree.subjects[uni])                           tree.subjects[uni] = {}
    if (!tree.subjects[uni][career])                   tree.subjects[uni][career] = []
    if (!tree.subjects[uni][career].includes(subject)) tree.subjects[uni][career].push(subject)
  }

  return tree
}

/** Escribe el index.json en la raíz del bucket */
async function updateIndex() {
  try {
    const tree = await buildTree()
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: 'index.json',
      Body: JSON.stringify(tree, null, 2),
      ContentType: 'application/json',
    }))
  } catch (err) {
    console.error('[index] Error actualizando index.json:', err.message)
  }
}

function log(method, path, extra = '') {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${method} ${path} ${extra}`)
}

function kb(bytes) { return (bytes / 1024).toFixed(1) + ' KB' }

// ── Compresión de archivos antes de subir al bucket ────────────────────────

/**
 * Comprime un buffer según su mimetype.
 * Siempre devuelve el más pequeño entre el original y el resultado.
 * @returns {{ buffer: Buffer, mimetype: string, ext: string }}
 */
async function compressFile(buffer, mimetype, originalname) {
  const orig = buffer.length

  try {
    // ── PDF → Ghostscript nivel "ebook" (150 dpi, suficiente para leer en pantalla) ──
    if (mimetype === 'application/pdf') {
      const tmpIn  = join(tmpdir(), `aa_in_${randomBytes(6).toString('hex')}.pdf`)
      try {
        await writeFile(tmpIn, buffer)
        const compressed = await compressPdf(tmpIn, { resolution: 'ebook' })
        if (compressed.length < orig) {
          log('COMPRESS', 'PDF', `${kb(orig)} → ${kb(compressed.length)} (${Math.round((1 - compressed.length / orig) * 100)}% less)`)
          return { buffer: compressed, mimetype, ext: '.pdf' }
        }
      } finally {
        await unlink(tmpIn).catch(() => {})
      }
      return { buffer, mimetype, ext: '.pdf' }
    }

    // ── Imágenes → WebP calidad 82, máx 1920px ──────────────────────────────
    if (['image/png', 'image/jpeg', 'image/jpg'].includes(mimetype)) {
      const compressed = await sharp(buffer)
        .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer()
      if (compressed.length < orig) {
        log('COMPRESS', 'IMG→WebP', `${kb(orig)} → ${kb(compressed.length)} (${Math.round((1 - compressed.length / orig) * 100)}% less)`)
        return { buffer: compressed, mimetype: 'image/webp', ext: '.webp' }
      }
      return { buffer, mimetype, ext: originalname.endsWith('.png') ? '.png' : '.jpg' }
    }

    // ── DOCX / PPTX / XLSX → recomprimir ZIP con nivel máximo ───────────────
    const officeTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword',
      'application/vnd.ms-powerpoint',
    ]
    if (officeTypes.includes(mimetype)) {
      const zip = await JSZip.loadAsync(buffer)

      // Recomprimir imágenes embebidas con sharp
      const tasks = []
      zip.forEach((path, file) => {
        if (file.dir) return
        if (/\.(png|jpe?g)$/i.test(path)) {
          tasks.push(
            file.async('nodebuffer').then(async imgBuf => {
              try {
                const out = await sharp(imgBuf)
                  .resize({ width: 1920, withoutEnlargement: true })
                  .jpeg({ quality: 82, mozjpeg: true })
                  .toBuffer()
                if (out.length < imgBuf.length) zip.file(path, out)
              } catch { /* imagen corrupta o formato raro — se deja tal cual */ }
            })
          )
        }
      })
      await Promise.all(tasks)

      // Regenerar el ZIP con compresión máxima
      const compressed = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 },
      })

      const ext = originalname.match(/\.\w+$/)?.[0] ?? ''
      if (compressed.length < orig) {
        log('COMPRESS', `OFFICE${ext}`, `${kb(orig)} → ${kb(compressed.length)} (${Math.round((1 - compressed.length / orig) * 100)}% less)`)
        return { buffer: compressed, mimetype, ext }
      }
      return { buffer, mimetype, ext }
    }

  } catch (err) {
    log('COMPRESS', 'ERROR', err.message)
  }

  // Fallback: devolver original sin modificar
  const ext = originalname.match(/\.\w+$/)?.[0] ?? ''
  return { buffer, mimetype, ext }
}

// ── Rutas ──────────────────────────────────────────────────────────────────

/** Árbol completo de universidades / carreras / materias */
app.get('/api/tree', async (req, res) => {
  log('GET', '/api/tree')
  try {
    res.json(await buildTree())
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

/** Archivos en una ruta específica */
app.get('/api/files', async (req, res) => {
  const { university, career, subject } = req.query
  log('GET', '/api/files', `${university}/${career}/${subject}`)

  if (!university || !career || !subject)
    return res.status(400).json({ error: 'Faltan parámetros: university, career, subject' })

  try {
    const prefix = `${university}/${career}/${subject}/`
    const res2 = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix }))

    const files = (res2.Contents ?? [])
      .filter(o => !o.Key.endsWith('/') && o.Key !== prefix)
      .map(o => ({
        key:          o.Key,
        name:         o.Key.split('/').pop(),
        size:         o.Size,
        lastModified: o.LastModified,
      }))

    res.json(files)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

/** Subir un archivo */
app.post('/api/upload', upload.single('file'), async (req, res) => {
  const { university, career, subject, uploaderId } = req.body
  log('POST', '/api/upload', `${university}/${career}/${subject} — ${req.file?.originalname}`)

  if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' })
  if (!university || !career || !subject)
    return res.status(400).json({ error: 'Faltan parámetros: university, career, subject' })

  // ── Comprimir antes de subir ──────────────────────────────────────────────
  const { buffer: finalBuffer, mimetype: finalMime, ext } =
    await compressFile(req.file.buffer, req.file.mimetype, req.file.originalname)

  // Nombre limpio — preserva caracteres españoles; ajusta extensión si cambió formato
  const baseName = req.file.originalname
    .normalize('NFC')
    .replace(/\.\w+$/, '')                           // quitar extensión original
    .replace(/[^\w.\- áéíóúÁÉÍÓÚñÑüÜ]/g, '_')
  const clean = baseName + ext

  const key = `${university}/${career}/${subject}/${clean}`

  try {
    await s3.send(new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         key,
      Body:        finalBuffer,
      ContentType: finalMime,
      Metadata: {
        'uploaded-at':    new Date().toISOString(),
        'university':     university,
        'career':         career,
        'subject':        subject,
        'uploader-id':    uploaderId ?? '',
        'original-size':  String(req.file.size),
        'stored-size':    String(finalBuffer.length),
        'compression':    req.file.size > finalBuffer.length ? 'yes' : 'no',
      },
    }))

    // Registra quién subió este archivo + actualiza índice (background)
    recordUpload(key, uploaderId ?? '')
    updateIndex()

    res.json({
      success: true,
      key,
      name:          clean,
      size:          finalBuffer.length,
      originalSize:  req.file.size,
      savedBytes:    Math.max(0, req.file.size - finalBuffer.length),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

/** Eliminar un archivo */
app.delete('/api/files', async (req, res) => {
  const { key } = req.body
  log('DELETE', '/api/files', key)

  if (!key) return res.status(400).json({ error: 'Falta el parámetro key' })

  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
    updateIndex()
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

/** Previsualizar un archivo — sirve inline para que el browser lo renderice */
app.get('/api/preview', async (req, res) => {
  const { key } = req.query
  log('GET', '/api/preview', key)
  if (!key) return res.status(400).json({ error: 'Falta el parámetro key' })

  try {
    const result = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
    const filename = key.split('/').pop()
    res.setHeader('Content-Type', result.ContentType ?? 'application/octet-stream')
    // inline = el browser lo muestra, no lo descarga
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(filename)}`)
    if (result.ContentLength) res.setHeader('Content-Length', result.ContentLength)
    // CORS para iframe cross-origin en desarrollo
    res.setHeader('X-Frame-Options', 'SAMEORIGIN')
    result.Body.pipe(res)
  } catch (err) {
    console.error(err)
    res.status(404).json({ error: 'Archivo no encontrado' })
  }
})

/** Descargar un archivo — proxy seguro, no expone credenciales al cliente */
app.get('/api/download', async (req, res) => {
  const { key } = req.query
  log('GET', '/api/download', key)
  if (!key) return res.status(400).json({ error: 'Falta el parámetro key' })

  try {
    const result = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
    const filename = key.split('/').pop()
    res.setHeader('Content-Type', result.ContentType ?? 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
    if (result.ContentLength) res.setHeader('Content-Length', result.ContentLength)
    result.Body.pipe(res)
  } catch (err) {
    console.error(err)
    res.status(404).json({ error: 'Archivo no encontrado' })
  }
})

// ── Uploads registry (quién subió qué) ───────────────────────────────────
const UPLOADS_KEY = '_meta/uploads.json'

async function readUploads() {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: UPLOADS_KEY }))
    const chunks = []; for await (const c of res.Body) chunks.push(c)
    return JSON.parse(Buffer.concat(chunks).toString())
  } catch { return {} }
}

async function recordUpload(key, uploaderId) {
  try {
    const data = await readUploads()
    data[key] = { uploaderId, uploadedAt: new Date().toISOString() }
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET, Key: UPLOADS_KEY,
      Body: JSON.stringify(data, null, 2),
      ContentType: 'application/json',
    }))
  } catch (err) { console.error('[uploads] Error recording upload:', err.message) }
}

/** GET /api/uploads — devuelve el mapa key→{uploaderId, uploadedAt} */
app.get('/api/uploads', async (_req, res) => {
  try { res.json(await readUploads()) }
  catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Ratings ───────────────────────────────────────────────────────────────
const RATINGS_KEY = '_meta/ratings.json'

async function readRatings() {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: RATINGS_KEY }))
    const chunks = []
    for await (const chunk of res.Body) chunks.push(chunk)
    return JSON.parse(Buffer.concat(chunks).toString())
  } catch { return {} }
}

async function writeRatings(data) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET, Key: RATINGS_KEY,
    Body: JSON.stringify(data, null, 2),
    ContentType: 'application/json',
  }))
}

/** GET /api/ratings — devuelve todos los ratings */
app.get('/api/ratings', async (_req, res) => {
  log('GET', '/api/ratings')
  try { res.json(await readRatings()) }
  catch (err) { res.status(500).json({ error: err.message }) }
})

/** POST /api/ratings — body: { key, stars (1-5) } */
app.post('/api/ratings', async (req, res) => {
  const { key, stars } = req.body
  log('POST', '/api/ratings', `${key} → ${stars}★`)
  if (!key || !stars || stars < 1 || stars > 5)
    return res.status(400).json({ error: 'key y stars (1-5) requeridos' })

  try {
    const data = await readRatings()
    const entry = data[key] ?? { total: 0, count: 0 }
    entry.total += Number(stars)
    entry.count += 1
    entry.avg = parseFloat((entry.total / entry.count).toFixed(1))
    data[key] = entry
    await writeRatings(data)
    res.json(entry)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/** Health check */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', bucket: BUCKET, endpoint: process.env.CF_R2_ENDPOINT })
})

// ── Start ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🗄  Upload server → http://localhost:${PORT}`)
  console.log(`   Bucket: ${BUCKET}`)
  console.log(`   Endpoint: ${process.env.CF_R2_ENDPOINT}\n`)
})
