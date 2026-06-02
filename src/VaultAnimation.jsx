import { motion, AnimatePresence } from 'motion/react'
import { useState, useEffect } from 'react'
import { FileText, FolderOpen, Lock, LockOpen, CheckCircle, ChevronRight, Folder } from 'lucide-react'

const EXAMPLES = [
  {
    file: 'Resumen_Contratos.pdf',
    type: 'Resumen de clase',
    size: '2.4 MB',
    path: ['UBA', 'Derecho', 'Derecho Civil I'],
  },
  {
    file: 'Guia_Grafos_2024.pdf',
    type: 'Guía de ejercicios',
    size: '1.1 MB',
    path: ['UTN', 'Ing. en Sistemas', 'Algoritmos III'],
  },
  {
    file: 'Anatomia_Miembro_Inf.pdf',
    type: 'Apunte de clase',
    size: '4.8 MB',
    path: ['UNC', 'Medicina', 'Anatomía II'],
  },
  {
    file: 'Calculo_Parcial1_Res.pdf',
    type: 'Parcial resuelto',
    size: '0.9 MB',
    path: ['UNLP', 'Ingeniería', 'Cálculo I'],
  },
]

const DURATIONS = [2800, 550, 950, 720, 2600, 1600]

const OTHER_FOLDERS = ['UBA', 'UTN', 'UNC', 'UNLP', 'UNR', '...']

