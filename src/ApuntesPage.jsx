import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Search, ArrowLeft, Star, Bookmark, BookmarkCheck,
  Download, ChevronRight, FolderOpen, FolderPlus,
  FileText, AlertCircle, Loader, Upload, Plus,
  X, Check, FileUp, Trash2, Lock, ExternalLink, Bug, Pencil,
} from 'lucide-react'
import { useAuth, useUser, SignInButton } from '@clerk/react'
import { UNIVERSITIES, FACULTIES } from './universities.js'
import { getDeviceId, getPoints, addPoints, markOwned, isOwned, unmarkOwned } from './device.js'
import { compressImage } from './compress.js'
import PreviewModal from './PreviewModal.jsx'
import './PreviewModal.css'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3002/api'

// ── Reporte de bugs por email ───────────────────────────────────────────────
export const REPORT_EMAIL = 'apuntesargentina@gmail.com'
export const reportBugHref = (ctx = '') => {
  const subject = 'Reporte de error — ApuntesArgentina'
  const body = [
    'Contanos qué pasó (cuanto más detalle, mejor):',
    '',
    '• Qué estabas haciendo:',
    '• Qué esperabas que pasara:',
    '• Qué pasó en realidad:',
    '',
    ctx ? `Ubicación: ${ctx}` : '',
    `Navegador: ${typeof navigator !== 'undefined' ? navigator.userAgent : ''}`,
  ].join('\n')
  return `mailto:${REPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

// ── localStorage helpers ───────────────────────────────────────────────────
const loadFavs = () => { try { return JSON.parse(localStorage.getItem('aa-favorites') ?? '{"unis":[],"subjects":[]}') } catch { return { unis: [], subjects: [] } } }
const saveFavs = f => { try { localStorage.setItem('aa-favorites', JSON.stringify(f)) } catch {} }
const hasVoted  = k => { try { return !!JSON.parse(localStorage.getItem('aa-votes') ?? '{}')[k] } catch { return false } }
const markVoted = k => { try { const v = JSON.parse(localStorage.getItem('aa-votes') ?? '{}'); v[k] = true; localStorage.setItem('aa-votes', JSON.stringify(v)) } catch {} }

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = b => !b ? '' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(1) + ' MB'
const relDate = d => { if (!d) return ''; const s = (Date.now() - new Date(d)) / 1000; if (s < 3600) return 'hace ' + Math.floor(s / 60) + ' min'; if (s < 86400) return 'hace ' + Math.floor(s / 3600) + 'h'; if (s < 604800) return 'hace ' + Math.floor(s / 86400) + 'd'; return new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) }
const fileExt  = n => (n?.split('.').pop()?.toUpperCase() ?? 'FILE')

// Hace que un elemento clickeable (div) se active también con Enter/Espacio (teclado)
const activateOnKey = onActivate => e => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate() }
}

// Logo oficial de Google Drive (a color)
const DriveIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
    <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
    <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
    <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
    <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
    <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
  </svg>
)

// ── Texto que se desliza suavemente si es muy largo (nombres de materias/apuntes) ──
function MarqueeText({ text, className = '' }) {
  const wrap = useRef(null)
  const inner = useRef(null)
  const [shift, setShift] = useState(0)
  useEffect(() => {
    const measure = () => {
      if (!wrap.current || !inner.current) return
      const diff = inner.current.scrollWidth - wrap.current.clientWidth
      setShift(diff > 4 ? diff : 0)
    }
    measure()
    const t = setTimeout(measure, 350)              // tras montar + animaciones de entrada
    window.addEventListener('resize', measure)
    return () => { clearTimeout(t); window.removeEventListener('resize', measure) }
  }, [text])
  return (
    <span ref={wrap} className={`ap-mq ${className}`} title={text}>
      <span ref={inner} className={shift ? 'ap-mq-run' : ''}
        style={shift ? { '--mq-shift': `-${shift}px`, '--mq-dur': `${Math.max(5, shift / 16)}s` } : undefined}>
        {text}
      </span>
    </span>
  )
}

// ── Stars ──────────────────────────────────────────────────────────────────
function Stars({ avg = 0, count = 0 }) {
  return (
    <span className="ap-stars">
      {[1,2,3,4,5].map(n => (
        <Star key={n} size={12} fill={n <= Math.round(avg) ? 'currentColor' : 'none'}
          className={n <= Math.round(avg) ? 'ap-s-on' : 'ap-s-off'} />
      ))}
      {count > 0 && <span className="ap-s-cnt">({count})</span>}
    </span>
  )
}

function RateRow({ fileKey, onRate, voted }) {
  const [hover, setHover] = useState(0)
  if (voted) return <span className="ap-voted">Ya puntuaste este apunte</span>
  return (
    <span className="ap-rate-row">
      <span className="ap-rate-lbl">Puntuar:</span>
      {[1,2,3,4,5].map(n => (
        <button key={n} className="ap-rate-star"
          aria-label={`Puntuar con ${n} estrella${n > 1 ? 's' : ''}`}
          onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
          onClick={() => onRate(fileKey, n)}>
          <Star size={13} fill={hover >= n ? 'currentColor' : 'none'}
            className={hover >= n ? 'ap-s-on' : 'ap-s-off'} />
        </button>
      ))}
    </span>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// UNIVERSITY SELECTOR
// ══════════════════════════════════════════════════════════════════════════
function UniSelector({ onSelect, onBack, favUnis, treeUnis }) {
  const [q, setQ] = useState('')
  const ref = useRef(null)
  useEffect(() => ref.current?.focus(), [])

  const list = UNIVERSITIES.filter(u => {
    if (!q) return true
    const s = q.toLowerCase()
    return u.name.toLowerCase().includes(s) || u.full.toLowerCase().includes(s) || u.province.toLowerCase().includes(s)
  })

  return (
    <div className="ap-unisel">
      <div className="ap-unisel-head">
        <button className="ap-btn-back-inv" onClick={onBack}><ArrowLeft size={16} /> Inicio</button>
        <div>
          <h1 className="ap-unisel-h1">¿De qué universidad sos?</h1>
          <p className="ap-unisel-p">Buscá por nombre, sigla o provincia</p>
        </div>
      </div>

      <div className="ap-unisel-sticky">
        <div className="ap-unisel-box">
          <Search size={17} className="ap-unisel-sicon" />
          <input ref={ref} className="ap-unisel-inp"
            placeholder="Ej: UBA, Córdoba, Ingeniería, Tucumán…"
            value={q} onChange={e => setQ(e.target.value)} />
          {q && <button className="ap-unisel-x" aria-label="Borrar búsqueda" onClick={() => { setQ(''); ref.current?.focus() }}><X size={15}/></button>}
        </div>
        <p className="ap-unisel-hint">{list.length} universidad{list.length !== 1 ? 'es' : ''}{q ? ` · "${q}"` : ''}</p>
      </div>

      <div className="ap-unisel-body">
        {!q && favUnis.length > 0 && (
          <section className="ap-unisel-sec">
            <p className="ap-unisel-lbl">Mis favoritas</p>
            <div className="ap-unisel-grid">
              {UNIVERSITIES.filter(u => favUnis.includes(u.name)).map(u =>
                <UCard key={u.id} u={u} live={treeUnis.includes(u.name)} onSelect={onSelect} fav />)}
            </div>
          </section>
        )}
        <section className="ap-unisel-sec">
          {!q && <p className="ap-unisel-lbl">Todas</p>}
          {list.length === 0
            ? <p className="ap-unisel-none">Sin resultados. <button onClick={() => setQ('')}>Ver todas</button></p>
            : <div className="ap-unisel-grid">
                {list.map((u, i) => (
                  <motion.div key={u.id} initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ delay: Math.min(i * 0.012, 0.25) }}>
                    <UCard u={u} live={treeUnis.includes(u.name)} onSelect={onSelect} />
                  </motion.div>
                ))}
              </div>
          }
        </section>
      </div>
    </div>
  )
}

function UCard({ u, live, onSelect, fav }) {
  return (
    <motion.button className={`ap-ucard${fav?' ap-ucard--fav':''}${live?' ap-ucard--live':''}`}
      onClick={() => onSelect(u.name)} whileHover={{ y:-3, boxShadow:'0 8px 24px rgba(35,53,92,0.13)' }} transition={{ duration:0.14 }}>
      <div className="ap-ucard-logo">
        {u.logo
          ? <img src={u.logo} alt={u.name} className="ap-ucard-img" loading="lazy" decoding="async" onError={e => { e.currentTarget.style.display='none'; e.currentTarget.nextSibling.style.display='flex' }}/>
          : null}
        <span className="ap-ucard-badge" style={{ background: u.color, display: u.logo ? 'none' : 'flex' }}>{u.name}</span>
      </div>
      <div className="ap-ucard-info">
        <b className="ap-ucard-name">{u.name}</b>
        <MarqueeText className="ap-ucard-full" text={u.full} />
        <span className="ap-ucard-prov">{u.province}{live && <span className="ap-live-dot" title="Tiene apuntes"/>}</span>
      </div>
    </motion.button>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════
export default function ApuntesPage({ onBack }) {
  const [uni,      setUni]      = useState(null)
  const [career,   setCareer]   = useState(null)
  const [subject,  setSubject]  = useState(null)
  const [tree,     setTree]     = useState({ universities:[], careers:{}, subjects:{} })
  const [files,    setFiles]    = useState([])
  const [ratings,  setRatings]  = useState({})
  const [uploads,  setUploads]  = useState({})  // key → { uploaderId }
  const [favs,     setFavs]     = useState(loadFavs)
  const [treeLoad, setTreeLoad] = useState(true)
  const [filesLoad,setFilesLoad]= useState(false)
  const [creating, setCreating] = useState(null)
  const [newName,  setNewName]  = useState('')
  const [queue,    setQueue]    = useState([])
  const [drag,     setDrag]     = useState(false)
  const [ratingKey,setRatingKey]= useState(null)
  const [search,   setSearch]   = useState('')
  const [points,   setPoints]   = useState(getPoints)
  const [pointsAnim, setPointsAnim] = useState(null)
  const [preview,  setPreview]  = useState(null)   // file object to preview
  const [driveForm, setDriveForm] = useState(null)  // { name, url } | null cuando se está agregando
  const [careerImport, setCareerImport] = useState(null)  // { url } | null — importar carrera completa de Drive
  const [importing, setImporting] = useState(false)
  const [drivePath, setDrivePath] = useState([])    // navegación dentro de carpetas de Drive: [{driveId, folderId, name}]
  const [myFolders, setMyFolders] = useState({ careers: [], subjects: [] })  // carpetas creadas por mí (puedo renombrarlas)
  const { isSignedIn, getToken } = useAuth()
  const { user } = useUser()
  // Admin = usuario de Clerk con rol 'admin' en su metadata pública
  const isAdmin = user?.publicMetadata?.role === 'admin'
  const deviceId = getDeviceId()
  const fileRef   = useRef(null)
  const createRef = useRef(null)

  // Bootstrap
  useEffect(() => {
    const okJson = (fallback) => (r) => (r.ok ? r.json() : fallback)
    Promise.all([
      fetch(`${API}/tree`).then(okJson({ universities:[], careers:{}, subjects:{} })).catch(() => ({ universities:[], careers:{}, subjects:{} })),
      fetch(`${API}/ratings`).then(okJson({})).catch(() => ({})),
      fetch(`${API}/uploads`).then(okJson({})).catch(() => ({})),
    ]).then(([t, r, u]) => {
      // Garantiza la forma esperada aunque el backend devuelva algo inesperado
      setTree(t && Array.isArray(t.universities) ? t : { universities:[], careers:{}, subjects:{} })
      setRatings(r && typeof r === 'object' ? r : {})
      setUploads(u && typeof u === 'object' ? u : {})
    }).finally(() => setTreeLoad(false))
  }, [])

  // Load files — nivel materia (drivePath vacío) o dentro de una carpeta de Drive
  useEffect(() => {
    if (!uni || !career || !subject) { setFiles([]); return }
    setFilesLoad(true)
    const inDrive = drivePath.length > 0
    const url = inDrive
      ? `${API}/drive-folder?id=${encodeURIComponent(drivePath[drivePath.length - 1].driveId)}&folderId=${encodeURIComponent(drivePath[drivePath.length - 1].folderId)}&sig=${encodeURIComponent(drivePath[drivePath.length - 1].sig ?? '')}`
      : `${API}/files?university=${encodeURIComponent(uni)}&career=${encodeURIComponent(career)}&subject=${encodeURIComponent(subject)}`
    ;(async () => {
      try {
        // Mandar el JWT para que el servidor marque qué archivos son míos (owned)
        const token = isSignedIn ? await getToken() : null
        const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        const d = await res.json()
        setFiles(Array.isArray(d) ? d : [])
      } catch { setFiles([]) }
      finally { setFilesLoad(false) }
    })()
  }, [uni, career, subject, drivePath, isSignedIn])

  // Mis carpetas (las que creé) — para mostrar el botón de renombrar
  const refreshMyFolders = async () => {
    if (!isSignedIn) { setMyFolders({ careers: [], subjects: [] }); return }
    try {
      const token = await getToken()
      const res = await fetch(`${API}/my-folders`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (res.ok) setMyFolders(await res.json())
    } catch {}
  }
  useEffect(() => { refreshMyFolders() }, [isSignedIn])

  // Focus create input
  useEffect(() => { if (creating) createRef.current?.focus() }, [creating])

  // ── Navigation ────────────────────────────────────────────────────────
  const goUni = name => { setUni(name); setCareer(null); setSubject(null); setQueue([]); setCreating(null); setDrivePath([]) }
  const goCareer = c => { setCareer(c); setSubject(null); setQueue([]); setCreating(null); setDrivePath([]) }
  const goSubject = s => { setSubject(s); setQueue([]); setCreating(null); setDrivePath([]) }
  // Volver al nivel de carreras de la universidad actual (desde la ruta)
  const goToUniRoot = () => { setCareer(null); setSubject(null); setDrivePath([]); setCreating(null); setQueue([]) }

  // Navegación dentro de carpetas de Drive
  const enterDriveFolder = item => setDrivePath(p => [...p, { driveId: item.driveId, folderId: item.folderId, name: item.name, sig: item.sig }])
  const goDriveLevel = idx => setDrivePath(p => p.slice(0, idx))  // idx = cuántos niveles dejar
  const goBack = () => {
    if (subject)       { setSubject(null); setCreating(null) }
    else if (career)   { setCareer(null);  setCreating(null) }
    else               { setUni(null) }
  }

  // ── Create folder ─────────────────────────────────────────────────────
  const confirmCreate = () => {
    if (!isSignedIn) return   // defensa extra: solo logueados crean carreras/materias
    const name = newName.trim()
    if (!name) return
    const isCareer = creating === 'career'
    if (isCareer) {
      setTree(prev => ({
        ...prev,
        careers: { ...prev.careers, [uni]: [...(prev.careers[uni] ?? []).filter(c => c !== name), name] },
        subjects: { ...prev.subjects, [uni]: { ...(prev.subjects[uni] ?? {}), [name]: [] } },
      }))
      setCareer(name)
    } else {
      setTree(prev => ({
        ...prev,
        subjects: {
          ...prev.subjects,
          [uni]: { ...(prev.subjects[uni] ?? {}), [career]: [...((prev.subjects[uni]?.[career]) ?? []).filter(s => s !== name), name] },
        },
      }))
      setSubject(name)
    }
    // Persistir la carpeta en el backend para que sobreviva refresh y borrado de archivos
    ;(async () => {
      try {
        const body = isCareer
          ? { university: uni, career: name }
          : { university: uni, career, subject: name }
        const res = await fetch(`${API}/folder`, { method: 'POST', headers: await adminHeaders(), body: JSON.stringify(body) })
        if (!res.ok) console.error('No se pudo persistir la carpeta:', (await res.json().catch(() => ({}))).error)
      } catch (err) { console.error('Error persistiendo carpeta:', err.message) }
    })()
    setNewName(''); setCreating(null)
  }

  // ── Upload ────────────────────────────────────────────────────────────
  const addFiles = fs => {
    const entries = Array.from(fs).map(f => ({ id: Math.random().toString(36).slice(2), file: f, status: 'pending', progress: 0, error: null }))
    setQueue(prev => [...prev, ...entries])
  }

  // Lee error JSON, o da mensaje claro si el server/proxy devolvió texto (ej. 413 de Vercel)
  const readErr = async res => {
    const txt = await res.text()
    try { return JSON.parse(txt).error || txt }
    catch { return res.status === 413 ? 'El archivo es demasiado grande.' : `Error ${res.status}. Intentá de nuevo.` }
  }

  const uploadOne = async entry => {
    if (!isSignedIn) {
      setQueue(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'error', error: 'Iniciá sesión para subir apuntes' } : e))
      return
    }
    if (entry.file.size > 50 * 1024 * 1024) {
      setQueue(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'error', error: 'Máximo 50 MB por archivo' } : e))
      return
    }
    setQueue(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'uploading', progress: 8 } : e))
    const setProg = p => setQueue(prev => prev.map(e => e.id === entry.id ? { ...e, progress: p } : e))
    try {
      const token = await getToken()
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}

      // Optimización: comprimir imágenes en el navegador antes de subir (el archivo
      // va directo a R2, así que es el único lugar donde se puede optimizar).
      const file = await compressImage(entry.file)

      // Paso 1: URL prefirmada (request chico, sin el archivo)
      const urlRes = await fetch(`${API}/upload-url`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ university: uni, career, subject, filename: file.name, size: file.size }),
      })
      if (!urlRes.ok) throw new Error(await readErr(urlRes))
      const { uploadUrl, key, name, contentType } = await urlRes.json()
      setProg(20)

      // Paso 2: PUT directo a R2 (con progreso real)
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', contentType)
        xhr.upload.onprogress = ev => { if (ev.lengthComputable) setProg(20 + Math.round((ev.loaded / ev.total) * 70)) }
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new Error('No se pudo subir el archivo al almacenamiento'))
        xhr.onerror = () => reject(new Error('Error de red al subir el archivo'))
        xhr.send(file)
      })
      setProg(92)

      // Paso 3: confirmar y registrar
      const confRes = await fetch(`${API}/confirm-upload`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      })
      if (!confRes.ok) throw new Error(await readErr(confRes))
      const data = await confRes.json()

      setQueue(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'done', progress: 100 } : e))
      setFiles(prev => [...prev, { key: data.key, name: data.name || name, size: data.size, lastModified: new Date(), owned: true }])
      setUploads(prev => ({ ...prev, [data.key]: { uploaderId: deviceId } }))
      markOwned(data.key)
      setPoints(addPoints(5))
      setPointsAnim('+5 pts')
      setTimeout(() => setPointsAnim(null), 2000)
    } catch (err) {
      setQueue(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'error', error: err.message } : e))
    }
  }

  const uploadAll = () => queue.filter(e => e.status === 'pending').forEach(uploadOne)

  // ── Delete (solo propios) ─────────────────────────────────────────────
  const deleteFile = async key => {
    if (!isSignedIn) { alert('Iniciá sesión para eliminar archivos.'); return }
    if (!window.confirm('¿Eliminar este archivo del vault?')) return
    try {
      const token = await getToken()
      const res = await fetch(`${API}/files`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ key, uploaderId: deviceId }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      setFiles(prev => prev.filter(f => f.key !== key))
      setUploads(prev => { const n = { ...prev }; delete n[key]; return n })
      unmarkOwned(key)
    } catch (err) { alert('No se pudo eliminar: ' + err.message) }
  }

  // ── Carpetas de Drive (admin) ─────────────────────────────────────────
  // Las requests de admin se autentican con el JWT de Clerk (Authorization Bearer).
  const adminHeaders = async () => {
    const token = await getToken()
    return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  }

  const addDriveLink = async () => {
    const name = (driveForm?.name || '').trim()
    const url  = (driveForm?.url || '').trim()
    if (!name || !url) return
    try {
      const res = await fetch(`${API}/drive-link`, {
        method: 'POST',
        headers: await adminHeaders(),
        body: JSON.stringify({ university: uni, career, subject, name, url }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      const { item } = await res.json()
      setFiles(prev => [{ type: 'drive', id: item.id, name: item.name, url: item.url, lastModified: item.addedAt }, ...prev])
      setDriveForm(null)
    } catch (err) { alert('No se pudo agregar la carpeta: ' + err.message) }
  }

  // Importar una carrera completa: cada subcarpeta del Drive se vuelve una materia
  const importCareerDrive = async () => {
    const url = (careerImport?.url || '').trim()
    if (!url) return
    setImporting(true)
    try {
      const res = await fetch(`${API}/drive-career`, {
        method: 'POST',
        headers: await adminHeaders(),
        body: JSON.stringify({ university: uni, career, url }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      const data = await res.json()
      // Refrescar el árbol para que aparezcan todas las materias nuevas
      const t = await fetch(`${API}/tree`).then(r => r.json()).catch(() => null)
      if (t && Array.isArray(t.universities)) setTree(t)
      setCareerImport(null)
      alert(`✓ Se importaron ${data.created} materia(s)${data.skipped ? ` (${data.skipped} ya estaban)` : ''}.`)
    } catch (err) { alert('No se pudo importar la carrera: ' + err.message) }
    finally { setImporting(false) }
  }

  const deleteDriveLink = async id => {
    if (!window.confirm('¿Quitar esta carpeta de Drive de la materia?')) return
    try {
      const res = await fetch(`${API}/drive-link`, {
        method: 'DELETE',
        headers: await adminHeaders(),
        body: JSON.stringify({ university: uni, career, subject, id }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      setFiles(prev => prev.filter(f => f.id !== id && f.folderId !== id))
    } catch (err) { alert('No se pudo eliminar: ' + err.message) }
  }

  // Admin: borra cualquier archivo del vault (sin requerir ser el dueño)
  const adminDeleteFile = async key => {
    if (!window.confirm('¿Eliminar este archivo del vault? (admin)')) return
    try {
      const res = await fetch(`${API}/admin/file`, {
        method: 'DELETE',
        headers: await adminHeaders(),
        body: JSON.stringify({ key }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      setFiles(prev => prev.filter(f => f.key !== key))
      unmarkOwned(key)
    } catch (err) { alert('No se pudo eliminar: ' + err.message) }
  }

  // Admin: borra una carpeta vacía (no toca archivos ni links — el backend lo rechaza si tiene contenido)
  const deleteFolder = async folderName => {
    const isCareer = level === 'university'  // las cards a este nivel son carreras
    const tipo = isCareer ? 'carrera' : 'materia'
    if (!window.confirm(`¿Eliminar la ${tipo} "${folderName}"?\nSolo se puede si está vacía (sin archivos ni carpetas de Drive).`)) return
    try {
      const body = isCareer ? { university: uni, career: folderName } : { university: uni, career, subject: folderName }
      const res = await fetch(`${API}/folder`, { method: 'DELETE', headers: await adminHeaders(), body: JSON.stringify(body) })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      setTree(prev => {
        if (isCareer) {
          const careers = (prev.careers[uni] ?? []).filter(c => c !== folderName)
          const subj = { ...(prev.subjects[uni] ?? {}) }; delete subj[folderName]
          return { ...prev, careers: { ...prev.careers, [uni]: careers }, subjects: { ...prev.subjects, [uni]: subj } }
        }
        const subs = ((prev.subjects[uni]?.[career]) ?? []).filter(s => s !== folderName)
        return { ...prev, subjects: { ...prev.subjects, [uni]: { ...(prev.subjects[uni] ?? {}), [career]: subs } } }
      })
    } catch (err) { alert('No se pudo eliminar la carpeta: ' + err.message) }
  }

  // ¿Puede el usuario actual renombrar esta carpeta? (la creó, o es admin)
  const canEditFolder = folderName => {
    if (isAdmin) return true
    const path = level === 'university' ? `${uni}/${folderName}` : `${uni}/${career}/${folderName}`
    const list = level === 'university' ? myFolders.careers : myFolders.subjects
    return list.includes(path)
  }

  // Renombrar una carpeta propia (carrera o materia). El backend mueve archivos y metadatos.
  const renameFolder = async oldName => {
    const isCareer = level === 'university'
    const tipo = isCareer ? 'carrera' : 'materia'
    const input = window.prompt(`Nuevo nombre para la ${tipo} "${oldName}":`, oldName)
    if (input == null) return
    const newName = input.trim()
    if (!newName || newName === oldName) return
    try {
      const body = isCareer
        ? { university: uni, career: oldName, newName }
        : { university: uni, career, subject: oldName, newName }
      const res = await fetch(`${API}/folder/rename`, { method: 'POST', headers: await adminHeaders(), body: JSON.stringify(body) })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      // Refrescar árbol y mis carpetas desde el servidor (evita inconsistencias)
      const t = await fetch(`${API}/tree`).then(r => r.json()).catch(() => null)
      if (t && Array.isArray(t.universities)) setTree(t)
      refreshMyFolders()
    } catch (err) { alert('No se pudo renombrar: ' + err.message) }
  }

  // ── Rate ──────────────────────────────────────────────────────────────
  const rate = async (key, stars) => {
    if (hasVoted(key) || ratingKey) return
    setRatingKey(key)
    try {
      const res = await fetch(`${API}/ratings`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ key, stars }) })
      const updated = await res.json()
      setRatings(prev => ({ ...prev, [key]: updated }))
      markVoted(key)
    } finally { setRatingKey(null) }
  }

  // ── Bookmarks ─────────────────────────────────────────────────────────
  const toggleFavUni = () => setFavs(prev => { const n = { ...prev, unis: prev.unis.includes(uni) ? prev.unis.filter(u=>u!==uni) : [...prev.unis, uni] }; saveFavs(n); return n })
  const isSubFav = s => favs.subjects.some(x => x.uni===uni && x.career===career && x.subject===s)
  const toggleFavSub = s => setFavs(prev => {
    const k = `${uni}||${career}||${s}`
    const subjects = prev.subjects.some(x=>`${x.uni}||${x.career}||${x.subject}`===k) ? prev.subjects.filter(x=>`${x.uni}||${x.career}||${x.subject}`!==k) : [...prev.subjects, {uni,career,subject:s}]
    const n = { ...prev, subjects }; saveFavs(n); return n
  })

  // ── Computed ──────────────────────────────────────────────────────────
  const careers  = tree.careers?.[uni]  ?? []
  const subjects = tree.subjects?.[uni]?.[career] ?? []
  const uniData  = UNIVERSITIES.find(u => u.name === uni)
  const pending  = queue.filter(e => e.status === 'pending').length
  const visFiles = files.filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()))
  const inDrive  = drivePath.length > 0   // estamos navegando dentro de una carpeta de Drive
  // Carpetas de Drive vinculadas en esta materia (para que el admin las gestione)
  const linkedDrive = !inDrive
    ? Object.values(files.reduce((acc, f) => {
        if ((f.type === 'drive-folder' || f.type === 'drive-file' || f.type === 'drive') && f.folderId) {
          acc[f.folderId] = { id: f.folderId, name: f.source || f.name }
        }
        return acc
      }, {}))
    : []

  // ── Loading ───────────────────────────────────────────────────────────
  if (treeLoad) return (
    <div className="ap-loading"><Loader size={28} className="ap-spin"/><p>Cargando vault…</p></div>
  )

  // ── University selector ───────────────────────────────────────────────
  if (!uni) return (
    <UniSelector onSelect={goUni} onBack={onBack} favUnis={favs.unis} treeUnis={tree.universities} />
  )

  // ── Current level data ────────────────────────────────────────────────
  const level = subject ? 'subject' : career ? 'career' : 'university'

  const LEVEL_TITLE = {
    university: `Carreras en ${uni}`,
    career:     `Materias en ${career}`,
    subject:    subject,
  }

  const LEVEL_NEW_LABEL = {
    university: 'Nueva carrera',
    career:     'Nueva materia',
  }

  const suggestions = !career ? (FACULTIES[uni] ?? []) : []

  return (
    <>
    <div className="ap-root">

      {/* ── Header pegajoso: barra de acciones + ruta de navegación ── */}
      <div className="ap-header">

      {/* ── Top bar ── */}
      <div className="ap-bar">
        <button className="ap-btn-back" onClick={goBack}>
          <ArrowLeft size={16} />
          <span className="ap-btn-back-txt">{subject ? career : career ? uni : 'Universidades'}</span>
        </button>

        {/* Espaciador — empuja puntos y acciones a la derecha */}
        <div className="ap-bar-spacer" />

        {/* Points badge */}
        <div className="ap-points-wrap">
          <div className="ap-points-badge">
            <Star size={12} fill="currentColor" className="ap-pts-star" />
            <span>{points}<span className="ap-pts-unit"> pts</span></span>
          </div>
          <AnimatePresence>
            {pointsAnim && (
              <motion.span className="ap-points-anim"
                initial={{ opacity:1, y:0 }} animate={{ opacity:0, y:-28 }}
                exit={{ opacity:0 }} transition={{ duration:1.6, ease:'easeOut' }}>
                {pointsAnim}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* University logo + bookmark */}
        <div className="ap-bar-end">
          {uniData?.logo && <img src={uniData.logo} alt={uni} className="ap-bar-logo"
            onError={e => e.currentTarget.style.display='none'} />}
          <a className="ap-report-btn" href={reportBugHref(`${uni ?? ''}${career ? ' / ' + career : ''}${subject ? ' / ' + subject : ''}`)}
            title="Reportar un error o bug">
            <Bug size={15}/> <span className="ap-report-txt">Reportar</span>
          </a>
          <button className={`ap-bk-btn ${favs.unis.includes(uni) ? 'ap-bk-btn--on':''}`} onClick={toggleFavUni}
            title={favs.unis.includes(uni) ? 'Quitar de favoritas':'Guardar universidad'}>
            {favs.unis.includes(uni) ? <BookmarkCheck size={16}/> : <Bookmark size={16}/>}
          </button>
          {isAdmin && (
            <span className="ap-admin-chip" title="Estás en modo administrador (solo vos ves esto)">
              <Lock size={13}/><span className="ap-admin-txt">Admin</span>
            </span>
          )}
        </div>
      </div>

      {/* ── Ruta de navegación clickeable (siempre visible, también en mobile) ── */}
      <nav className="ap-crumb-strip" aria-label="Dónde estás">
        <button className="ap-crumb-seg ap-crumb-home" onClick={() => setUni(null)}>
          <FolderOpen size={14} aria-hidden="true" /> Universidades
        </button>
        <ChevronRight size={14} className="ap-crumb-sep" aria-hidden="true" />
        {career
          ? <button className="ap-crumb-seg" onClick={goToUniRoot}>{uni}</button>
          : <span className="ap-crumb-seg ap-crumb-here" aria-current="page">{uni}</span>}
        {career && <>
          <ChevronRight size={14} className="ap-crumb-sep" aria-hidden="true" />
          {subject
            ? <button className="ap-crumb-seg" onClick={() => goCareer(career)}>{career}</button>
            : <span className="ap-crumb-seg ap-crumb-here" aria-current="page">{career}</span>}
        </>}
        {subject && <>
          <ChevronRight size={14} className="ap-crumb-sep" aria-hidden="true" />
          {drivePath.length > 0
            ? <button className="ap-crumb-seg" onClick={() => setDrivePath([])}>{subject}</button>
            : <span className="ap-crumb-seg ap-crumb-here" aria-current="page">{subject}</span>}
        </>}
      </nav>

      </div>{/* /ap-header */}

      {/* ── Content area ── */}
      <div className="ap-content">

        <h2 className="ap-level-title">{LEVEL_TITLE[level]}</h2>

        {/* ── Admin: importar carrera completa desde Drive ── */}
        {level === 'career' && isAdmin && (
          <div className="ap-admin-box ap-career-import">
            {careerImport ? (
              <div className="ap-drive-form">
                <div className="ap-drive-form-head"><DriveIcon size={18}/> Importar carrera completa desde Drive</div>
                <p className="ap-career-import-hint">Pegá una carpeta de Drive pública donde <b>cada subcarpeta es una materia</b>. Se crean todas de una vez, con sus apuntes adentro.</p>
                <input className="ap-drive-input" placeholder="https://drive.google.com/drive/folders/..."
                  value={careerImport.url} onChange={e => setCareerImport({ url: e.target.value })} autoFocus
                  onKeyDown={e => e.key === 'Enter' && !importing && importCareerDrive()} />
                <div className="ap-drive-form-actions">
                  <button className="ap-drive-confirm" onClick={importCareerDrive} disabled={!careerImport.url.trim() || importing}>
                    {importing ? <><Loader size={14} className="ap-spin"/> Importando…</> : <><Check size={14}/> Importar materias</>}
                  </button>
                  <button className="ap-drive-cancel" aria-label="Cancelar" onClick={() => setCareerImport(null)} disabled={importing}><X size={14}/></button>
                </div>
              </div>
            ) : (
              <button className="ap-admin-add-drive" onClick={() => setCareerImport({ url: '' })}>
                <DriveIcon size={18}/> Importar carrera completa desde Drive
              </button>
            )}
          </div>
        )}

        {/* ── CAREERS or SUBJECTS grid ── */}
        {level !== 'subject' && (
          <div className="ap-folder-grid">

            {/* Create new folder card — solo para usuarios logueados */}
            {!isSignedIn ? (
              <SignInButton mode="modal">
                <button className="ap-new-folder-btn ap-new-folder-btn--locked" type="button">
                  <div className="ap-nf-plus"><Lock size={18}/></div>
                  <span>Iniciá sesión para {level === 'university' ? 'crear una carrera' : 'crear una materia'}</span>
                </button>
              </SignInButton>
            ) : creating === (level === 'university' ? 'career' : 'subject') ? (
              <div className="ap-new-folder-input-card">
                <FolderPlus size={22} className="ap-nf-icon"/>
                <input
                  ref={createRef}
                  className="ap-nf-input"
                  placeholder={level === 'university' ? 'Nombre de la carrera…' : 'Nombre de la materia…'}
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key==='Enter') confirmCreate(); if (e.key==='Escape') { setCreating(null); setNewName('') } }}
                />
                <div className="ap-nf-actions">
                  <button className="ap-nf-confirm" onClick={confirmCreate} disabled={!newName.trim()}><Check size={14}/> Crear</button>
                  <button className="ap-nf-cancel" onClick={() => { setCreating(null); setNewName('') }}><X size={14}/></button>
                </div>
              </div>
            ) : (
              <motion.button
                className="ap-new-folder-btn"
                onClick={() => setCreating(level === 'university' ? 'career' : 'subject')}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <div className="ap-nf-plus"><Plus size={20}/></div>
                <span>{LEVEL_NEW_LABEL[level]}</span>
              </motion.button>
            )}

            {/* Existing folders */}
            <AnimatePresence>
              {(level === 'university' ? careers : subjects).map((name, i) => (
                <motion.button key={name} className={`ap-folder-card ${level==='career' && isSubFav(name) ? 'ap-folder-card--fav':''}`}
                  onClick={() => level === 'university' ? goCareer(name) : goSubject(name)}
                  initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.04 }}
                  whileHover={{ y:-3, boxShadow:'0 8px 28px rgba(35,53,92,0.13)' }}>
                  <div className="ap-folder-icon-wrap">
                    <FolderOpen size={22} className="ap-folder-icon"/>
                  </div>
                  <div className="ap-folder-body">
                    <MarqueeText className="ap-folder-name" text={name} />
                    <span className="ap-folder-sub">{level === 'university' ? 'Carrera' : 'Materia'}</span>
                  </div>
                  <div className="ap-folder-actions">
                    {level === 'career' && (
                      <button className={`ap-bk-mini ${isSubFav(name)?'ap-bk-mini--on':''}`}
                        onClick={e => { e.stopPropagation(); toggleFavSub(name) }}
                        title={isSubFav(name) ? 'Quitar de favoritas' : 'Guardar materia'}>
                        {isSubFav(name) ? <BookmarkCheck size={11}/> : <Bookmark size={11}/>}
                      </button>
                    )}
                    {canEditFolder(name) && (
                      <button className="ap-folder-edit" onClick={e => { e.stopPropagation(); renameFolder(name) }}
                        title="Renombrar carpeta">
                        <Pencil size={12}/>
                      </button>
                    )}
                    {isAdmin && (
                      <button className="ap-folder-del" onClick={e => { e.stopPropagation(); deleteFolder(name) }}
                        title="Eliminar carpeta vacía (admin)">
                        <Trash2 size={12}/>
                      </button>
                    )}
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>

            {/* Faculty suggestions (only at university level, no careers yet) */}
            {isSignedIn && level === 'university' && careers.length === 0 && !creating && suggestions.length > 0 && (
              <div className="ap-suggestions">
                <p className="ap-suggestions-lbl">Carreras frecuentes en {uni}:</p>
                <div className="ap-suggestions-row">
                  {suggestions.slice(0,6).map(s => (
                    <button key={s} className="ap-suggest-chip"
                      onClick={() => { setNewName(s); setCreating('career'); }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SUBJECT LEVEL — upload + file list ── */}
        {level === 'subject' && (
          <div className="ap-subject-view">

            {/* Breadcrumb de navegación dentro de una carpeta de Drive */}
            {inDrive && (
              <div className="ap-drive-crumb">
                <button className="ap-drive-crumb-back" onClick={() => goDriveLevel(drivePath.length - 1)}>
                  <ArrowLeft size={14}/> Volver
                </button>
                <div className="ap-drive-crumb-path">
                  <button className="ap-drive-crumb-link" onClick={() => goDriveLevel(0)}>{subject}</button>
                  {drivePath.map((d, i) => (
                    <span className="ap-drive-crumb-seg" key={d.driveId}>
                      <ChevronRight size={12}/>
                      {i === drivePath.length - 1
                        ? <span className="ap-drive-crumb-cur">{d.name}</span>
                        : <button className="ap-drive-crumb-link" onClick={() => goDriveLevel(i + 1)}>{d.name}</button>}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Zona de subida + gestión: solo a nivel materia (no dentro de Drive) */}
            {!inDrive && (<>

            {/* Upload zone — solo para usuarios logueados */}
            {!isSignedIn ? (
              <div className="ap-drop ap-drop--locked">
                <Lock size={24} className="ap-drop-icon"/>
                <p className="ap-drop-title">Iniciá sesión para subir apuntes</p>
                <p className="ap-drop-sub">Solo usuarios registrados pueden cargar archivos al vault</p>
                <SignInButton mode="modal">
                  <button className="ap-drop-signin" type="button">Iniciar sesión</button>
                </SignInButton>
              </div>
            ) : (
              <div
                className={`ap-drop${drag?' ap-drop--active':''}`}
                onDrop={e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files) }}
                onDragOver={e => { e.preventDefault(); setDrag(true) }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDrag(false) }}
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg"
                  style={{ display:'none' }} onChange={e => addFiles(e.target.files)} />
                <FileUp size={24} className="ap-drop-icon"/>
                <p className="ap-drop-title">{drag ? 'Soltá acá' : 'Arrastrá tus archivos o hacé click'}</p>
                <p className="ap-drop-sub">PDF, Word, PowerPoint, imágenes · Máx 50 MB</p>
              </div>
            )}

            {/* ── Admin: agregar carpeta de Drive ── */}
            {isAdmin && (
              <div className="ap-admin-box">
                {driveForm ? (
                  <div className="ap-drive-form">
                    <div className="ap-drive-form-head"><DriveIcon size={18}/> Nueva carpeta de Drive</div>
                    <input className="ap-drive-input" placeholder="Nombre (ej: Apuntes Civil I — Cátedra López)"
                      value={driveForm.name} onChange={e => setDriveForm({ ...driveForm, name: e.target.value })} autoFocus />
                    <input className="ap-drive-input" placeholder="https://drive.google.com/..."
                      value={driveForm.url} onChange={e => setDriveForm({ ...driveForm, url: e.target.value })}
                      onKeyDown={e => e.key === 'Enter' && addDriveLink()} />
                    <div className="ap-drive-form-actions">
                      <button className="ap-drive-confirm" onClick={addDriveLink} disabled={!driveForm.name.trim() || !driveForm.url.trim()}>
                        <Check size={14}/> Agregar carpeta
                      </button>
                      <button className="ap-drive-cancel" aria-label="Cancelar" onClick={() => setDriveForm(null)}><X size={14}/></button>
                    </div>
                  </div>
                ) : (
                  <button className="ap-admin-add-drive" onClick={() => setDriveForm({ name: '', url: '' })}>
                    <DriveIcon size={18}/> Agregar carpeta de Drive
                  </button>
                )}
              </div>
            )}

            {/* Admin: carpetas de Drive vinculadas (quitar) */}
            {isAdmin && linkedDrive.length > 0 && (
              <div className="ap-drive-linked">
                <span className="ap-drive-linked-lbl"><DriveIcon size={14}/> Carpetas vinculadas:</span>
                {linkedDrive.map(l => (
                  <span key={l.id} className="ap-drive-linked-chip">
                    {l.name}
                    <button onClick={() => deleteDriveLink(l.id)} title="Quitar carpeta de Drive"><X size={12}/></button>
                  </span>
                ))}
              </div>
            )}

            {/* Queue */}
            <AnimatePresence>
              {queue.length > 0 && (
                <motion.div className="ap-queue" initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
                  <div className="ap-queue-head">
                    <span>{queue.length} archivo{queue.length>1?'s':''} en cola</span>
                    <div className="ap-queue-actions">
                      {pending > 0 && <button className="ap-queue-upload-btn" onClick={uploadAll}><Upload size={13}/> Subir {pending}</button>}
                      <button className="ap-queue-clear" onClick={() => setQueue([])}>Limpiar</button>
                    </div>
                  </div>
                  {queue.map(e => (
                    <motion.div key={e.id} className={`ap-qrow ap-qrow--${e.status}`}
                      initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} exit={{opacity:0,height:0}}>
                      <span className="ap-qrow-ext">{fileExt(e.file.name)}</span>
                      <div className="ap-qrow-info">
                        <span className="ap-qrow-name">{e.file.name}</span>
                        <span className="ap-qrow-size">{fmt(e.file.size)}</span>
                        {e.status==='uploading' && (
                          <div className="ap-qrow-bar"><motion.div className="ap-qrow-fill" animate={{width:`${e.progress}%`}}/></div>
                        )}
                        {e.status==='error' && <span className="ap-qrow-err">{e.error}</span>}
                      </div>
                      <div className="ap-qrow-end">
                        {e.status==='pending'   && <><button className="ap-q-go" aria-label="Subir este archivo" onClick={()=>uploadOne(e)}><Upload size={12}/></button><button className="ap-q-rm" aria-label="Quitar de la cola" onClick={()=>setQueue(p=>p.filter(x=>x.id!==e.id))}><X size={12}/></button></>}
                        {e.status==='uploading' && <Loader size={14} className="ap-spin"/>}
                        {e.status==='done'      && <Check size={16} className="ap-q-done"/>}
                        {e.status==='error'     && <button className="ap-q-retry" onClick={()=>uploadOne(e)}>Reintentar</button>}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            </>)}

            {/* File list */}
            {filesLoad ? (
              <div className="ap-files-loading"><Loader size={20} className="ap-spin"/><span>Cargando archivos…</span></div>
            ) : (
              <>
                {files.length > 0 && (
                  <div className="ap-search-inline">
                    <Search size={14} className="ap-si-icon"/>
                    <input className="ap-si-input" placeholder="Buscar en esta materia…"
                      value={search} onChange={e => setSearch(e.target.value)}/>
                    {search && <button className="ap-si-x" aria-label="Borrar búsqueda" onClick={()=>setSearch('')}><X size={13}/></button>}
                  </div>
                )}
                {visFiles.length === 0 && !filesLoad && (
                  <div className="ap-empty-files">
                    <FileText size={36} strokeWidth={1.2}/>
                    <p>{search ? 'Sin resultados.' : inDrive ? 'Esta carpeta está vacía.' : 'Todavía no hay archivos en esta materia.'}</p>
                    {!search && !inDrive && <p className="ap-empty-hint">Arrastrá tus apuntes arriba para ser el primero.</p>}
                  </div>
                )}
                <div className="ap-files-list">
                  {visFiles.map((f,i) => {
                    // ── Carpeta de Drive (link externo) ──
                    if (f.type === 'drive') {
                      return (
                        <motion.div key={f.id} className="ap-file ap-file--drive ap-file--clickable"
                          initial={{opacity:0,x:-6}} animate={{opacity:1,x:0}} transition={{delay:i*0.04}}
                          onClick={() => window.open(f.url, '_blank', 'noopener')}
                          role="button" tabIndex={0} onKeyDown={activateOnKey(() => window.open(f.url, '_blank', 'noopener'))}
                          title="Abrir carpeta en Google Drive">
                          <div className="ap-file-ext ap-file-ext--drive">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                          </div>
                          <div className="ap-file-info">
                            <MarqueeText className="ap-file-name" text={f.name} />
                            <div className="ap-file-meta">
                              <span className="ap-drive-badge">Carpeta de Drive</span>
                              {f.lastModified && <><span>·</span><span>{relDate(f.lastModified)}</span></>}
                            </div>
                          </div>
                          <div className="ap-file-btns" onClick={e => e.stopPropagation()}>
                            <button className="ap-dl ap-dl--drive" onClick={() => window.open(f.url, '_blank', 'noopener')} title="Abrir en Drive">
                              <ExternalLink size={16}/>
                            </button>
                            {isAdmin && (
                              <button className="ap-del" onClick={() => deleteDriveLink(f.id)} title="Eliminar carpeta (admin)">
                                <Trash2 size={15}/>
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )
                    }
                    // ── Subcarpeta de Drive (navegable) ──
                    if (f.type === 'drive-folder') {
                      return (
                        <motion.div key={f.id} className="ap-file ap-file--drive ap-file--clickable"
                          initial={{opacity:0,x:-6}} animate={{opacity:1,x:0}} transition={{delay:i*0.04}}
                          onClick={() => enterDriveFolder(f)}
                          role="button" tabIndex={0} onKeyDown={activateOnKey(() => enterDriveFolder(f))}
                          title="Abrir carpeta">
                          <div className="ap-file-ext ap-file-ext--drive">
                            <FolderOpen size={20}/>
                          </div>
                          <div className="ap-file-info">
                            <MarqueeText className="ap-file-name" text={f.name} />
                            <div className="ap-file-meta">
                              <span className="ap-drive-badge ap-drive-badge--sm">Drive</span>
                              {f.count != null && <><span>·</span><span>{f.count} {f.count === 1 ? 'archivo' : 'archivos'}</span></>}
                            </div>
                          </div>
                          <div className="ap-file-btns">
                            <ChevronRight size={20} className="ap-drive-chevron"/>
                          </div>
                        </motion.div>
                      )
                    }
                    // ── Archivo individual dentro de una carpeta de Drive ──
                    if (f.type === 'drive-file') {
                      return (
                        <motion.div key={f.id} className="ap-file ap-file--clickable"
                          initial={{opacity:0,x:-6}} animate={{opacity:1,x:0}} transition={{delay:i*0.04}}
                          onClick={() => setPreview(f)}
                          role="button" tabIndex={0} onKeyDown={activateOnKey(() => setPreview(f))}
                          title="Previsualizar archivo de Drive">
                          <div className="ap-file-ext">{(f.kind || 'file').toUpperCase()}</div>
                          <div className="ap-file-info">
                            <MarqueeText className="ap-file-name" text={f.name} />
                            <div className="ap-file-meta">
                              <span className="ap-drive-badge ap-drive-badge--sm">Drive</span>
                              {fmt(f.size) && <><span>·</span><span>{fmt(f.size)}</span></>}
                              {f.lastModified && <><span>·</span><span>{relDate(f.lastModified)}</span></>}
                            </div>
                          </div>
                          <div className="ap-file-btns" onClick={e => e.stopPropagation()}>
                            <button className="ap-dl ap-dl--drive" onClick={() => window.open(f.viewUrl, '_blank', 'noopener')} title="Abrir en Drive">
                              <ExternalLink size={16}/>
                            </button>
                          </div>
                        </motion.div>
                      )
                    }
                    // ── Archivo del bucket ──
                    const r = ratings[f.key]
                    return (
                      <motion.div key={f.key} className="ap-file ap-file--clickable"
                        initial={{opacity:0,x:-6}} animate={{opacity:1,x:0}} transition={{delay:i*0.04}}
                        onClick={() => setPreview(f)}
                        role="button" tabIndex={0} onKeyDown={activateOnKey(() => setPreview(f))}
                        title="Hacer click para previsualizar">
                        <div className="ap-file-ext">{fileExt(f.name)}</div>
                        <div className="ap-file-info">
                          <MarqueeText className="ap-file-name" text={f.name} />
                          <div className="ap-file-meta">
                            {fmt(f.size) && <span>{fmt(f.size)}</span>}
                            {f.lastModified && <><span>·</span><span>{relDate(f.lastModified)}</span></>}
                          </div>
                          <div className="ap-file-bottom" onClick={e => e.stopPropagation()}>
                            {r?.count > 0 && <Stars avg={r.avg} count={r.count}/>}
                            <RateRow fileKey={f.key} onRate={rate} voted={hasVoted(f.key)}/>
                          </div>
                        </div>
                        <div className="ap-file-btns" onClick={e => e.stopPropagation()}>
                          <button className="ap-dl" onClick={() => window.open(`${API}/download?key=${encodeURIComponent(f.key)}`, '_blank')} title="Descargar">
                            <Download size={16}/>
                          </button>
                          {/* Borrar: el dueño (según el servidor), o el admin (cualquier archivo) */}
                          {isAdmin ? (
                            <button className="ap-del" onClick={() => adminDeleteFile(f.key)} title="Eliminar (admin)">
                              <Trash2 size={15}/>
                            </button>
                          ) : (f.owned || isOwned(f.key)) && (
                            <button className="ap-del" onClick={() => deleteFile(f.key)} title="Eliminar mi apunte">
                              <Trash2 size={15}/>
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>

    {/* ── Preview modal ── */}
    <AnimatePresence>
      {preview && <PreviewModal file={preview} onClose={() => setPreview(null)} />}
    </AnimatePresence>
    </>
  )
}
