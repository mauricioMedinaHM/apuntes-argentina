// ── ApuntesArgentina — Upload & API server ────────────────────────────────
// Corre separado del frontend. En producción: Railway / Render / Fly.io
// En desarrollo: node server.js  |  npm run server
//
// VARIABLES DE ENTORNO REQUERIDAS (ver .env.example):
//   CF_R2_BUCKET_NAME, CF_R2_ACCESS_KEY_ID, CF_R2_SECRET_ACCESS_KEY,
//   CF_R2_ENDPOINT, ALLOWED_ORIGINS, UPLOAD_PORT
//   CLERK_SECRET_KEY, VITE_CLERK_PUBLISHABLE_KEY (para auth backend)

// dotenv solo en local (Vercel inyecta env vars directamente)
if (!process.env.VERCEL) {
  const { config } = await import('dotenv')
  config()
}

import express        from 'express'
import multer         from 'multer'
import cors           from 'cors'
import helmet         from 'helmet'
import rateLimit      from 'express-rate-limit'
import { clerkMiddleware, getAuth, clerkClient } from '@clerk/express'
import { fileTypeFromBuffer } from 'file-type'
import {
  S3Client, PutObjectCommand, ListObjectsV2Command,
  DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, CopyObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import sharp   from 'sharp'
import JSZip   from 'jszip'
import { writeFile, unlink } from 'fs/promises'
import { join }       from 'path'
import { tmpdir }     from 'os'
import { randomBytes, createHmac, timingSafeEqual } from 'crypto'

// compress-pdf usa Ghostscript — no disponible en Vercel serverless
const IS_SERVERLESS = !!process.env.VERCEL
let compressPdf = null
if (!IS_SERVERLESS) {
  try {
    const mod = await import('compress-pdf')
    compressPdf = mod.compress
  } catch {}
}

const PORT   = parseInt(process.env.UPLOAD_PORT ?? '3002', 10)
const BUCKET = process.env.CF_R2_BUCKET_NAME

// ── Input sanitization ────────────────────────────────────────────────────
// Previene path traversal, null bytes y caracteres peligrosos
// Máximo 100 caracteres por segmento (hardened de 200 a 100)
function sanitizePath(str) {
  if (typeof str !== 'string') return ''
  return str
    .replace(/\0/g, '')           // null bytes
    .replace(/\.\./g, '')         // path traversal
    .replace(/[/\\]/g, '')        // slashes
    .replace(/[<>:"|?*]/g, '')    // shell/windows dangerous chars
    .trim()
    .slice(0, 100)                // max 100 chars por segmento
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

// Security headers — helmet con CSP básico habilitado
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'"],
      styleSrc:       ["'self'", "'unsafe-inline'"],
      imgSrc:         ["'self'", 'data:', 'blob:'],
      connectSrc:     ["'self'"],
      frameSrc:       ["'none'"],
      objectSrc:      ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // X-Content-Type-Options: nosniff  — activado por defecto en helmet
  // X-Frame-Options: DENY            — activado por defecto en helmet
  // Strict-Transport-Security        — activado por defecto en helmet
}))

// CORS — solo orígenes permitidos; en producción NUNCA '*'
const ALLOWED = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176')
  .split(',').map(s => s.trim()).filter(Boolean)

app.use(cors({
  origin: (origin, cb) => {
    // Permite requests sin Origin: son same-origin (el browser no envía Origin
    // en GET same-origin) o no-browser (curl, apps nativas). No hay riesgo cross-origin.
    if (!origin) return cb(null, true)
    if (ALLOWED.includes(origin)) return cb(null, true)
    cb(new Error(`CORS: origin no permitido — ${origin}`))
  },
  methods: ['GET', 'POST', 'DELETE'],
  // Authorization agregado para que el frontend pueda enviar el JWT de Clerk
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

app.use(express.json({ limit: '1mb' }))

// ── Clerk middleware (verifica JWT en todos los requests) ─────────────────
// clerkMiddleware() no rechaza requests sin token — solo adjunta auth context.
app.use(clerkMiddleware())

// requireAuth() de Clerk redirige (302) requests sin sesión — útil para páginas,
// pero esto es una API: queremos un 401 JSON limpio. Verificamos el userId del JWT.
function requireAuthApi(req, res, next) {
  const { userId } = getAuth(req)
  if (!userId) return res.status(401).json({ error: 'Autenticación requerida' })
  next()
}

/**
 * Verifica que el usuario logueado (JWT de Clerk) tenga rol admin.
 * El rol se guarda en publicMetadata.role === 'admin' del usuario en Clerk.
 */
async function isAdminUser(req) {
  const { userId } = getAuth(req)
  if (!userId) return false
  try {
    const user = await clerkClient.users.getUser(userId)
    return user?.publicMetadata?.role === 'admin'
  } catch { return false }
}

/** Middleware: solo deja pasar a usuarios con rol admin */
async function requireAdmin(req, res, next) {
  if (await isAdminUser(req)) return next()
  res.status(403).json({ error: 'Requiere permisos de administrador' })
}

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

const deleteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hora
  max: 10,                    // 10 deletes por IP por hora
  message: { error: 'Límite de eliminaciones alcanzado. Intentá de nuevo en 1 hora.' },
})

const downloadLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 min
  max: 60,                    // 60 descargas por minuto
  message: { error: 'Demasiadas descargas. Esperá un momento.' },
})

const treeLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 min
  max: 100,                   // 100 req/min por IP
  message: { error: 'Demasiadas solicitudes. Esperá un momento.' },
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

// Mapeo de extensiones reales (magic bytes) a mimetypes aceptados
// file-type detecta por contenido; algunos Office legacy no tienen magic bytes claros
const MAGIC_TO_ALLOWED_MIME = {
  'application/pdf': 'application/pdf',
  'image/png':       'image/png',
  'image/jpeg':      'image/jpeg',
  // OOXML (.docx/.pptx) se detectan como zip
  'application/zip': null, // permitido si el declared mime es un tipo OOXML
  // Office 97-2003 (.doc/.ppt) — file-type los detecta como application/x-cfb
  'application/x-cfb': null, // permitido si el declared mime es msword/ms-powerpoint
}

