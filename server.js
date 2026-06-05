// ── ApuntesArgentina — Upload & API server ────────────────────────────────
// Corre separado del frontend. En producción: Railway / Render / Fly.io
// En desarrollo: node server.js  |  npm run server
//
// VARIABLES DE ENTORNO REQUERIDAS (ver .env.example):
//   CF_R2_BUCKET_NAME, CF_R2_ACCESS_KEY_ID, CF_R2_SECRET_ACCESS_KEY,
//   CF_R2_ENDPOINT, ALLOWED_ORIGINS, UPLOAD_PORT

import 'dotenv/config'
import express        from 'express'
import multer         from 'multer'
import cors           from 'cors'
import helmet         from 'helmet'
import rateLimit      from 'express-rate-limit'
import {
  S3Client, PutObjectCommand, ListObjectsV2Command,
  DeleteObjectCommand, GetObjectCommand,
} from '@aws-sdk/client-s3'
import { compress as compressPdf } from 'compress-pdf'
import sharp   from 'sharp'
import JSZip   from 'jszip'
import { writeFile, unlink } from 'fs/promises'
import { join }       from 'path'
import { tmpdir }     from 'os'
import { randomBytes } from 'crypto'

const PORT   = parseInt(process.env.UPLOAD_PORT ?? '3002', 10)
const BUCKET = process.env.CF_R2_BUCKET_NAME

// ── Input sanitization ────────────────────────────────────────────────────
// Previene path traversal, null bytes y caracteres peligrosos
function sanitizePath(str) {
  if (typeof str !== 'string') return ''
  return str
    .replace(/\0/g, '')           // null bytes
    .replace(/\.\./g, '')         // path traversal
    .replace(/[/\\]/g, '')        // slashes
    .replace(/[<>:"|?*]/g, '')    // shell/windows dangerous chars
    .trim()
    .slice(0, 200)                // max length
}

function sanitizeKey(key) {
  if (typeof key !== 'string') return ''
  // Bloquea acceso a archivos internos del bucket
  if (key.startsWith('_meta/') || key.startsWith('index.json')) return ''
  // Solo permite paths del formato uni/carrera/materia/archivo
  const parts = key.split('/')
  if (parts.length < 4 || parts.length > 6) return ''
  return parts.map(sanitizePath).filter(Boolean).join('/')
}

// ── S3 client ─────────────────────────────────────────────────────────────
const s3 = new S3Client({
  region: process.env.CF_R2_REGION ?? 'auto',
  endpoint: process.env.CF_R2_ENDPOINT,
  credentials: {
    accessKeyId:     process.env.CF_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY,
  },
})

// ── Express ───────────────────────────────────────────────────────────────
const app = express()

// Trust proxy (necesario en Vercel, Railway, Render para rate limit correcto)
app.set('trust proxy', 1)

// Security headers (sin CSP agresivo para no romper el iframe de preview)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}))

// CORS — solo orígenes permitidos
const ALLOWED = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176')
  .split(',').map(s => s.trim()).filter(Boolean)

app.use(cors({
  origin: (origin, cb) => {
    // Permite requests sin Origin (curl, apps nativas) solo en dev
    if (!origin && process.env.NODE_ENV !== 'production') return cb(null, true)
    if (ALLOWED.includes(origin)) return cb(null, true)
    cb(new Error(`CORS: origin no permitido — ${origin}`))
  },
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type'],
}))

app.use(express.json({ limit: '1mb' }))

// ── Rate limiting ─────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 min
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intentá de nuevo en 15 minutos.' },
})

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hora
  max: 20,                    // 20 uploads por IP por hora
  message: { error: 'Límite de subidas alcanzado. Intentá de nuevo en 1 hora.' },
})

const downloadLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 min
  max: 60,                    // 60 descargas por minuto
  message: { error: 'Demasiadas descargas. Esperá un momento.' },
})

app.use(globalLimiter)

// ── Multer ────────────────────────────────────────────────────────────────
const ALLOWED_MIMES = [
  'application/pdf',
  'image/png', 'image/jpeg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) cb(null, true)
    else cb(new Error(`Tipo no permitido: ${file.mimetype}`))
  },
})

