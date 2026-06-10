import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import {
  X, Download, FileText, File, FileImage, Presentation,
  ExternalLink, MessageSquare, Send, Trash2, Loader,
} from 'lucide-react'
import { useAuth, SignInButton } from '@clerk/react'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3002/api'

function fmt(b) {
  if (!b) return ''
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'
  return (b / 1048576).toFixed(1) + ' MB'
}

function relDate(d) {
  if (!d) return ''
  const s = (Date.now() - new Date(d)) / 1000
  if (s < 60)     return 'recién'
  if (s < 3600)   return 'hace ' + Math.floor(s / 60) + ' min'
  if (s < 86400)  return 'hace ' + Math.floor(s / 3600) + 'h'
  if (s < 604800) return 'hace ' + Math.floor(s / 86400) + 'd'
  return new Date(d).toLocaleDateString('es-AR', { day:'numeric', month:'short', year:'numeric' })
}

function getFileInfo(name = '') {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf')                    return { type: 'pdf',   icon: FileText,      label: 'PDF' }
  if (['png','jpg','jpeg','gif','webp'].includes(ext)) return { type: 'image', icon: FileImage, label: ext.toUpperCase() }
  if (['doc','docx'].includes(ext))     return { type: 'word',  icon: File,          label: 'Word' }
  if (['ppt','pptx'].includes(ext))     return { type: 'ppt',   icon: Presentation,  label: 'PPT' }
  return { type: 'other', icon: File, label: ext.toUpperCase() || 'FILE' }
}

// ¿La API es alcanzable desde internet? (los visores externos necesitan una URL pública)
function isPublicHost(url) {
  try {
    const h = new URL(url, window.location.origin).hostname
    if (h.endsWith('.local')) return false
    return !/^(localhost$|127\.|0\.0\.0\.0$|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)
  } catch { return false }
}

// Card de "no se pudo previsualizar" con acciones para no dejar a nadie trabado
function NoPreview({ file, label, Icon, title, desc, openUrl }) {
  return (
    <div className="pv-no-preview">
      <div className="pv-no-icon">
        <Icon size={52} strokeWidth={1.2} />
        <span className="pv-no-badge">{label}</span>
      </div>
      <h3 className="pv-no-title">{title}</h3>
      <p className="pv-no-desc">{desc}</p>
      {openUrl && (
        <a className="pv-open-btn" href={openUrl} target="_blank" rel="noreferrer">
          <ExternalLink size={15} /> Abrir en pestaña nueva
        </a>
      )}
    </div>
  )
}