export default function VaultAnimation() {
  const [phase, setPhase] = useState(0)
  const [exIdx, setExIdx] = useState(0)
  const ex = EXAMPLES[exIdx]

  useEffect(() => {
    const t = setTimeout(() => {
      setPhase(p => {
        if (p >= 5) {
          setExIdx(i => (i + 1) % EXAMPLES.length)
          return 0
        }
        return p + 1
      })
    }, DURATIONS[phase])
    return () => clearTimeout(t)
  }, [phase])

  const isDoorOpen = phase >= 3
  const showTree = phase >= 4
  const isDone = phase === 5

  const filePos = (() => {
    if (phase === 0) return { x: 0, y: 0, scale: 1, opacity: 1, rotate: 0 }
    if (phase === 1) return { x: 2, y: -7, scale: 1.06, opacity: 1, rotate: -2 }
    if (phase === 2) return { x: 330, y: -30, scale: 0.35, opacity: 0, rotate: 6 }
    return { x: 340, y: -40, scale: 0.2, opacity: 0, rotate: 10 }
  })()

  const PHASE_LABELS = [
    'Arrastrá un apunte al vault',
    'Tomando el archivo…',
    'Enviando al vault…',
    'Abriendo vault…',
    'Organizando automáticamente…',
    `Guardado en ${ex.path.join(' › ')}`,
  ]

  return (
    <div className="vault-scene">
      {/* ── LEFT: floating file card ── */}
      <div className="vault-left">
        <motion.div
          className="vfile"
          animate={filePos}
          transition={
            phase === 0
              ? { duration: 0.4 }
              : phase === 2
              ? { duration: 0.85, ease: [0.55, 0.05, 1, 0.45] }
              : { duration: 0.3 }
          }
        >
          <motion.div
            animate={phase === 0 ? { y: [0, -9, 0] } : { y: 0 }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
            className="vfile-inner"
          >
            <div className="vfile-icon-wrap">
              <FileText size={28} strokeWidth={1.5} className="vfile-icon" />
              <span className="vfile-badge">PDF</span>
            </div>
            <div className="vfile-body">
              <span className="vfile-name">{ex.file}</span>
              <span className="vfile-meta">{ex.type} · {ex.size}</span>
            </div>
            {phase === 0 && (
              <motion.div
                className="vfile-hint"
                animate={{ opacity: [0.5, 1, 0.5], x: [0, 5, 0] }}
                transition={{ duration: 1.4, repeat: Infinity }}
              >
                <ChevronRight size={15} />
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      </div>

      {/* ── CENTER: arrow + label ── */}
      <div className="vault-center">
        <motion.div
          className="vault-path"
          animate={{ opacity: phase <= 1 ? 0.45 : phase === 2 ? 1 : 0.08 }}
          transition={{ duration: 0.5 }}
        >
          {/* On mobile (CSS rotates this 90°) the arrow points down */}
          <svg width="96" height="22" viewBox="0 0 96 22" fill="none">
            <motion.line
              x1="2" y1="11" x2="82" y2="11"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="5 4"
              animate={{ strokeDashoffset: [30, 0] }}
              transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
            />
            <path d="M78 7 L86 11 L78 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.p
            key={phase}
            className={`vault-label ${isDone ? 'vault-label--done' : ''}`}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
          >
            {isDone
              ? <><CheckCircle size={13} className="vault-label-check" /> {PHASE_LABELS[phase]}</>
              : PHASE_LABELS[phase]
            }
          </motion.p>
        </AnimatePresence>
      </div>

      {/* ── RIGHT: vault ── */}
      <div className="vault-right">
        <div className="vault-wrap">
          {/* Interior — always rendered, door covers it */}
          <div className="vault-interior">
            <p className="vault-title">
              <span className="vault-dot" />
              Vault
            </p>
            <AnimatePresence mode="wait">
              {showTree ? (
                <motion.div
                  key="tree"
                  className="vault-tree"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  {[
                    { label: ex.path[0], depth: 0, delay: 0,    isFile: false },
                    { label: ex.path[1], depth: 1, delay: 0.22, isFile: false },
                    { label: ex.path[2], depth: 2, delay: 0.44, isFile: false },
                    { label: ex.file,    depth: 3, delay: 0.7,  isFile: true  },
                  ].map(({ label, depth, delay, isFile }) => (
                    <motion.div
                      key={label}
                      className={`vt-row ${isFile ? 'vt-row--file' : ''}`}
                      style={{ paddingLeft: 8 + depth * 14 }}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay, duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {isFile
                        ? <FileText size={11} className="vt-icon vt-icon--file" />
                        : <FolderOpen size={12} className="vt-icon vt-icon--folder" />
                      }
                      <span className="vt-label">{label}</span>
                      {isFile && isDone && (
                        <motion.span
                          className="vt-saved"
                          initial={{ opacity: 0, scale: 0.6 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.35, type: 'spring', stiffness: 260, damping: 20 }}
                        >
                          <CheckCircle size={10} /> guardado
                        </motion.span>
                      )}
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  className="vault-idle-folders"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                >
                  {OTHER_FOLDERS.map((name, i) => (
                    <motion.div
                      key={name}
                      className="vif-row"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.45 }}
                      transition={{ delay: i * 0.06 }}
                    >
                      <Folder size={11} />
                      <span>{name}</span>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Door panel — scaleX collapses from left to open */}
          <motion.div
            className="vault-door"
            animate={{
              scaleX: isDoorOpen ? 0 : 1,
              opacity: isDoorOpen ? 0 : 1,
            }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: 'left center' }}
          >
            <motion.div
              animate={{ scale: isDoorOpen ? 0.7 : 1, opacity: isDoorOpen ? 0 : 1 }}
              transition={{ duration: 0.4 }}
              className="vault-door-content"
            >
              <Lock size={26} strokeWidth={1.5} className="vault-lock-icon" />
              <span className="vault-door-title">Vault</span>
              <div className="vault-door-lines">
                {[1, 2, 3].map(n => (
                  <motion.div
                    key={n}
                    className="vault-door-line"
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 1.8, repeat: Infinity, delay: n * 0.2 }}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>

          {/* Open lock badge */}
          <AnimatePresence>
            {isDoorOpen && (
              <motion.div
                className="vault-open-badge"
                initial={{ opacity: 0, scale: 0.5, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              >
                <LockOpen size={13} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Progress dots */}
        <div className="vault-progress">
          {EXAMPLES.map((_, i) => (
            <motion.div
              key={i}
              className="vault-dot-indicator"
              animate={{ scale: i === exIdx ? 1 : 0.6, opacity: i === exIdx ? 1 : 0.3 }}
              transition={{ duration: 0.3 }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