// ── Helpers ───────────────────────────────────────────────────────────────
function log(method, path, extra = '') {
  const ts = new Date().toISOString().slice(11, 19)
  console.log(`[${ts}] ${method} ${path}${extra ? ' — ' + extra : ''}`)
}

function kb(b) { return (b / 1024).toFixed(1) + ' KB' }

async function buildTree() {
  const all = []
  let token
  do {
    const res = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, ContinuationToken: token }))
    all.push(...(res.Contents ?? []))
    token = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (token)

  const tree = { universities: [], careers: {}, subjects: {} }
  for (const obj of all) {
    // Ignora archivos internos y metadata
    if (obj.Key.startsWith('_meta/') || obj.Key === 'index.json') continue
    const parts = obj.Key.split('/')
    if (parts.length < 4) continue
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

async function updateIndex() {
  try {
    const tree = await buildTree()
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET, Key: 'index.json',
      Body: JSON.stringify(tree, null, 2),
      ContentType: 'application/json',
    }))
  } catch (err) { console.error('[index]', err.message) }
}

// ── File compression ──────────────────────────────────────────────────────
async function compressFile(buffer, mimetype, originalname) {
  const orig = buffer.length
  try {
    if (mimetype === 'application/pdf') {
      const tmpIn = join(tmpdir(), `aa_${randomBytes(6).toString('hex')}.pdf`)
      try {
        await writeFile(tmpIn, buffer)
        const compressed = await compressPdf(tmpIn, { resolution: 'ebook' })
        if (compressed.length < orig) {
          log('COMPRESS', 'PDF', `${kb(orig)} → ${kb(compressed.length)}`)
          return { buffer: compressed, mimetype, ext: '.pdf' }
        }
      } finally { await unlink(tmpIn).catch(() => {}) }
      return { buffer, mimetype, ext: '.pdf' }
    }
    if (['image/png', 'image/jpeg'].includes(mimetype)) {
      const compressed = await sharp(buffer)
        .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 }).toBuffer()
      if (compressed.length < orig) {
        log('COMPRESS', 'IMG→WebP', `${kb(orig)} → ${kb(compressed.length)}`)
        return { buffer: compressed, mimetype: 'image/webp', ext: '.webp' }
      }
      return { buffer, mimetype, ext: originalname.endsWith('.png') ? '.png' : '.jpg' }
    }
    const officeTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/msword', 'application/vnd.ms-powerpoint',
    ]
    if (officeTypes.includes(mimetype)) {
      const zip = await JSZip.loadAsync(buffer)
      const tasks = []
      zip.forEach((path, file) => {
        if (!file.dir && /\.(png|jpe?g)$/i.test(path)) {
          tasks.push(file.async('nodebuffer').then(async img => {
            try {
              const out = await sharp(img).resize({ width: 1920, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer()
              if (out.length < img.length) zip.file(path, out)
            } catch {}
          }))
        }
      })
      await Promise.all(tasks)
      const compressed = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } })
      const ext = originalname.match(/\.\w+$/)?.[0] ?? ''
      if (compressed.length < orig) {
        log('COMPRESS', `OFFICE${ext}`, `${kb(orig)} → ${kb(compressed.length)}`)
        return { buffer: compressed, mimetype, ext }
      }
      return { buffer, mimetype, ext }
    }
  } catch (err) { log('COMPRESS', 'ERROR', err.message) }
  const ext = originalname.match(/\.\w+$/)?.[0] ?? ''
  return { buffer, mimetype, ext }
}

// ── Meta helpers ──────────────────────────────────────────────────────────
async function readMeta(key) {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
    const chunks = []; for await (const c of res.Body) chunks.push(c)
    return JSON.parse(Buffer.concat(chunks).toString())
  } catch { return {} }
}

async function writeMeta(key, data) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET, Key: key,
    Body: JSON.stringify(data, null, 2),
    ContentType: 'application/json',
  }))
}