// Mimetypes OOXML (son ZIPs internamente)
const OOXML_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
])

// Mimetypes Office legacy (CFB internamente)
const LEGACY_OFFICE_MIMES = new Set([
  'application/msword',
  'application/vnd.ms-powerpoint',
])

async function validateMagicBytes(buffer, declaredMime) {
  const detected = await fileTypeFromBuffer(buffer)

  if (!detected) {
    // file-type no pudo detectar — rechazar para evitar archivos maliciosos sin firma
    return { valid: false, reason: `No se pudo detectar el tipo real del archivo` }
  }

  const detectedMime = detected.mime

  // PDF — debe matchear exacto
  if (declaredMime === 'application/pdf') {
    if (detectedMime !== 'application/pdf') {
      return { valid: false, reason: `El archivo declara ser PDF pero es ${detectedMime}` }
    }
    return { valid: true }
  }

  // Imágenes — deben matchear exacto
  if (declaredMime === 'image/png' || declaredMime === 'image/jpeg') {
    if (detectedMime !== declaredMime) {
      return { valid: false, reason: `El archivo declara ser ${declaredMime} pero es ${detectedMime}` }
    }
    return { valid: true }
  }

  // OOXML — internamente son ZIP
  if (OOXML_MIMES.has(declaredMime)) {
    if (detectedMime !== 'application/zip') {
      return { valid: false, reason: `El archivo OOXML no tiene firma ZIP válida (detectado: ${detectedMime})` }
    }
    return { valid: true }
  }

  // Office legacy — internamente son CFB (Compound File Binary)
  if (LEGACY_OFFICE_MIMES.has(declaredMime)) {
    if (detectedMime !== 'application/x-cfb') {
      return { valid: false, reason: `El archivo Office legacy no tiene firma CFB válida (detectado: ${detectedMime})` }
    }
    return { valid: true }
  }

  return { valid: false, reason: `Tipo no verificable: ${declaredMime}` }
}

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

  // Helpers que aceptan rutas parciales: solo uni, uni+carrera, o uni+carrera+materia
  const addUni = uni => {
    if (uni && !tree.universities.includes(uni)) tree.universities.push(uni)
  }
  const addCareer = (uni, career) => {
    if (!uni) return
    addUni(uni)
    if (!career) return
    if (!tree.careers[uni]) tree.careers[uni] = []
    if (!tree.careers[uni].includes(career)) tree.careers[uni].push(career)
  }
  const addSubject = (uni, career, subject) => {
    if (!uni || !career) return
    addCareer(uni, career)
    if (!subject) return
    if (!tree.subjects[uni]) tree.subjects[uni] = {}
    if (!tree.subjects[uni][career]) tree.subjects[uni][career] = []
    if (!tree.subjects[uni][career].includes(subject)) tree.subjects[uni][career].push(subject)
  }

  // 1) Carpetas derivadas de archivos físicos en el bucket
  for (const obj of all) {
    if (obj.Key.startsWith('_meta/') || obj.Key === 'index.json') continue
    const parts = obj.Key.split('/')
    if (parts.length < 4) continue
    addSubject(parts[0], parts[1], parts[2])
  }

  // 2) Materias con links de Drive (sin archivos físicos)
  try {
    const links = await readMeta('_meta/drive-links.json')
    for (const path of Object.keys(links)) {
      const [uni, career, subject] = path.split('/')
      addSubject(uni, career, subject)
    }
  } catch {}

  // 3) Carpetas creadas explícitamente por las personas (persisten aunque estén vacías)
  try {
    const folders = await readFolders()
    for (const path of Object.keys(folders.careers)) {
      const [uni, career] = path.split('/')
      addCareer(uni, career)
    }
    for (const path of Object.keys(folders.subjects)) {
      const [uni, career, subject] = path.split('/')
      addSubject(uni, career, subject)
    }
  } catch {}

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
      // PDF compression requiere Ghostscript — solo disponible en local
      if (!compressPdf) return { buffer, mimetype, ext: '.pdf' }
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

// ── Carpetas persistidas ────────────────────────────────────────────────────
// _meta/folders.json = { careers: { "uni/career": {by,at} }, subjects: { "uni/career/subject": {by,at} } }
// Persiste la estructura aunque no haya archivos (borrar un archivo nunca elimina
// la carpeta) y guarda quién la creó (para que solo el creador pueda renombrarla).
function toFolderMap(x) {
  if (Array.isArray(x)) { const o = {}; for (const p of x) if (typeof p === 'string') o[p] = {}; return o }  // legacy (array de paths)
  return (x && typeof x === 'object') ? x : {}
}
async function readFolders() {
  const f = await readMeta('_meta/folders.json')
  return { careers: toFolderMap(f.careers), subjects: toFolderMap(f.subjects) }
}

/** Registra una carrera y/o materia en folders.json (idempotente), guardando el creador */
async function registerFolders({ careerPath, subjectPath, by = '' } = {}) {
  try {
    const folders = await readFolders()
    let changed = false
    const now = new Date().toISOString()
    if (careerPath && !folders.careers[careerPath])  { folders.careers[careerPath]   = { by, at: now }; changed = true }
    if (subjectPath && !folders.subjects[subjectPath]) { folders.subjects[subjectPath] = { by, at: now }; changed = true }
    if (changed) await writeMeta('_meta/folders.json', folders)
  } catch (err) { console.error('[folders] register', err.message) }
}