// ── Preview content by type ────────────────────────────────────────────────
function PreviewContent({ file }) {
  const [imgError, setImgError] = useState(false)

  // Archivo de Google Drive: usa el preview embebido de Drive
  if (file.type === 'drive-file') {
    return (
      <iframe
        className="pv-iframe"
        src={file.previewUrl}
        title={file.name}
        allow="autoplay"
      >
        <p className="pv-fallback">
          No se puede previsualizar.{' '}
          <a href={file.viewUrl} target="_blank" rel="noreferrer">Abrir en Drive</a>
        </p>
      </iframe>
    )
  }

  const { type, icon: Icon, label } = getFileInfo(file.name)
  const previewUrl = `${API}/preview?key=${encodeURIComponent(file.key)}`
  // URL absoluta (la API puede estar configurada como ruta relativa "/api")
  const absUrl = new URL(previewUrl, window.location.origin).href

  if (type === 'pdf') {
    // <object> renderiza el PDF donde el browser puede, y muestra el fallback
    // automáticamente donde no (ej: Chrome en Android no renderiza PDFs embebidos)
    return (
      <object className="pv-iframe" data={previewUrl} type="application/pdf" aria-label={file.name}>
        <NoPreview
          file={file} label={label} Icon={Icon}
          title="Tu navegador no muestra PDFs acá"
          desc="Abrilo en una pestaña nueva o descargalo — el archivo está perfecto."
          openUrl={previewUrl}
        />
      </object>
    )
  }

  if (type === 'image') {
    if (imgError) {
      return (
        <NoPreview
          file={file} label={label} Icon={Icon}
          title="No se pudo cargar la imagen"
          desc="Probá abrirla en una pestaña nueva o descargarla."
          openUrl={previewUrl}
        />
      )
    }
    return (
      <div className="pv-img-wrap">
        <img
          className="pv-img"
          src={previewUrl}
          alt={file.name}
          loading="lazy"
          onError={() => setImgError(true)}
        />
      </div>
    )
  }

  // Word / PPT — en producción usamos el visor de Office Online (necesita URL pública)
  if (type === 'word' || type === 'ppt') {
    if (isPublicHost(absUrl)) {
      return (
        <iframe
          className="pv-iframe"
          src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(absUrl)}`}
          title={file.name}
        >
          <p className="pv-fallback">
            No se puede previsualizar.{' '}
            <a href={`${API}/download?key=${encodeURIComponent(file.key)}`} target="_blank" rel="noreferrer">Descargar</a>
          </p>
        </iframe>
      )
    }
    return (
      <NoPreview
        file={file} label={label} Icon={Icon}
        title="Vista previa no disponible en local"
        desc={`Los archivos ${label} se previsualizan con el visor de Office cuando el sitio está publicado. Mientras tanto, descargalo para verlo.`}
      />
    )
  }

  // Otros tipos — sin preview nativo
  return (
    <NoPreview
      file={file} label={label} Icon={Icon}
      title="Vista previa no disponible"
      desc={`Los archivos ${label} no se pueden mostrar directamente en el navegador. Descargalo para abrirlo con tu aplicación.`}
    />
  )
}

// ── Comentarios (estilo classroom) ─────────────────────────────────────────
function CommentsPanel({ fileKey }) {
  const { isSignedIn, getToken } = useAuth()
  const [comments, setComments] = useState(null)   // null = cargando
  const [text, setText]         = useState('')
  const [sending, setSending]   = useState(false)
  const [error, setError]       = useState(null)
  const listRef = useRef(null)

  const authHeaders = async () => {
    const token = isSignedIn ? await getToken() : null
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const headers = await authHeaders()
        const res = await fetch(`${API}/comments?key=${encodeURIComponent(fileKey)}`, { headers })
        const d = res.ok ? await res.json() : []
        if (alive) setComments(Array.isArray(d) ? d : [])
      } catch { if (alive) setComments([]) }
    })()
    return () => { alive = false }
  }, [fileKey, isSignedIn])

  const send = async () => {
    const t = text.trim()
    if (!t || sending) return
    setSending(true); setError(null)
    try {
      const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' }
      const res = await fetch(`${API}/comments`, {
        method: 'POST', headers,
        body: JSON.stringify({ key: fileKey, text: t }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'No se pudo comentar')
      const c = await res.json()
      setComments(prev => [...(prev ?? []), c])
      setText('')
      // Scroll al final para ver el comentario nuevo
      setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }), 50)
    } catch (err) { setError(err.message) }
    finally { setSending(false) }
  }

  const remove = async id => {
    if (!window.confirm('¿Borrar este comentario?')) return
    try {
      const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' }
      const res = await fetch(`${API}/comments`, {
        method: 'DELETE', headers,
        body: JSON.stringify({ key: fileKey, id }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'No se pudo borrar')
      setComments(prev => (prev ?? []).filter(c => c.id !== id))
    } catch (err) { alert(err.message) }
  }

  const count = comments?.length ?? 0

  return (
    <aside className="pv-comments" aria-label="Comentarios del apunte">
      <div className="pv-com-head">
        <MessageSquare size={15} />
        <span>Comentarios{count > 0 ? ` (${count})` : ''}</span>
      </div>

      <div className="pv-com-list" ref={listRef}>
        {comments === null && (
          <div className="pv-com-loading"><Loader size={16} className="pv-spin" /> Cargando…</div>
        )}
        {comments !== null && count === 0 && (
          <p className="pv-com-empty">
            Todavía no hay comentarios.<br />
            Dejá feedback para mejorar la calidad del apunte: qué está bueno, qué falta, qué corregirías.
          </p>
        )}
        {(comments ?? []).map(c => (
          <div key={c.id} className={`pv-com ${c.mine ? 'pv-com--mine' : ''}`}>
            {c.avatar
              ? <img className="pv-com-avatar" src={c.avatar} alt="" loading="lazy" />
              : <span className="pv-com-avatar pv-com-avatar--init">{(c.name || '?').charAt(0).toUpperCase()}</span>}
            <div className="pv-com-body">
              <div className="pv-com-meta">
                <b className="pv-com-name">{c.name}</b>
                <span className="pv-com-date">{relDate(c.at)}</span>
                {c.canDelete && (
                  <button className="pv-com-del" onClick={() => remove(c.id)} title="Borrar comentario">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
              <p className="pv-com-text">{c.text}</p>
            </div>
          </div>
        ))}
      </div>

      {isSignedIn ? (
        <div className="pv-com-input-row">
          <textarea
            className="pv-com-input"
            placeholder="Agregá un comentario…"
            value={text}
            maxLength={1000}
            rows={1}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          />
          <button className="pv-com-send" onClick={send} disabled={!text.trim() || sending}
            title="Enviar (Enter)" aria-label="Enviar comentario">
            {sending ? <Loader size={15} className="pv-spin" /> : <Send size={15} />}
          </button>
          {error && <span className="pv-com-err">{error}</span>}
        </div>
      ) : (
        <div className="pv-com-signin">
          <SignInButton mode="modal">
            <button type="button">Iniciá sesión para comentar</button>
          </SignInButton>
        </div>
      )}
    </aside>
  )
}

// ── Modal ──────────────────────────────────────────────────────────────────
export default function PreviewModal({ file, onClose }) {
  const overlayRef = useRef(null)

  // Cerrar con Escape
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Bloquear scroll del body
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleOverlayClick = e => {
    if (e.target === overlayRef.current) onClose()
  }

  const isDrive = file.type === 'drive-file'
  const downloadUrl = isDrive ? file.viewUrl : `${API}/download?key=${encodeURIComponent(file.key)}`
  const { label } = isDrive ? { label: (file.kind || 'Drive').toUpperCase() } : getFileInfo(file.name)
  const hasComments = !isDrive && !!file.key   // los comentarios viven sobre archivos del vault

  return createPortal(
    <AnimatePresence>
      <motion.div
        ref={overlayRef}
        className="pv-overlay"
        onClick={handleOverlayClick}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
      >
        <motion.div
          className={`pv-modal ${hasComments ? 'pv-modal--wide' : ''}`}
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1,    y: 0  }}
          exit={{    opacity: 0, scale: 0.96, y: 12  }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Header */}
          <div className="pv-header">
            <div className="pv-header-left">
              <span className="pv-header-badge">{label}</span>
              <span className="pv-header-name" title={file.name}>{file.name}</span>
            </div>
            <div className="pv-header-actions">
              <a
                className="pv-dl-btn"
                href={downloadUrl}
                download={file.name}
                target="_blank"
                rel="noreferrer"
                title="Descargar"
              >
                <Download size={16} />
                Descargar
              </a>
              <button className="pv-close-btn" onClick={onClose} title="Cerrar (Esc)">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Preview + comentarios */}
          <div className={`pv-main ${hasComments ? 'pv-main--split' : ''}`}>
            <div className="pv-body">
              <PreviewContent file={file} />
            </div>
            {hasComments && <CommentsPanel fileKey={file.key} />}
          </div>

          {/* Footer */}
          <div className="pv-footer">
            {file.size         && <span className="pv-meta">{fmt(file.size)}</span>}
            {file.lastModified && <><span className="pv-meta-sep">·</span><span className="pv-meta">{relDate(file.lastModified)}</span></>}
            <span className="pv-hint">Presioná Esc o hacé click afuera para cerrar</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