// ══════════════════════════════════════════════════════════════════════════
// ROUTES
// ══════════════════════════════════════════════════════════════════════════

/** Health check */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', bucket: BUCKET })
})

/** Tree */
app.get('/api/tree', async (_req, res) => {
  log('GET', '/api/tree')
  try { res.json(await buildTree()) }
  catch (err) { res.status(500).json({ error: err.message }) }
})

/** Files in subject */
app.get('/api/files', async (req, res) => {
  const uni     = sanitizePath(req.query.university)
  const career  = sanitizePath(req.query.career)
  const subject = sanitizePath(req.query.subject)
  log('GET', '/api/files', `${uni}/${career}/${subject}`)

  if (!uni || !career || !subject)
    return res.status(400).json({ error: 'Parámetros requeridos: university, career, subject' })

  try {
    const prefix = `${uni}/${career}/${subject}/`
    const result = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix }))
    const files = (result.Contents ?? [])
      .filter(o => !o.Key.endsWith('/') && !o.Key.startsWith('_meta/'))
      .map(o => ({ key: o.Key, name: o.Key.split('/').pop(), size: o.Size, lastModified: o.LastModified }))
    res.json(files)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

/** Upload */
app.post('/api/upload', uploadLimiter, upload.single('file'), async (req, res) => {
  const uni        = sanitizePath(req.body.university)
  const career     = sanitizePath(req.body.career)
  const subject    = sanitizePath(req.body.subject)
  const uploaderId = typeof req.body.uploaderId === 'string' ? req.body.uploaderId.slice(0, 64) : ''

  log('POST', '/api/upload', `${uni}/${career}/${subject} — ${req.file?.originalname}`)

  if (!req.file)                  return res.status(400).json({ error: 'No se recibió archivo' })
  if (!uni || !career || !subject) return res.status(400).json({ error: 'university, career y subject son requeridos' })

  const { buffer, mimetype, ext } = await compressFile(req.file.buffer, req.file.mimetype, req.file.originalname)

  // Nombre limpio — preserva español, reemplaza resto
  const baseName = req.file.originalname
    .normalize('NFC')
    .replace(/\.\w+$/, '')
    .replace(/[^\w.\- áéíóúÁÉÍÓÚñÑüÜ]/g, '_')
    .slice(0, 150)
  const clean = baseName + ext

  const key = `${uni}/${career}/${subject}/${clean}`

  try {
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET, Key: key, Body: buffer, ContentType: mimetype,
      Metadata: {
        'uploaded-at': new Date().toISOString(),
        'university': uni, 'career': career, 'subject': subject,
        'uploader-id': uploaderId,
      },
    }))

    // Registrar upload y actualizar índice (background)
    readMeta('_meta/uploads.json').then(data => {
      data[key] = { uploaderId, uploadedAt: new Date().toISOString() }
      return writeMeta('_meta/uploads.json', data)
    }).catch(console.error)

    updateIndex()
    res.json({ success: true, key, name: clean, size: buffer.length })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