/** Mueve todos los objetos de un prefijo a otro (copy + delete). Devuelve [{oldKey,newKey}] */
async function movePrefix(oldPrefix, newPrefix) {
  const moved = []
  let token
  do {
    const res = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: oldPrefix, ContinuationToken: token }))
    for (const o of (res.Contents ?? [])) {
      const newKey = newPrefix + o.Key.slice(oldPrefix.length)
      const copySource = `${BUCKET}/${o.Key.split('/').map(encodeURIComponent).join('/')}`
      await s3.send(new CopyObjectCommand({ Bucket: BUCKET, CopySource: copySource, Key: newKey }))
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: o.Key }))
      moved.push({ oldKey: o.Key, newKey })
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (token)
  return moved
}

/** Renombra las keys de un meta-archivo (key→valor) que estén bajo oldPath */
function renameMetaKeys(obj, oldPath, newPath, { prefixMatch = true } = {}) {
  let changed = false
  for (const k of Object.keys(obj)) {
    if (k === oldPath || (prefixMatch && k.startsWith(oldPath + '/'))) {
      const nk = newPath + k.slice(oldPath.length)
      obj[nk] = obj[k]; delete obj[k]; changed = true
    }
  }
  return changed
}

// ══════════════════════════════════════════════════════════════════════════
// ROUTES
// ══════════════════════════════════════════════════════════════════════════

/** Health check */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', bucket: BUCKET })
})

/** Tree */
app.get('/api/tree', treeLimiter, async (_req, res) => {
  log('GET', '/api/tree')
  try { res.json(await buildTree()) }
  catch (err) { res.status(500).json({ error: err.message }) }
})

