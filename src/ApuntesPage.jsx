import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Search, ArrowLeft, Star, Bookmark, BookmarkCheck,
  Download, ChevronRight, FolderOpen, FolderPlus,
  FileText, AlertCircle, Loader, Upload, Plus,
  X, Check, FileUp, Trash2,
} from 'lucide-react'
import { UNIVERSITIES, FACULTIES } from './universities.js'
import { getDeviceId, getPoints, addPoints, markOwned, isOwned, unmarkOwned } from './device.js'
import PreviewModal from './PreviewModal.jsx'
import './PreviewModal.css'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3002/api'

// ── localStorage helpers ───────────────────────────────────────────────────
const loadFavs = () => { try { return JSON.parse(localStorage.getItem('aa-favorites') ?? '{"unis":[],"subjects":[]}') } catch { return { unis: [], subjects: [] } } }
const saveFavs = f => { try { localStorage.setItem('aa-favorites', JSON.stringify(f)) } catch {} }
const hasVoted  = k => { try { return !!JSON.parse(localStorage.getItem('aa-votes') ?? '{}')[k] } catch { return false } }
const markVoted = k => { try { const v = JSON.parse(localStorage.getItem('aa-votes') ?? '{}'); v[k] = true; localStorage.setItem('aa-votes', JSON.stringify(v)) } catch {} }

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = b => !b ? '' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(1) + ' MB'
const relDate = d => { if (!d) return ''; const s = (Date.now() - new Date(d)) / 1000; if (s < 3600) return 'hace ' + Math.floor(s / 60) + ' min'; if (s < 86400) return 'hace ' + Math.floor(s / 3600) + 'h'; if (s < 604800) return 'hace ' + Math.floor(s / 86400) + 'd'; return new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) }
const fileExt  = n => (n?.split('.').pop()?.toUpperCase() ?? 'FILE')

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
          {q && <button className="ap-unisel-x" onClick={() => { setQ(''); ref.current?.focus() }}><X size={15}/></button>}
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
          ? <img src={u.logo} alt={u.name} className="ap-ucard-img" onError={e => { e.currentTarget.style.display='none'; e.currentTarget.nextSibling.style.display='flex' }}/>
          : null}
        <span className="ap-ucard-badge" style={{ background: u.color, display: u.logo ? 'none' : 'flex' }}>{u.name}</span>
      </div>
      <div className="ap-ucard-info">
        <b className="ap-ucard-name">{u.name}</b>
        <span className="ap-ucard-full">{u.full}</span>
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
  const deviceId = getDeviceId()
  const fileRef   = useRef(null)
  const createRef = useRef(null)

  // Bootstrap
  useEffect(() => {
    Promise.all([
      fetch(`${API}/tree`).then(r => r.json()).catch(() => ({ universities:[], careers:{}, subjects:{} })),
      fetch(`${API}/ratings`).then(r => r.json()).catch(() => ({})),
      fetch(`${API}/uploads`).then(r => r.json()).catch(() => ({})),
    ]).then(([t, r, u]) => { setTree(t); setRatings(r); setUploads(u) }).finally(() => setTreeLoad(false))
  }, [])

  // Load files
  useEffect(() => {
    if (!uni || !career || !subject) { setFiles([]); return }
    setFilesLoad(true)
    fetch(`${API}/files?university=${encodeURIComponent(uni)}&career=${encodeURIComponent(career)}&subject=${encodeURIComponent(subject)}`)
      .then(r => r.json()).then(setFiles).catch(() => setFiles([])).finally(() => setFilesLoad(false))
  }, [uni, career, subject])

  // Focus create input
  useEffect(() => { if (creating) createRef.current?.focus() }, [creating])

  // ── Navigation ────────────────────────────────────────────────────────
  const goUni = name => { setUni(name); setCareer(null); setSubject(null); setQueue([]); setCreating(null) }
  const goCareer = c => { setCareer(c); setSubject(null); setQueue([]); setCreating(null) }
  const goSubject = s => { setSubject(s); setQueue([]); setCreating(null) }
  const goBack = () => {
    if (subject)       { setSubject(null); setCreating(null) }
    else if (career)   { setCareer(null);  setCreating(null) }
    else               { setUni(null) }
  }

  // ── Create folder ─────────────────────────────────────────────────────
  const confirmCreate = () => {
    const name = newName.trim()
    if (!name) return
    if (creating === 'career') {
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
    setNewName(''); setCreating(null)
  }

  // ── Upload ────────────────────────────────────────────────────────────
  const addFiles = fs => {
    const entries = Array.from(fs).map(f => ({ id: Math.random().toString(36).slice(2), file: f, status: 'pending', progress: 0, error: null }))
    setQueue(prev => [...prev, ...entries])
  }

  const uploadOne = async entry => {
    setQueue(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'uploading', progress: 10 } : e))
    const fd = new FormData()
    fd.append('file', entry.file)
    fd.append('university', uni)
    fd.append('career', career)
    fd.append('subject', subject)
    fd.append('uploaderId', deviceId)
    try {
      const tick = setInterval(() => setQueue(prev => prev.map(e => e.id === entry.id && e.progress < 80 ? { ...e, progress: e.progress + 20 } : e)), 400)
      const res = await fetch(`${API}/upload`, { method: 'POST', body: fd })
      clearInterval(tick)
      if (!res.ok) throw new Error((await res.json()).error)
      const data = await res.json()
      setQueue(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'done', progress: 100 } : e))
      setFiles(prev => [...prev, { key: data.key, name: data.name, size: data.size, lastModified: new Date() }])
      // Registrar en uploads locales y sumar puntos
      setUploads(prev => ({ ...prev, [data.key]: { uploaderId: deviceId } }))
      markOwned(data.key); const newPts = addPoints(5)
      setPoints(newPts)
      setPointsAnim('+5 pts')
      setTimeout(() => setPointsAnim(null), 2000)
    } catch (err) {
      setQueue(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'error', error: err.message } : e))
    }
  }

  const uploadAll = () => queue.filter(e => e.status === 'pending').forEach(uploadOne)

  // ── Delete (solo propios) ─────────────────────────────────────────────
  const deleteFile = async key => {
    if (!window.confirm('¿Eliminar este archivo del vault?')) return
    try {
      const res = await fetch(`${API}/files`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, uploaderId: deviceId }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      setFiles(prev => prev.filter(f => f.key !== key))
      setUploads(prev => { const n = { ...prev }; delete n[key]; return n })
      unmarkOwned(key)
    } catch (err) { alert('No se pudo eliminar: ' + err.message) }
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

      {/* ── Top bar ── */}
      <div className="ap-bar">
        <button className="ap-btn-back" onClick={goBack}>
          <ArrowLeft size={16} />
          {subject ? career : career ? uni : 'Universidades'}
        </button>

        {/* Breadcrumb */}
        <div className="ap-crumb">
          <span className="ap-crumb-uni">{uni}</span>
          {career  && <><ChevronRight size={12}/><span>{career}</span></>}
          {subject && <><ChevronRight size={12}/><span className="ap-crumb-cur">{subject}</span></>}
        </div>

        {/* Points badge */}
        <div className="ap-points-wrap">
          <div className="ap-points-badge">
            <Star size={12} fill="currentColor" className="ap-pts-star" />
            <span>{points} pts</span>
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
          <button className={`ap-bk-btn ${favs.unis.includes(uni) ? 'ap-bk-btn--on':''}`} onClick={toggleFavUni}
            title={favs.unis.includes(uni) ? 'Quitar de favoritas':'Guardar universidad'}>
            {favs.unis.includes(uni) ? <BookmarkCheck size={16}/> : <Bookmark size={16}/>}
          </button>
        </div>
      </div>

      {/* ── Content area ── */}
      <div className="ap-content">

        <h2 className="ap-level-title">{LEVEL_TITLE[level]}</h2>

        {/* ── CAREERS or SUBJECTS grid ── */}
        {level !== 'subject' && (
          <div className="ap-folder-grid">

            {/* Create new folder card */}
            {creating === (level === 'university' ? 'career' : 'subject') ? (
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
                  whileHover={{ y:-3, boxShadow:'0 6px 20px rgba(35,53,92,0.12)' }}>
                  <FolderOpen size={28} className="ap-folder-icon"/>
                  <span className="ap-folder-name">{name}</span>
                  {level === 'career' && (
                    <button className={`ap-bk-mini ${isSubFav(name)?'ap-bk-mini--on':''}`}
                      onClick={e => { e.stopPropagation(); toggleFavSub(name) }}>
                      {isSubFav(name) ? <BookmarkCheck size={11}/> : <Bookmark size={11}/>}
                    </button>
                  )}
                </motion.button>
              ))}
            </AnimatePresence>

            {/* Faculty suggestions (only at university level, no careers yet) */}
            {level === 'university' && careers.length === 0 && !creating && suggestions.length > 0 && (
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

            {/* Upload zone */}
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
                        {e.status==='pending'   && <><button className="ap-q-go" onClick={()=>uploadOne(e)}><Upload size={12}/></button><button className="ap-q-rm" onClick={()=>setQueue(p=>p.filter(x=>x.id!==e.id))}><X size={12}/></button></>}
                        {e.status==='uploading' && <Loader size={14} className="ap-spin"/>}
                        {e.status==='done'      && <Check size={16} className="ap-q-done"/>}
                        {e.status==='error'     && <button className="ap-q-retry" onClick={()=>uploadOne(e)}>Reintentar</button>}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

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
                    {search && <button className="ap-si-x" onClick={()=>setSearch('')}><X size={13}/></button>}
                  </div>
                )}
                {visFiles.length === 0 && !filesLoad && (
                  <div className="ap-empty-files">
                    <FileText size={36} strokeWidth={1.2}/>
                    <p>{search ? 'Sin resultados.' : 'Todavía no hay archivos en esta materia.'}</p>
                    <p className="ap-empty-hint">Arrastrá tus apuntes arriba para ser el primero.</p>
                  </div>
                )}
                <div className="ap-files-list">
                  {visFiles.map((f,i) => {
                    const r = ratings[f.key]
                    return (
                      <motion.div key={f.key} className="ap-file ap-file--clickable"
                        initial={{opacity:0,x:-6}} animate={{opacity:1,x:0}} transition={{delay:i*0.04}}
                        onClick={() => setPreview(f)}
                        title="Hacer click para previsualizar">
                        <div className="ap-file-ext">{fileExt(f.name)}</div>
                        <div className="ap-file-info">
                          <span className="ap-file-name">{f.name}</span>
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
                          {isOwned(f.key) && (
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