/** Delete — verifica que el uploaderId coincida */
app.delete('/api/files', async (req, res) => {
  const rawKey     = req.body.key
  const uploaderId = typeof req.body.uploaderId === 'string' ? req.body.uploaderId.slice(0, 64) : ''

  const key = sanitizeKey(rawKey)
  log('DELETE', '/api/files', key)

  if (!key) return res.status(400).json({ error: 'key inválido' })

  // Verificar ownership via _meta/uploads.json
  try {
    const uploads = await readMeta('_meta/uploads.json')
    const record  = uploads[rawKey] // usar rawKey para buscar en el registro

    if (!record) return res.status(403).json({ error: 'No se encontró el registro de este archivo' })
    if (record.uploaderId !== uploaderId)
      return res.status(403).json({ error: 'No tenés permiso para eliminar este archivo' })

    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))

    // Limpiar el registro
    delete uploads[rawKey]
    await writeMeta('_meta/uploads.json', uploads)
    updateIndex()

    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

/** Preview — sirve inline para previsualización */
app.get('/api/preview', downloadLimiter, async (req, res) => {
  const key = sanitizeKey(req.query.key)
  log('GET', '/api/preview', key)

  if (!key) return res.status(400).json({ error: 'key inválido o acceso denegado' })

  try {
    const result = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
    const filename = key.split('/').pop()
    res.setHeader('Content-Type', result.ContentType ?? 'application/octet-stream')
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(filename)}`)
    if (result.ContentLength) res.setHeader('Content-Length', result.ContentLength)
    result.Body.pipe(res)
  } catch (err) { res.status(404).json({ error: 'Archivo no encontrado' }) }
})

/** Download */
app.get('/api/download', downloadLimiter, async (req, res) => {
  const key = sanitizeKey(req.query.key)
  log('GET', '/api/download', key)

  if (!key) return res.status(400).json({ error: 'key inválido o acceso denegado' })

  try {
    const result = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
    const filename = key.split('/').pop()
    res.setHeader('Content-Type', result.ContentType ?? 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
    if (result.ContentLength) res.setHeader('Content-Length', result.ContentLength)
    result.Body.pipe(res)
  } catch (err) { res.status(404).json({ error: 'Archivo no encontrado' }) }
})

/** Ratings */
app.get('/api/ratings', async (_req, res) => {
  try { res.json(await readMeta('_meta/ratings.json')) }
  catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/api/ratings', rateLimit({ windowMs: 60000, max: 30 }), async (req, res) => {
  const key   = sanitizeKey(req.body.key)
  const stars = parseInt(req.body.stars, 10)
  log('POST', '/api/ratings', `${key} → ${stars}★`)

  if (!key || isNaN(stars) || stars < 1 || stars > 5)
    return res.status(400).json({ error: 'key y stars (1-5) requeridos' })

  try {
    const data  = await readMeta('_meta/ratings.json')
    const entry = data[key] ?? { total: 0, count: 0 }
    entry.total += stars; entry.count += 1
    entry.avg = parseFloat((entry.total / entry.count).toFixed(1))
    data[key] = entry
    await writeMeta('_meta/ratings.json', data)
    res.json(entry)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

/** Uploads registry — solo devuelve los keys, no los uploaderIds (privacidad) */
app.get('/api/uploads', async (_req, res) => {
  try {
    const data = await readMeta('_meta/uploads.json')
    // No exponer device IDs — solo confirmar qué archivos tienen registro
    const safe = {}
    for (const [k, v] of Object.entries(data)) {
      safe[k] = { uploadedAt: v.uploadedAt }
    }
    res.json(safe)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

/** Verificar si el device actual es dueño de un archivo */
app.post('/api/verify-owner', async (req, res) => {
  const key        = sanitizeKey(req.body.key)
  const uploaderId = typeof req.body.uploaderId === 'string' ? req.body.uploaderId.slice(0, 64) : ''
  if (!key) return res.json({ isOwner: false })

  try {
    const data   = await readMeta('_meta/uploads.json')
    const record = data[req.body.key]
    res.json({ isOwner: !!(record && record.uploaderId === uploaderId) })
  } catch { res.json({ isOwner: false }) }
})

// ── Error handler global ──────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  if (err.message?.includes('CORS')) return res.status(403).json({ error: err.message })
  if (err.message?.includes('Tipo no permitido')) return res.status(415).json({ error: err.message })
  console.error('[error]', err.message)
  res.status(500).json({ error: 'Error interno del servidor' })
})

// ── Start ─────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅ Server → http://localhost:${PORT}`)
  console.log(`   Bucket : ${BUCKET ?? '⚠️  CF_R2_BUCKET_NAME no configurado'}`)
  console.log(`   CORS   : ${ALLOWED.join(', ')}`)
  if (!process.env.CF_R2_ACCESS_KEY_ID) console.warn('   ⚠️  CF_R2_ACCESS_KEY_ID no configurado')
  if (!process.env.CF_R2_SECRET_ACCESS_KEY) console.warn('   ⚠️  CF_R2_SECRET_ACCESS_KEY no configurado')
})