/** Files in subject */
app.get('/api/files', treeLimiter, async (req, res) => {
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
      .map(o => ({ type: 'file', key: o.Key, name: o.Key.split('/').pop(), size: o.Size, lastModified: o.LastModified, owned: false }))

    // Marcar los archivos del usuario logueado (para mostrarle SOLO a él el botón de borrar)
    const { userId } = getAuth(req)
    if (userId && files.length > 0) {
      const uploads = await readMeta('_meta/uploads.json')
      for (const f of files) f.owned = uploads[f.key]?.uploaderId === userId
    }

    // Carpetas de Drive registradas para esta materia
    const links = await readMeta('_meta/drive-links.json')
    const folders = links[`${uni}/${career}/${subject}`] ?? []

    const driveItems = []
    for (const l of folders) {
      // Listar el contenido real de la carpeta raíz registrada (si hay GOOGLE_API_KEY)
      const contents = await listDriveFolder(extractFolderId(l.url), { withCounts: true })
      if (contents && (contents.files.length > 0 || contents.folders.length > 0)) {
        // Subcarpetas → cards navegables (firmadas para evitar proxy abierto)
        for (const fo of contents.folders) {
          driveItems.push({
            type: 'drive-folder',
            id: `${l.id}:${fo.driveId}`,
            folderId: l.id,          // id del link registrado (para borrar todo el link)
            driveId: fo.driveId,     // id de Drive para navegar adentro
            sig: signDriveId(fo.driveId),
            name: fo.name,
            count: fo.count ?? null,
            lastModified: fo.lastModified,
            source: l.name,
          })
        }
        // Archivos sueltos en la raíz → cards individuales
        for (const f of contents.files) {
          driveItems.push({
            type: 'drive-file',
            id: `${l.id}:${f.driveId}`,
            folderId: l.id,
            name: f.name,
            kind: f.kind,
            size: f.size,
            lastModified: f.lastModified,
            viewUrl: f.viewUrl,
            previewUrl: f.previewUrl,
            source: l.name,
          })
        }
      } else {
        // Fallback: sin API key o carpeta vacía/privada → card que abre Drive
        driveItems.push({ type: 'drive', id: l.id, name: l.name, url: l.url, lastModified: l.addedAt })
      }
    }

    res.json([...driveItems, ...files])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

/**
 * Contenido de una subcarpeta de Drive (para navegar adentro de una carpeta registrada).
 * id = ID de carpeta de Drive. Solo lee contenido público vía la API key del sitio.
 */
app.get('/api/drive-folder', treeLimiter, async (req, res) => {
  const driveId = typeof req.query.id === 'string' && /^[a-zA-Z0-9_-]+$/.test(req.query.id) ? req.query.id : ''
  const folderId = typeof req.query.folderId === 'string' ? req.query.folderId : ''  // link registrado (para borrar)
  const sig = typeof req.query.sig === 'string' ? req.query.sig : ''
  log('GET', '/api/drive-folder', driveId)

  if (!driveId) return res.status(400).json({ error: 'id de carpeta inválido' })
  // Solo se pueden navegar carpetas cuyo ID firmamos al listarlas (no es un proxy abierto)
  if (!verifyDriveSig(driveId, sig)) return res.status(403).json({ error: 'Acceso a la carpeta no autorizado' })

  try {
    const contents = await listDriveFolder(driveId, { withCounts: true })
    if (!contents) return res.status(503).json({ error: 'No se pudo leer la carpeta de Drive' })

    const items = []
    for (const fo of contents.folders) {
      items.push({
        type: 'drive-folder',
        id: `${folderId}:${fo.driveId}`,
        folderId, driveId: fo.driveId,
        sig: signDriveId(fo.driveId),
        name: fo.name, count: fo.count ?? null, lastModified: fo.lastModified,
      })
    }
    for (const f of contents.files) {
      items.push({
        type: 'drive-file',
        id: `${folderId}:${f.driveId}`,
        folderId, name: f.name, kind: f.kind, size: f.size,
        lastModified: f.lastModified, viewUrl: f.viewUrl, previewUrl: f.previewUrl,
      })
    }
    res.json(items)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

/**
 * Crear una carpeta (carrera o materia). Requiere sesión.
 * La carpeta queda persistida en _meta/folders.json — no depende de tener archivos,
 * así que borrar archivos nunca la elimina.
 */
app.post('/api/folder', requireAuthApi, async (req, res) => {
  const { userId } = getAuth(req)
  const uni     = sanitizePath(req.body.university)
  const career  = sanitizePath(req.body.career)
  const subject = sanitizePath(req.body.subject)  // opcional
  log('POST', '/api/folder', `${uni}/${career}${subject ? '/' + subject : ''}`)

  if (!uni || !career) return res.status(400).json({ error: 'university y career son requeridos' })

  try {
    await registerFolders({
      careerPath: `${uni}/${career}`,
      subjectPath: subject ? `${uni}/${career}/${subject}` : null,
      by: userId,
    })
    await updateIndex()
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

/**
 * Eliminar una carpeta (admin). Solo desregistra la carpeta de folders.json —
 * NUNCA borra archivos ni links de Drive. Se rechaza si la carpeta tiene contenido,
 * para no esconder información de nadie.
 */
app.delete('/api/folder', requireAuthApi, requireAdmin, async (req, res) => {
  const uni     = sanitizePath(req.body.university)
  const career  = sanitizePath(req.body.career)
  const subject = sanitizePath(req.body.subject)  // opcional
  log('DELETE', '/api/folder', `${uni}/${career}${subject ? '/' + subject : ''}`)

  if (!uni || !career) return res.status(400).json({ error: 'university y career son requeridos' })

  const target = subject ? `${uni}/${career}/${subject}` : `${uni}/${career}`

  try {
    // Verificar que no haya archivos físicos bajo esa ruta
    const listed = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: `${target}/`, MaxKeys: 1 }))
    const hasFiles = (listed.Contents ?? []).some(o => !o.Key.startsWith('_meta/'))
    if (hasFiles) return res.status(409).json({ error: 'La carpeta tiene archivos. Eliminalos primero.' })

    // Verificar que no haya links de Drive bajo esa ruta
    const links = await readMeta('_meta/drive-links.json')
    const hasDrive = Object.keys(links).some(p => p === target || p.startsWith(target + '/'))
    if (hasDrive) return res.status(409).json({ error: 'La carpeta tiene carpetas de Drive vinculadas. Quitalas primero.' })

    // Desregistrar de folders.json (la carrera arrastra sus materias)
    const folders = await readFolders()
    for (const p of Object.keys(folders.subjects)) if (p === target || p.startsWith(target + '/')) delete folders.subjects[p]
    if (!subject) delete folders.careers[target]
    await writeMeta('_meta/folders.json', folders)

    await updateIndex()
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

/** Carpetas creadas por el usuario logueado (para que el front sepa cuáles puede renombrar) */
app.get('/api/my-folders', requireAuthApi, async (req, res) => {
  const { userId } = getAuth(req)
  try {
    const folders = await readFolders()
    const mine = (map) => Object.entries(map).filter(([, m]) => m && m.by === userId).map(([p]) => p)
    res.json({ careers: mine(folders.careers), subjects: mine(folders.subjects) })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

/**
 * Renombrar una carpeta (carrera o materia). Solo el creador o un admin.
 * Mueve los archivos físicos y actualiza todos los metadatos. No se pierde nada.
 */
app.post('/api/folder/rename', requireAuthApi, async (req, res) => {
  const { userId } = getAuth(req)
  const uni     = sanitizePath(req.body.university)
  const career  = sanitizePath(req.body.career)
  const subject = sanitizePath(req.body.subject)   // opcional → si viene, renombramos materia
  const newName = sanitizePath(req.body.newName)
  log('POST', '/api/folder/rename', `${uni}/${career}${subject ? '/' + subject : ''} → ${newName}`)

  if (!uni || !career || !newName) return res.status(400).json({ error: 'university, career y newName son requeridos' })

  const isSubject = !!subject
  const oldPath = isSubject ? `${uni}/${career}/${subject}` : `${uni}/${career}`
  const newPath = isSubject ? `${uni}/${career}/${newName}` : `${uni}/${newName}`
  if (oldPath === newPath) return res.json({ success: true, unchanged: true })

  try {
    const folders = await readFolders()
    const meta = isSubject ? folders.subjects[oldPath] : folders.careers[oldPath]
    const admin = await isAdminUser(req)

    // Permiso: el creador registrado, o un admin
    if (!admin && !(meta && meta.by && meta.by === userId))
      return res.status(403).json({ error: 'Solo quien creó la carpeta (o un admin) puede renombrarla' })

    // Colisión: no permitir si el destino ya existe como carpeta registrada
    const destTaken = isSubject ? !!folders.subjects[newPath] : !!folders.careers[newPath]
    if (destTaken) return res.status(409).json({ error: 'Ya existe una carpeta con ese nombre' })

    // 1) Mover archivos físicos del bucket
    const moved = await movePrefix(`${oldPath}/`, `${newPath}/`)

    // 2) Actualizar uploads.json y ratings.json (las keys cambian)
    if (moved.length) {
      const uploads = await readMeta('_meta/uploads.json')
      let u = false
      for (const m of moved) if (uploads[m.oldKey]) { uploads[m.newKey] = uploads[m.oldKey]; delete uploads[m.oldKey]; u = true }
      if (u) await writeMeta('_meta/uploads.json', uploads)

      const ratings = await readMeta('_meta/ratings.json')
      let r = false
      for (const m of moved) if (ratings[m.oldKey]) { ratings[m.newKey] = ratings[m.oldKey]; delete ratings[m.oldKey]; r = true }
      if (r) await writeMeta('_meta/ratings.json', ratings)
    }

    // 3) Actualizar links de Drive (las path-keys cambian)
    const links = await readMeta('_meta/drive-links.json')
    if (renameMetaKeys(links, oldPath, newPath)) await writeMeta('_meta/drive-links.json', links)

    // 4) Actualizar folders.json (carrera arrastra sus materias)
    const f = await readFolders()
    if (isSubject) {
      f.subjects[newPath] = f.subjects[oldPath] ?? { by: userId, at: new Date().toISOString() }
      delete f.subjects[oldPath]
    } else {
      f.careers[newPath] = f.careers[oldPath] ?? { by: userId, at: new Date().toISOString() }
      delete f.careers[oldPath]
      for (const p of Object.keys(f.subjects)) {
        if (p.startsWith(oldPath + '/')) { f.subjects[newPath + p.slice(oldPath.length)] = f.subjects[p]; delete f.subjects[p] }
      }
    }
    await writeMeta('_meta/folders.json', f)

    await updateIndex()
    res.json({ success: true, oldPath, newPath, movedFiles: moved.length })
  } catch (err) { console.error('[rename]', err.message); res.status(500).json({ error: err.message }) }
})

// ── Nombre de archivo limpio (compartido) ──────────────────────────────────
function cleanFileName(originalname) {
  const m = originalname.match(/\.(\w+)$/)
  const ext = m ? '.' + m[1].toLowerCase() : ''
  const base = originalname
    .normalize('NFC')
    .replace(/\.\w+$/, '')
    .replace(/[^\w.\- áéíóúÁÉÍÓÚñÑüÜ]/g, '_')
    .slice(0, 100)
  return base + ext
}

const EXT_TO_MIME = {
  '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

// ══════════════════════════════════════════════════════════════════════════
// CARPETAS DE DRIVE (admin) — links externos que se muestran como contenido
// ══════════════════════════════════════════════════════════════════════════

/** Valida que la URL sea de Google Drive */
function isDriveUrl(url) {
  if (typeof url !== 'string') return false
  try {
    const u = new URL(url)
    return /(^|\.)drive\.google\.com$/.test(u.hostname) || /(^|\.)docs\.google\.com$/.test(u.hostname)
  } catch { return false }
}

/** Extrae el ID de carpeta de un link de Google Drive */
function extractFolderId(url) {
  if (typeof url !== 'string') return null
  // .../folders/FOLDER_ID  |  ...?id=FOLDER_ID  |  .../folderview?id=FOLDER_ID
  const m = url.match(/\/folders\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  return m ? m[1] : null
}

// ── Firma de IDs de carpeta de Drive ───────────────────────────────────────
// Evita que /api/drive-folder se use como proxy abierto: solo se pueden navegar
// las carpetas cuyo ID firmamos nosotros al listarlas (raíces registradas + sus hijas).
const DRIVE_SIG_SECRET = process.env.CLERK_SECRET_KEY || process.env.CF_R2_SECRET_ACCESS_KEY || 'aa-drive-sig-fallback'
function signDriveId(driveId) {
  return createHmac('sha256', DRIVE_SIG_SECRET).update(String(driveId)).digest('hex').slice(0, 24)
}
function verifyDriveSig(driveId, sig) {
  if (typeof sig !== 'string' || sig.length !== 24) return false
  const expected = signDriveId(driveId)
  try { return timingSafeEqual(Buffer.from(expected), Buffer.from(sig)) } catch { return false }
}

/** Categoría de archivo a partir del mimeType de Drive (para el badge/preview) */
function driveKind(mimeType = '') {
  if (mimeType.includes('pdf')) return 'pdf'
  if (mimeType.includes('document') || mimeType.includes('msword')) return 'doc'
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'ppt'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'xls'
  if (mimeType.startsWith('image/')) return 'img'
  if (mimeType.includes('folder')) return 'folder'
  return 'file'
}

const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder'

/** Cuenta cuántos items hay dentro de una carpeta de Drive (para el badge "(14)") */
async function countDriveFolder(folderId) {
  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey || !folderId) return null
  try {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`)
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&key=${apiKey}&fields=${encodeURIComponent('files(id)')}&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    return (data.files ?? []).length
  } catch { return null }
}

/**
 * Llama a la Drive API v3 con un API key público.
 * Devuelve { ok, data, status, apiError } para que los callers puedan distinguir el tipo de fallo.
 */
async function driveApiFetch(path) {
  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) return { ok: false, status: 0, apiError: 'no_api_key' }
  try {
    const sep = path.includes('?') ? '&' : '?'
    const res = await fetch(`https://www.googleapis.com/drive/v3/${path}${sep}key=${apiKey}&supportsAllDrives=true&includeItemsFromAllDrives=true`)
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      const msg = data?.error?.message || `HTTP ${res.status}`
      log('DRIVE', 'api error', `${res.status} ${msg}`)
      return { ok: false, status: res.status, apiError: msg, data }
    }
    if (data?.error) {
      const msg = data.error.message || 'Drive API error'
      log('DRIVE', 'api error body', msg)
      return { ok: false, status: data.error.code ?? 500, apiError: msg, data }
    }
    return { ok: true, status: res.status, data }
  } catch (err) {
    log('DRIVE', 'fetch exception', err.message)
    return { ok: false, status: 0, apiError: err.message }
  }
}

/**
 * Lista el contenido de una carpeta pública de Drive, separando archivos y subcarpetas.
 * Requiere GOOGLE_API_KEY (Drive API v3). Sin key, devuelve null (fallback a card).
 * @returns {{ files: object[], folders: object[] } | null}
 */
async function listDriveFolder(folderId, { withCounts = false } = {}) {
  if (!process.env.GOOGLE_API_KEY || !folderId) return null
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`)
  const fields = encodeURIComponent('files(id,name,mimeType,size,modifiedTime)')
  const { ok, data } = await driveApiFetch(
    `files?q=${q}&fields=${fields}&pageSize=1000`
  )
  if (!ok || !data) return null

  const files = []
  const folders = []
  for (const f of (data.files ?? [])) {
    if (f.mimeType === DRIVE_FOLDER_MIME) {
      folders.push({ driveId: f.id, name: f.name, lastModified: f.modifiedTime })
    } else {
      files.push({
        driveId: f.id,
        name: f.name,
        kind: driveKind(f.mimeType),
        size: f.size ? Number(f.size) : null,
        lastModified: f.modifiedTime,
        viewUrl: `https://drive.google.com/file/d/${f.id}/view`,
        previewUrl: `https://drive.google.com/file/d/${f.id}/preview`,
      })
    }
  }

  // Conteo de items por subcarpeta (cap a 30 para no explotar en llamadas)
  if (withCounts && folders.length > 0 && folders.length <= 30) {
    const counts = await Promise.all(folders.map(fo => countDriveFolder(fo.driveId)))
    folders.forEach((fo, i) => { fo.count = counts[i] })
  }

  return { files, folders }
}

/** GET — el cliente pregunta si su usuario tiene rol admin (para mostrar la UI) */
app.get('/api/admin/check', requireAuthApi, async (req, res) => {
  res.json({ ok: await isAdminUser(req) })
})

/** DELETE — admin borra CUALQUIER archivo del vault (sin requerir ownership) */
app.delete('/api/admin/file', requireAuthApi, requireAdmin, async (req, res) => {

  const rawKey = req.body.key
  const key    = sanitizeKey(rawKey)
  log('DELETE', '/api/admin/file', key)

  if (!key) return res.status(400).json({ error: 'key inválido' })
  if (typeof rawKey === 'string' && (rawKey.startsWith('_meta/') || rawKey === 'index.json'))
    return res.status(403).json({ error: 'No se puede eliminar archivos internos del sistema' })

  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
    // Limpiar el registro de uploads si existe
    const uploads = await readMeta('_meta/uploads.json')
    if (uploads[rawKey]) { delete uploads[rawKey]; await writeMeta('_meta/uploads.json', uploads) }
    await updateIndex()
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

/** POST — agrega una carpeta de Drive a una materia (solo admin) */
app.post('/api/drive-link', requireAuthApi, requireAdmin, async (req, res) => {

  const uni     = sanitizePath(req.body.university)
  const career  = sanitizePath(req.body.career)
  const subject = sanitizePath(req.body.subject)
  const name    = (typeof req.body.name === 'string' ? req.body.name : '').trim().slice(0, 120)
  const url     = (typeof req.body.url === 'string' ? req.body.url : '').trim()

  log('POST', '/api/drive-link', `${uni}/${career}/${subject} — ${name}`)

  if (!uni || !career || !subject) return res.status(400).json({ error: 'university, career y subject son requeridos' })
  if (!name)         return res.status(400).json({ error: 'Falta el nombre de la carpeta' })
  if (!isDriveUrl(url)) return res.status(400).json({ error: 'El link debe ser de Google Drive' })

  try {
    const links = await readMeta('_meta/drive-links.json')
    const pathKey = `${uni}/${career}/${subject}`
    if (!links[pathKey]) links[pathKey] = []
    const item = { id: randomBytes(8).toString('hex'), name, url, addedAt: new Date().toISOString() }
    links[pathKey].push(item)
    await writeMeta('_meta/drive-links.json', links)
    // Persistir la carpeta para que la materia no dependa solo del link
    await registerFolders({ careerPath: `${uni}/${career}`, subjectPath: pathKey, by: getAuth(req).userId })
    await updateIndex()
    res.json({ success: true, item })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

/**
 * POST — importa una carpeta de Drive de CARRERA completa (solo admin).
 * Cada subcarpeta del Drive se convierte en una materia con su Drive vinculado.
 * Reusa toda la maquinaria de links a nivel materia.
 */
app.post('/api/drive-career', requireAuthApi, requireAdmin, async (req, res) => {
  const { userId } = getAuth(req)
  const uni    = sanitizePath(req.body.university)
  const career = sanitizePath(req.body.career)
  const url    = (typeof req.body.url === 'string' ? req.body.url : '').trim()
  log('POST', '/api/drive-career', `${uni}/${career} — ${url}`)

  if (!uni || !career)  return res.status(400).json({ error: 'university y career son requeridos' })
  if (!isDriveUrl(url))  return res.status(400).json({ error: 'El link debe ser de Google Drive' })

  const folderId = extractFolderId(url)
  if (!folderId) return res.status(400).json({ error: 'No se pudo extraer el ID de carpeta. Usá un link del tipo: drive.google.com/drive/folders/...' })

  if (!process.env.GOOGLE_API_KEY)
    return res.status(503).json({ error: 'El servidor no tiene Google API key configurada. Agregá GOOGLE_API_KEY en las variables de entorno de Vercel.' })

  try {
    // Intentar leer la carpeta con la Drive API
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`)
    const fields = encodeURIComponent('files(id,name,mimeType,modifiedTime)')
    const { ok, data, status: apiStatus, apiError } = await driveApiFetch(
      `files?q=${q}&fields=${fields}&pageSize=1000`
    )

    if (!ok) {
      let hint = ''
      if (apiStatus === 403 || apiStatus === 404)
        hint = 'Asegurate de que la carpeta esté compartida como "Cualquiera con el enlace puede ver" en Google Drive (Compartir → cambiar de "Restringido" a "Cualquiera con el enlace").'
      else if (apiStatus === 0)
        hint = 'Error de red al contactar la Drive API.'
      else
        hint = `Error de Drive API: ${apiError}`
      return res.status(503).json({ error: hint })
    }

    const subFolders = (data.files ?? []).filter(f => f.mimeType === DRIVE_FOLDER_MIME)
    if (subFolders.length === 0)
      return res.status(400).json({ error: 'La carpeta no tiene subcarpetas visibles. Para una sola materia usá "Agregar carpeta de Drive" dentro de la materia.' })

    const links = await readMeta('_meta/drive-links.json')
    const created = [], skipped = []
    for (const fo of subFolders) {
      const subjectName = sanitizePath(fo.name)
      if (!subjectName) continue
      const pathKey = `${uni}/${career}/${subjectName}`
      const subUrl  = `https://drive.google.com/drive/folders/${fo.id}`
      if (!links[pathKey]) links[pathKey] = []
      if (links[pathKey].some(l => l.url === subUrl)) { skipped.push(subjectName); continue }  // ya importada
      links[pathKey].push({ id: randomBytes(8).toString('hex'), name: fo.name, url: subUrl, addedAt: new Date().toISOString(), group: folderId })
      created.push(subjectName)
    }
    await writeMeta('_meta/drive-links.json', links)

    // Persistir todas las materias creadas en folders.json de una sola vez
    const folders = await readFolders()
    const now = new Date().toISOString()
    if (!folders.careers[`${uni}/${career}`]) folders.careers[`${uni}/${career}`] = { by: userId, at: now }
    for (const s of created) if (!folders.subjects[`${uni}/${career}/${s}`]) folders.subjects[`${uni}/${career}/${s}`] = { by: userId, at: now }
    await writeMeta('_meta/folders.json', folders)

    await updateIndex()
    res.json({ success: true, created: created.length, skipped: skipped.length, materias: created })
  } catch (err) { console.error('[drive-career]', err.message); res.status(500).json({ error: err.message }) }
})

/** DELETE — elimina una carpeta de Drive por id (solo admin) */
app.delete('/api/drive-link', requireAuthApi, requireAdmin, async (req, res) => {

  const uni     = sanitizePath(req.body.university)
  const career  = sanitizePath(req.body.career)
  const subject = sanitizePath(req.body.subject)
  const id      = typeof req.body.id === 'string' ? req.body.id : ''
  log('DELETE', '/api/drive-link', `${uni}/${career}/${subject} — ${id}`)

  if (!uni || !career || !subject || !id) return res.status(400).json({ error: 'Parámetros incompletos' })

  try {
    const links = await readMeta('_meta/drive-links.json')
    const pathKey = `${uni}/${career}/${subject}`
    if (links[pathKey]) {
      links[pathKey] = links[pathKey].filter(l => l.id !== id)
      if (links[pathKey].length === 0) delete links[pathKey]
      await writeMeta('_meta/drive-links.json', links)
      await updateIndex()
    }
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

/**
 * Paso 1 — Genera una URL prefirmada para subir DIRECTO a R2.
 * El archivo no pasa por Vercel, evitando el límite de 4.5 MB de las functions.
 */
app.post('/api/upload-url', uploadLimiter, requireAuthApi, async (req, res) => {
  const { userId } = getAuth(req)
  const uni     = sanitizePath(req.body.university)
  const career  = sanitizePath(req.body.career)
  const subject = sanitizePath(req.body.subject)
  const filename = typeof req.body.filename === 'string' ? req.body.filename : ''
  const size = Number(req.body.size) || 0

  log('POST', '/api/upload-url', `${uni}/${career}/${subject} — ${filename} (user: ${userId})`)

  if (!uni || !career || !subject) return res.status(400).json({ error: 'university, career y subject son requeridos' })
  if (!filename)                   return res.status(400).json({ error: 'filename requerido' })
  if (size > 50 * 1024 * 1024)     return res.status(413).json({ error: 'El archivo supera el máximo de 50 MB' })

  const clean = cleanFileName(filename)
  const ext = clean.match(/\.\w+$/)?.[0]?.toLowerCase() ?? ''
  const contentType = EXT_TO_MIME[ext]
  if (!contentType) return res.status(415).json({ error: `Tipo de archivo no permitido (${ext || 'sin extensión'})` })

  const key = `${uni}/${career}/${subject}/${clean}`

  try {
    const cmd = new PutObjectCommand({
      Bucket: BUCKET, Key: key, ContentType: contentType,
      Metadata: { 'uploader-id': userId, 'university': uni, 'career': career, 'subject': subject },
    })
    const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 300 }) // 5 min
    res.json({ uploadUrl, key, name: clean, contentType })
  } catch (err) {
    console.error('[upload-url]', err.message)
    res.status(500).json({ error: 'No se pudo generar la URL de subida' })
  }
})

/**
 * Paso 3 — Confirma que el archivo se subió a R2 y lo registra.
 */
app.post('/api/confirm-upload', requireAuthApi, async (req, res) => {
  const { userId } = getAuth(req)
  const key = sanitizeKey(req.body.key)
  log('POST', '/api/confirm-upload', `${key} (user: ${userId})`)
  if (!key) return res.status(400).json({ error: 'key inválido' })

  try {
    // Verificar que el objeto existe realmente en R2
    const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
    const size = head.ContentLength ?? 0

    // ── Validar el contenido REAL por magic-bytes ──
    // El PUT prefirmado va directo a R2 sin pasar por el server, así que recién acá
    // podemos inspeccionar las firmas. Si no coincide con la extensión, se borra.
    const ext = key.includes('.') ? '.' + key.split('.').pop().toLowerCase() : ''
    const declaredMime = EXT_TO_MIME[ext]
    if (!declaredMime) {
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key })).catch(() => {})
      return res.status(415).json({ error: 'Tipo de archivo no permitido' })
    }
    try {
      const part = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key, Range: 'bytes=0-4099' }))
      const chunks = []; for await (const c of part.Body) chunks.push(c)
      const check = await validateMagicBytes(Buffer.concat(chunks), declaredMime)
      if (!check.valid) {
        await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key })).catch(() => {})
        return res.status(415).json({ error: `Archivo rechazado: ${check.reason}` })
      }
    } catch (e) {
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key })).catch(() => {})
      return res.status(400).json({ error: 'No se pudo verificar el archivo subido. Reintentá.' })
    }

    await readMeta('_meta/uploads.json').then(data => {
      data[key] = { uploaderId: userId, uploadedAt: new Date().toISOString() }
      return writeMeta('_meta/uploads.json', data)
    })

    // Persistir la carpeta para que borrar el archivo no elimine la materia
    const [fu, fc, fs] = key.split('/')
    if (fu && fc && fs) await registerFolders({ careerPath: `${fu}/${fc}`, subjectPath: `${fu}/${fc}/${fs}`, by: userId })

    await updateIndex()

    res.json({ success: true, key, name: key.split('/').pop(), size })
  } catch (err) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404)
      return res.status(404).json({ error: 'El archivo no se encontró en el almacenamiento. Reintentá la subida.' })
    console.error('[confirm-upload]', err.message)
    res.status(500).json({ error: err.message })
  }
})

