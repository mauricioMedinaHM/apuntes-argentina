import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Upload, FileText, Folder, FolderOpen, ChevronRight,
  CheckCircle, XCircle, Trash2, ArrowLeft, Plus, X, Loader, LogIn,
  BookMarked, Search, GraduationCap, CloudUpload,
} from 'lucide-react'

import { useAuth, useSession, SignInButton, SignUpButton } from '@clerk/react'
import { UNIVERSITIES, FACULTIES } from './universities.js'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3002/api'

// UNI_LIST construido desde el inventario completo
const UNI_LIST = UNIVERSITIES.map(u => ({ id: u.id, name: u.name, full: u.full, province: u.province, type: u.type }))

// Ejemplos dinámicos: usa las facultades reales del inventario
function getExamples(uniName) {
  const facs = FACULTIES[uniName] ?? []
  return {
    carrera: facs[0] ?? 'Ingeniería',
    materia: facs.length > 0 ? 'Cálculo I' : 'Materia I',
  }
}

function formatBytes(b) {
  if (b < 1024)       return b + ' B'
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB'
  return (b / (1024 * 1024)).toFixed(1) + ' MB'
}

function fileExt(name) {
  return name.split('.').pop()?.toUpperCase() ?? 'FILE'
}

// ── Instructions panel ────────────────────────────────────────────────────
function Instructions({ uni, career, subject }) {
  const uniData = UNI_LIST.find(u => u.name === uni)
  const eg      = getExamples(uni)

  const steps = [
    {
      num: '1',
      title: 'Elegí tu carrera',
      done: !!career,
      active: !career,
      body: (
        <>
          Buscá en la lista de la izquierda o escribí una nueva y presioná <kbd>Enter</kbd>.
          <span className="up-inst-eg">Ej: "{eg.carrera}"</span>
        </>
      ),
    },
    {
      num: '2',
      title: 'Elegí tu materia',
      done: !!subject,
      active: !!career && !subject,
      body: (
        <>
          Una vez que elegiste la carrera, buscá o creá la materia.
          <span className="up-inst-eg">Ej: "{eg.materia}"</span>
        </>
      ),
    },
    {
      num: '3',
      title: 'Subí tus archivos',
      done: false,
      active: !!career && !!subject,
      body: 'Arrastrá o hacé click en la zona de carga. Podés subir varios archivos a la vez.',
    },
  ]

  return (
    <div className="up-inst">
      {/* Header */}
      <div className="up-inst-header">
        <div className="up-inst-header-text">
          <h3 className="up-inst-title">¿Cómo subo mis apuntes?</h3>
          <p className="up-inst-sub">Tres pasos para publicar en la {uniData?.full ?? uni}</p>
        </div>
      </div>

      {/* Steps */}
      <div className="up-inst-steps">
        {steps.map((s, i) => (
          <motion.div
            key={i}
            className={`up-inst-step
              ${s.done   ? 'up-inst-step--done'   : ''}
              ${s.active ? 'up-inst-step--active' : ''}
            `}
            animate={{ opacity: s.done || s.active ? 1 : 0.45 }}
            transition={{ duration: 0.3 }}
          >
            <div className="up-inst-step-num">
              {s.done ? <CheckCircle size={16} /> : s.num}
            </div>
            <div className="up-inst-step-body">
              <strong>{s.title}</strong>
              <p>{s.body}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Live path preview */}
      <div className="up-inst-path-wrap">
        <p className="up-inst-path-label">Así se va a guardar tu archivo:</p>
        <div className="up-inst-path">
          {[
            { label: uni,              filled: true  },
            { label: career || 'carrera',  filled: !!career  },
            { label: subject || 'materia', filled: !!subject },
            { label: 'tu_apunte.pdf',   filled: false, isFile: true },
          ].map((part, i, arr) => (
            <span key={i} className="up-inst-path-item">
              <span className={`up-inst-path-part ${part.filled ? 'up-inst-path-part--filled' : ''} ${part.isFile ? 'up-inst-path-part--file' : ''}`}>
                {part.isFile ? '📄' : '📁'} {part.label}
              </span>
              {i < arr.length - 1 && <ChevronRight size={12} className="up-inst-path-sep" />}
            </span>
          ))}
        </div>
      </div>

      {/* Footer note */}
      <div className="up-inst-footer">
        <span className="up-inst-badge">✓ Sin registro</span>
        <span className="up-inst-badge">✓ Sin contraseña</span>
        <span className="up-inst-badge">✓ Tu apunte ayuda a quien viene después</span>
      </div>
    </div>
  )
}

export default function UploadPage({ onBack }) {
  const { isSignedIn } = useAuth()
  const { session }    = useSession()

  // Obtiene el token JWT de Clerk para autenticar requests al backend
  const getToken = async () => {
    if (!session) return null
    try { return await session.getToken() } catch { return null }
  }
  const [tree, setTree]           = useState({ universities: [], careers: {}, subjects: {} })
  const [uni, setUni]             = useState('UBA')
  const [career, setCareer]       = useState('')
  const [subject, setSubject]     = useState('')
  const [newCareer, setNewCareer] = useState('')
  const [newSubject, setNewSubject] = useState('')
  const [files, setFiles]         = useState([])          // existing in bucket
  const [queue, setQueue]         = useState([])          // pending uploads
  const [isDragging, setIsDragging] = useState(false)
  const [serverOk, setServerOk]   = useState(null)
  const [uniSearch, setUniSearch] = useState('')
  const fileInputRef              = useRef(null)

  // ── Bootstrap ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/health`)
      .then(r => r.json())
      .then(() => setServerOk(true))
      .catch(() => setServerOk(false))

    fetch(`${API}/tree`)
      .then(r => r.json())
      .then(data => setTree(data))
      .catch(console.error)
  }, [])

  // ── Load files when path changes ───────────────────────────────────────
  useEffect(() => {
    if (!uni || !career || !subject) { setFiles([]); return }
    fetch(`${API}/files?university=${encodeURIComponent(uni)}&career=${encodeURIComponent(career)}&subject=${encodeURIComponent(subject)}`)
      .then(r => r.json())
      .then(setFiles)
      .catch(console.error)
  }, [uni, career, subject])

  // ── Drag & drop handlers ───────────────────────────────────────────────
  const handleDrop = useCallback(e => {
    e.preventDefault()
    setIsDragging(false)
    const dropped = Array.from(e.dataTransfer.files)
    addToQueue(dropped)
  }, [])

  const handleDragOver = e => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = e => { if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false) }

  const addToQueue = files => {
    const entries = files.map(f => ({
      id:       Math.random().toString(36).slice(2),
      file:     f,
      name:     f.name,
      size:     f.size,
      status:   'pending',  // pending | uploading | done | error
      progress: 0,
      error:    null,
    }))
    setQueue(prev => [...prev, ...entries])
  }

  const removeFromQueue = id => setQueue(prev => prev.filter(e => e.id !== id))

  // ── Upload logic ───────────────────────────────────────────────────────
  // Lee la respuesta como JSON, pero si el server/proxy devolvió texto plano
  // (ej. el 413 "Request Entity Too Large" de Vercel) da un mensaje claro.
  const readError = async (res) => {
    const text = await res.text()
    try { return JSON.parse(text).error || text }
    catch {
      if (res.status === 413) return 'El archivo es demasiado grande.'
      return `Error ${res.status}. Intentá de nuevo.`
    }
  }

  const uploadOne = async (entry) => {
    if (!uni || !career || !subject) return
    if (entry.file.size > 50 * 1024 * 1024) {
      setQueue(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'error', error: 'Máximo 50 MB por archivo' } : e))
      return
    }

    setQueue(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'uploading', progress: 8 } : e))
    const setProg = p => setQueue(prev => prev.map(e => e.id === entry.id ? { ...e, progress: p } : e))

    try {
      const token = await getToken()
      const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {}

      // ── Paso 1: pedir URL prefirmada (request chico, sin el archivo) ──
      const urlRes = await fetch(`${API}/upload-url`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ university: uni, career, subject, filename: entry.file.name, size: entry.file.size }),
      })
      if (!urlRes.ok) throw new Error(await readError(urlRes))
      const { uploadUrl, key, name, contentType } = await urlRes.json()
      setProg(20)

      // ── Paso 2: subir el archivo DIRECTO a R2 (con progreso real via XHR) ──
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', contentType)
        xhr.upload.onprogress = ev => {
          if (ev.lengthComputable) setProg(20 + Math.round((ev.loaded / ev.total) * 70))
        }
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300)
          ? resolve()
          : reject(new Error('No se pudo subir el archivo al almacenamiento'))
        xhr.onerror = () => reject(new Error('Error de red al subir el archivo'))
        xhr.send(entry.file)
      })
      setProg(92)

      // ── Paso 3: confirmar y registrar ──
      const confRes = await fetch(`${API}/confirm-upload`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      })
      if (!confRes.ok) throw new Error(await readError(confRes))
      const data = await confRes.json()

      setQueue(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'done', progress: 100 } : e))
      setFiles(prev => [...prev, { key: data.key, name: data.name || name, size: data.size, lastModified: new Date() }])

    } catch (err) {
      setQueue(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'error', error: err.message } : e))
    }
  }

  const uploadAll = async () => {
    if (!uni || !career || !subject) return
    const pending = queue.filter(e => e.status === 'pending')
    for (const entry of pending) {
      await uploadOne(entry)
    }
  }

  const deleteFile = async (key) => {
    if (!confirm(`¿Eliminar ${key.split('/').pop()}?`)) return
    try {
      const token = await getToken()
      const res = await fetch(`${API}/files`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ key }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Error ${res.status}`)
      }
      setFiles(prev => prev.filter(f => f.key !== key))
    } catch (err) {
      alert('Error al eliminar: ' + err.message)
    }
  }

  // ── Path helpers ───────────────────────────────────────────────────────
  const careers  = tree.careers?.[uni] ?? []
  const subjects = tree.subjects?.[uni]?.[career] ?? []

  const addCareer = () => {
    const v = newCareer.trim()
    if (!v) return
    setTree(t => ({
      ...t,
      careers: { ...t.careers, [uni]: [...(t.careers[uni] ?? []), v] },
      subjects: { ...t.subjects, [uni]: { ...(t.subjects[uni] ?? {}), [v]: [] } },
    }))
    setCareer(v)
    setSubject('')
    setNewCareer('')
  }

  const addSubject = () => {
    const v = newSubject.trim()
    if (!v || !career) return
    setTree(t => ({
      ...t,
      subjects: { ...t.subjects, [uni]: { ...(t.subjects[uni] ?? {}), [career]: [...(t.subjects[uni]?.[career] ?? []), v] } },
    }))
    setSubject(v)
    setNewSubject('')
  }

  const readyToUpload = uni && career && subject
  const pendingCount  = queue.filter(e => e.status === 'pending').length

  // ── Render ─────────────────────────────────────────────────────────────

  if (!isSignedIn) {
    return (
      <div className="up-root up-auth-gate">
        <div className="up-auth-card">
          <button className="up-back-btn up-auth-back" onClick={onBack}>
            <ArrowLeft size={16} /> Volver
          </button>
          <div className="up-auth-icon">
            <LogIn size={40} strokeWidth={1.5} />
          </div>
          <h2 className="up-auth-title">Necesitás una cuenta para subir apuntes</h2>
          <p className="up-auth-desc">
            Iniciá sesión o creá una cuenta gratuita. Rápido, sin spam.
          </p>
          <div className="up-auth-actions">
            <SignInButton mode="modal">
              <button className="up-auth-btn-primary">Iniciar sesión</button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="up-auth-btn-secondary">Crear cuenta gratis</button>
            </SignUpButton>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="up-root">

      {/* Server offline warning */}
      <AnimatePresence>
        {serverOk === false && (
          <motion.div className="up-offline"
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <XCircle size={16} />
            El servidor de upload no responde. Corré <code>npm run server</code> en otra terminal.
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <header className="up-header">
        <button className="up-header-back" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Volver</span>
        </button>
        <div className="up-header-brand">
          <BookMarked size={18} strokeWidth={2} />
          <span>Subir apuntes</span>
        </div>
        <div className="up-header-path">
          {uni && <span className="up-hp-item">{uni}</span>}
          {career && <><ChevronRight size={12} className="up-hp-sep"/><span className="up-hp-item">{career}</span></>}
          {subject && <><ChevronRight size={12} className="up-hp-sep"/><span className="up-hp-item up-hp-item--active">{subject}</span></>}
        </div>
        {readyToUpload && pendingCount > 0 && (
          <motion.button className="up-header-upload-btn" onClick={uploadAll}
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <CloudUpload size={15} />
            Subir {pendingCount} archivo{pendingCount > 1 ? 's' : ''}
          </motion.button>
        )}
      </header>

      {/* ── App shell ── */}
      <div className="up-app">

        {/* Indicador de progreso por pasos */}
        <div className="up-steps-bar">
          <div className={`up-step-pill ${uni ? 'up-step-pill--done' : 'up-step-pill--active'}`}>
            <GraduationCap size={13} />
            <span>{uni || 'Universidad'}</span>
          </div>
          <ChevronRight size={12} className="up-step-sep" />
          <div className={`up-step-pill ${career ? 'up-step-pill--done' : uni ? 'up-step-pill--active' : ''}`}>
            <Folder size={13} />
            <span>{career || 'Carrera'}</span>
          </div>
          <ChevronRight size={12} className="up-step-sep" />
          <div className={`up-step-pill ${subject ? 'up-step-pill--done' : career ? 'up-step-pill--active' : ''}`}>
            <FolderOpen size={13} />
            <span>{subject || 'Materia'}</span>
          </div>
        </div>

        <div className="up-body">

          {/* ── Sidebar ── */}
          <div className="up-sidebar">

            {/* Universidad */}
            <p className="up-sidebar-label">Universidad</p>

            {/* Buscador desktop */}
            <div className="up-sidebar-search">
              <Search size={13} className="up-sidebar-search-icon" />
              <input
                className="up-sidebar-search-input"
                placeholder="Buscar universidad…"
                value={uniSearch}
                onChange={e => setUniSearch(e.target.value)}
              />
            </div>

            {/* Mobile: selector nativo OS (mucho más usable para 123 items) */}
            <select
              className="up-uni-select"
              value={uni}
              onChange={e => { setUni(e.target.value); setCareer(''); setSubject('') }}
            >
              {UNI_LIST.map(u => (
                <option key={u.id} value={u.name}>{u.name} — {u.full}</option>
              ))}
            </select>

            {/* Desktop: lista de botones */}
            <div className="up-uni-list">
              {UNI_LIST.filter(u => !uniSearch || u.name.toLowerCase().includes(uniSearch.toLowerCase()) || u.full.toLowerCase().includes(uniSearch.toLowerCase())).map(u => (
                <button
                  key={u.id}
                  className={`up-uni-btn ${u.name === uni ? 'up-uni-btn--active' : ''}`}
                  onClick={() => { setUni(u.name); setCareer(''); setSubject('') }}
                >
                  {u.name}
                </button>
              ))}
            </div>

            {/* Carrera */}
            <p className="up-sidebar-label" style={{ marginTop: 20 }}>Carrera</p>
            <div className="up-item-list">
              {careers.map(c => (
                <button
                  key={c}
                  className={`up-item-btn ${c === career ? 'up-item-btn--active' : ''}`}
                  onClick={() => { setCareer(c); setSubject('') }}
                >
                  <Folder size={12} /> {c}
                </button>
              ))}
            </div>
            <div className="up-new-row">
              <input
                className="up-new-input"
                placeholder="Nueva carrera…"
                value={newCareer}
                onChange={e => setNewCareer(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCareer()}
              />
              <button className="up-new-add" onClick={addCareer} disabled={!newCareer.trim()}>
                <Plus size={14} />
              </button>
            </div>

            {/* Sugerencias de facultades para esta universidad */}
            {!career && FACULTIES[uni]?.length > 0 && (
              <>
                <p className="up-sidebar-label" style={{ marginTop: 16 }}>Facultades sugeridas</p>
                <div className="up-item-list">
                  {FACULTIES[uni].slice(0, 8).map(f => (
                    <button
                      key={f}
                      className="up-item-btn up-item-btn--suggest"
                      onClick={() => { setCareer(f); setSubject('') }}
                    >
                      <Folder size={12} /> {f}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Materia */}
            {career && (
              <>
                <p className="up-sidebar-label" style={{ marginTop: 20 }}>Materia</p>
                <div className="up-item-list">
                  {subjects.map(s => (
                    <button
                      key={s}
                      className={`up-item-btn ${s === subject ? 'up-item-btn--active' : ''}`}
                      onClick={() => setSubject(s)}
                    >
                      <FolderOpen size={12} /> {s}
                    </button>
                  ))}
                </div>
                <div className="up-new-row">
                  <input
                    className="up-new-input"
                    placeholder="Nueva materia…"
                    value={newSubject}
                    onChange={e => setNewSubject(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addSubject()}
                  />
                  <button className="up-new-add" onClick={addSubject} disabled={!newSubject.trim()}>
                    <Plus size={14} />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* ── Main ── */}
          <div className="up-main">

            {/* Instructions — always visible until path is complete */}
            <AnimatePresence mode="wait">
              {!readyToUpload && (
                <motion.div
                  key="instructions"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                >
                  <Instructions uni={uni} career={career} subject={subject} />
                </motion.div>
              )}
            </AnimatePresence>

            {readyToUpload ? (
              <>
                {/* Drag & Drop zone */}
                <div
                  className={`up-dropzone ${isDragging ? 'up-dropzone--active' : ''}`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.ppt,.pptx"
                    style={{ display: 'none' }}
                    onChange={e => addToQueue(Array.from(e.target.files))}
                  />
                  <motion.div
                    animate={isDragging ? { scale: 1.03 } : { scale: 1 }}
                    transition={{ duration: 0.15 }}
                    className="up-dropzone-inner"
                  >
                    <div className={`up-drop-circle ${isDragging ? 'up-drop-circle--active' : ''}`}>
                      <CloudUpload size={28} strokeWidth={1.4} />
                    </div>
                    <div className="up-drop-text">
                      <p className="up-drop-title">
                        {isDragging ? 'Soltá los archivos acá' : 'Arrastrá tus archivos o hacé click'}
                      </p>
                      <p className="up-drop-sub">PDF · Word · PowerPoint · Imágenes · Máx 50 MB</p>
                    </div>
                    <span className="up-drop-browse">Elegir archivo</span>
                  </motion.div>
                </div>

                {/* Upload queue */}
                <AnimatePresence>
                  {queue.length > 0 && (
                    <motion.div
                      className="up-queue"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="up-queue-header">
                        <span>Cola de subida ({queue.length})</span>
                        <button
                          className="up-queue-clear"
                          onClick={() => setQueue([])}
                        >
                          Limpiar
                        </button>
                      </div>

                      {queue.map(entry => (
                        <motion.div
                          key={entry.id}
                          className={`up-queue-item up-queue-item--${entry.status}`}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          <div className="up-qfile-ext">{fileExt(entry.name)}</div>
                          <div className="up-qfile-info">
                            <span className="up-qfile-name">{entry.name}</span>
                            <span className="up-qfile-size">{formatBytes(entry.size)}</span>
                            {entry.status === 'uploading' && (
                              <div className="up-progress-bar">
                                <motion.div
                                  className="up-progress-fill"
                                  animate={{ width: `${entry.progress}%` }}
                                  transition={{ duration: 0.3 }}
                                />
                              </div>
                            )}
                            {entry.status === 'error' && (
                              <span className="up-qfile-error">{entry.error}</span>
                            )}
                          </div>
                          <div className="up-qfile-actions">
                            {entry.status === 'pending' && (
                              <>
                                <button className="up-q-upload-btn" onClick={() => uploadOne(entry)}>
                                  <Upload size={13} />
                                </button>
                                <button className="up-q-remove-btn" onClick={() => removeFromQueue(entry.id)}>
                                  <X size={13} />
                                </button>
                              </>
                            )}
                            {entry.status === 'uploading' && <Loader size={16} className="up-spin" />}
                            {entry.status === 'done' && (
                              <div className="up-done-group">
                                <CheckCircle size={16} className="up-done-icon" />
                                {entry.savedPct && (
                                  <span className="up-saved-badge">−{entry.savedPct}%</span>
                                )}
                              </div>
                            )}
                            {entry.status === 'error'    && (
                              <button className="up-q-retry-btn" onClick={() => uploadOne(entry)}>Reintentar</button>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Existing files */}
                {files.length > 0 && (
                  <div className="up-files-section">
                    <p className="up-files-label">
                      Archivos en {uni} › {career} › {subject} ({files.length})
                    </p>
                    <div className="up-files-list">
                      {files.map(f => (
                        <div key={f.key} className="up-file-row">
                          <div className="up-file-ext">{fileExt(f.name)}</div>
                          <div className="up-file-info">
                            <span className="up-file-name">{f.name}</span>
                            <span className="up-file-meta">
                              {formatBytes(f.size)} · {new Date(f.lastModified).toLocaleDateString('es-AR')}
                            </span>
                          </div>
                          <button className="up-file-delete" onClick={() => deleteFile(f.key)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {files.length === 0 && queue.length === 0 && (
                  <div className="up-no-files">
                    <FileText size={28} strokeWidth={1.2} />
                    <p>No hay archivos en esta materia todavía.</p>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
