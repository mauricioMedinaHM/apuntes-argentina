import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import { X, Download, FileText, File, FileImage, Presentation } from 'lucide-react'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3002/api'

function fmt(b) {
  if (!b) return ''
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'
  return (b / 1048576).toFixed(1) + ' MB'
}

function relDate(d) {
  if (!d) return ''
  const s = (Date.now() - new Date(d)) / 1000
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

// ── Preview content by type ────────────────────────────────────────────────
function PreviewContent({ file }) {
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

  const { type } = getFileInfo(file.name)
  const previewUrl = `${API}/preview?key=${encodeURIComponent(file.key)}`

  if (type === 'pdf') {
    return (
      <iframe
        className="pv-iframe"
        src={previewUrl}
        title={file.name}
        // fallback message for old browsers
      >
        <p className="pv-fallback">
          Tu browser no puede mostrar PDFs directamente.{' '}
          <a href={previewUrl} target="_blank" rel="noreferrer">Abrí en nueva pestaña</a>
        </p>
      </iframe>
    )
  }

  if (type === 'image') {
    return (
      <div className="pv-img-wrap">
        <img
          className="pv-img"
          src={previewUrl}
          alt={file.name}
          loading="lazy"
        />
      </div>
    )
  }

  // Word / PPT / otros — no hay preview nativo en el browser
  const { icon: Icon, label } = getFileInfo(file.name)
  return (
    <div className="pv-no-preview">
      <div className="pv-no-icon">
        <Icon size={52} strokeWidth={1.2} />
        <span className="pv-no-badge">{label}</span>
      </div>
      <h3 className="pv-no-title">Vista previa no disponible</h3>
      <p className="pv-no-desc">
        Los archivos {label} no se pueden mostrar directamente en el browser.<br />
        Descargalo para abrirlo con tu aplicación.
      </p>
    </div>
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
          className="pv-modal"
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

          {/* Preview area */}
          <div className="pv-body">
            <PreviewContent file={file} />
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