/** Upload directo (legacy) — solo para archivos < 4.5 MB. Requiere auth Clerk. */
app.post(
  '/api/upload',
  uploadLimiter,
  requireAuthApi,  // 401 JSON si no hay JWT válido
  upload.single('file'),
  async (req, res) => {
    const { userId } = getAuth(req)              // userId del JWT verificado

    const uni     = sanitizePath(req.body.university)
    const career  = sanitizePath(req.body.career)
    const subject = sanitizePath(req.body.subject)

    log('POST', '/api/upload', `${uni}/${career}/${subject} — ${req.file?.originalname} (user: ${userId})`)

    if (!req.file)                   return res.status(400).json({ error: 'No se recibió archivo' })
    if (!uni || !career || !subject) return res.status(400).json({ error: 'university, career y subject son requeridos' })

    // Validación de magic bytes — rechaza si el tipo real no coincide con el declarado
    const magicCheck = await validateMagicBytes(req.file.buffer, req.file.mimetype)
    if (!magicCheck.valid) {
      return res.status(415).json({ error: magicCheck.reason })
    }

    const { buffer, mimetype, ext } = await compressFile(req.file.buffer, req.file.mimetype, req.file.originalname)

    // Nombre limpio — preserva español, reemplaza resto; limitado a 100 chars base
    const baseName = req.file.originalname
      .normalize('NFC')
      .replace(/\.\w+$/, '')
      .replace(/[^\w.\- áéíóúÁÉÍÓÚñÑüÜ]/g, '_')
      .slice(0, 100)
    const clean = baseName + ext

    const key = `${uni}/${career}/${subject}/${clean}`

    try {
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET, Key: key, Body: buffer, ContentType: mimetype,
        Metadata: {
          'uploaded-at': new Date().toISOString(),
          'university': uni, 'career': career, 'subject': subject,
          'uploader-id': userId,                 // userId de Clerk (verificado)
        },
      }))

      // Registrar upload y actualizar índice (background)
      readMeta('_meta/uploads.json').then(data => {
        data[key] = { uploaderId: userId, uploadedAt: new Date().toISOString() }
        return writeMeta('_meta/uploads.json', data)
      }).catch(console.error)

      updateIndex()
      res.json({ success: true, key, name: clean, size: buffer.length })
    } catch (err) { res.status(500).json({ error: err.message }) }
  }
)

/** Delete — requiere autenticación Clerk y ownership */
app.delete(
  '/api/files',
  deleteLimiter,
  requireAuthApi,  // 401 JSON si no hay JWT válido
  async (req, res) => {
    const { userId } = getAuth(req)             // userId del JWT verificado

    const rawKey = req.body.key
    const key    = sanitizeKey(rawKey)
    log('DELETE', '/api/files', `${key} (user: ${userId})`)

    if (!key) return res.status(400).json({ error: 'key inválido' })

    // Protección extra: nunca borrar archivos internos
    if (rawKey.startsWith('_meta/') || rawKey === 'index.json') {
      return res.status(403).json({ error: 'No se puede eliminar archivos internos del sistema' })
    }

    try {
      const uploads = await readMeta('_meta/uploads.json')
      const record  = uploads[rawKey]

      if (!record) return res.status(403).json({ error: 'No se encontró el registro de este archivo' })

      // Verificar ownership usando el userId de Clerk (no un device ID del body)
      if (record.uploaderId !== userId) {
        return res.status(403).json({ error: 'No tenés permiso para eliminar este archivo' })
      }

      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))

      // Limpiar el registro
      delete uploads[rawKey]
      await writeMeta('_meta/uploads.json', uploads)
      updateIndex()

      res.json({ success: true })
    } catch (err) { res.status(500).json({ error: err.message }) }
  }
)

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
    // No exponer user IDs — solo confirmar qué archivos tienen registro
    const safe = {}
    for (const [k, v] of Object.entries(data)) {
      safe[k] = { uploadedAt: v.uploadedAt }
    }
    res.json(safe)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

/** Verificar si el usuario autenticado es dueño de un archivo */
app.post(
  '/api/verify-owner',
  requireAuthApi,
  async (req, res) => {
    const { userId } = getAuth(req)
    const key = sanitizeKey(req.body.key)
    if (!key) return res.json({ isOwner: false })

    try {
      const data   = await readMeta('_meta/uploads.json')
      const record = data[req.body.key]
      res.json({ isOwner: !!(record && record.uploaderId === userId) })
    } catch { res.json({ isOwner: false }) }
  }
)

// ── 401 handler para requireAuth ──────────────────────────────────────────
app.get('/unauthorized', (_req, res) => {
  res.status(401).json({ error: 'Autenticación requerida' })
})

// ── Error handler global ──────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  if (err.message?.includes('CORS')) return res.status(403).json({ error: err.message })
  if (err.message?.includes('Tipo no permitido')) return res.status(415).json({ error: err.message })
  // Clerk auth errors
  if (err.status === 401 || err.name === 'SignedOutAuthObject') {
    return res.status(401).json({ error: 'Autenticación requerida' })
  }
  console.error('[error]', err.message)
  res.status(500).json({ error: 'Error interno del servidor' })
})

// ── Start (solo en desarrollo local, no en Vercel serverless) ────────────
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n✅ Server → http://localhost:${PORT}`)
    console.log(`   Bucket : ${BUCKET ?? '⚠️  CF_R2_BUCKET_NAME no configurado'}`)
    console.log(`   CORS   : ${ALLOWED.join(', ')}`)
    if (!process.env.CF_R2_ACCESS_KEY_ID)     console.warn('   ⚠️  CF_R2_ACCESS_KEY_ID no configurado')
    if (!process.env.CF_R2_SECRET_ACCESS_KEY) console.warn('   ⚠️  CF_R2_SECRET_ACCESS_KEY no configurado')
    if (!process.env.CLERK_SECRET_KEY)        console.warn('   ⚠️  CLERK_SECRET_KEY no configurado')
  })
}

export default app
