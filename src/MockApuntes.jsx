import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { FileText, Download, Search, Upload, ChevronRight, Star, Clock, Filter } from 'lucide-react'

const MOCK_DATA = {
  UBA: {
    Derecho: {
      'Derecho Civil I': [
        { name: 'Resumen Contratos — Unidades 1 a 4', type: 'Resumen', size: '2.4 MB', date: 'hace 2 días',  author: 'maru92',          stars: 18 },
        { name: 'Teórico completo — Obligaciones',    type: 'Teórico', size: '5.1 MB', date: 'hace 1 sem',  author: 'juanDerecho',      stars: 34 },
        { name: 'Guía de ejercicios para el parcial', type: 'Guía',    size: '0.8 MB', date: 'hace 2 sem',  author: 'abogado_studioso', stars: 12 },
        { name: 'Caso práctico — Compraventa',        type: 'Práctico',size: '1.2 MB', date: 'hace 3 sem',  author: 'fabi_uba',         stars: 7  },
      ],
      'Derecho Comercial I': [
        { name: 'Resumen Sociedades completo',   type: 'Resumen', size: '3.2 MB', date: 'hace 4 días', author: 'comercial_uba', stars: 22 },
        { name: 'Apunte de clase — Unidad 5',    type: 'Apunte',  size: '1.5 MB', date: 'hace 2 sem', author: 'leo_uba',       stars: 9  },
      ],
    },
    Medicina: {
      'Anatomía I': [
        { name: 'Atlas miembro superior',            type: 'Atlas',   size: '6.2 MB', date: 'ayer',       author: 'med_primerAño', stars: 41 },
        { name: 'Resumen osificación y articulaciones', type: 'Resumen', size: '2.1 MB', date: 'hace 3 días', author: 'fisi_uba', stars: 28 },
      ],
    },
  },
  UTN: {
    'Ing. en Sistemas': {
      'Algoritmos III': [
        { name: 'Guía Grafos 2024 — con soluciones',  type: 'Guía',    size: '1.1 MB', date: 'hace 3 días', author: 'dev_tucuman',  stars: 19 },
        { name: 'Resumen Algoritmos III completo',    type: 'Resumen', size: '3.2 MB', date: 'hace 1 sem',  author: 'santi_sys',    stars: 26 },
        { name: 'Parcial resuelto 2023',              type: 'Parcial', size: '0.5 MB', date: 'hace 1 mes',  author: 'anoni_tec',    stars: 14 },
      ],
      'Análisis Matemático II': [
        { name: 'Resumen integrales — toda la unidad', type: 'Resumen', size: '2.8 MB', date: 'hace 5 días', author: 'mat_utn', stars: 31 },
      ],
    },
  },
  UNC: {
    Medicina: {
      'Anatomía II': [
        { name: 'Atlas miembro inferior — completo',   type: 'Atlas',   size: '4.8 MB', date: 'ayer',       author: 'med_cordoba', stars: 47 },
        { name: 'Fisiología cardiovascular',           type: 'Resumen', size: '2.1 MB', date: 'hace 5 días', author: 'fisi_unc',    stars: 23 },
        { name: 'Histología — láminas completas',      type: 'Atlas',   size: '8.3 MB', date: 'hace 2 sem',  author: 'histo_q5',    stars: 35 },
      ],
    },
    Derecho: {
      'Derecho Romano': [
        { name: 'Resumen Historia del Derecho',  type: 'Resumen', size: '1.8 MB', date: 'hace 1 sem', author: 'romano_unc', stars: 11 },
      ],
    },
  },
  UNLP: {
    Ingeniería: {
      'Cálculo I': [
        { name: 'Resumen derivadas e integrales',  type: 'Resumen', size: '2.2 MB', date: 'hace 2 días', author: 'calc_lp',  stars: 16 },
        { name: 'Parcial resuelto — 1er cuatri',   type: 'Parcial', size: '0.6 MB', date: 'hace 3 sem',  author: 'ing_lp',   stars: 8  },
      ],
    },
  },
}

const TYPE_COLORS = {
  Resumen: '#2D5FA3',
  Teórico: '#23355C',
  Guía:    '#1A5C38',
  Práctico:'#5C3317',
  Parcial: '#8B0000',
  Atlas:   '#6B2D8B',
  Apunte:  '#005B5E',
}

export default function MockApuntes() {
  const unis = Object.keys(MOCK_DATA)
  const [uni, setUni] = useState('UBA')
  const careers = Object.keys(MOCK_DATA[uni])
  const [career, setCareer] = useState(careers[0])
  const subjects = Object.keys(MOCK_DATA[uni][career] || {})
  const [subject, setSubject] = useState(subjects[0])

  const handleUni = u => {
    setUni(u)
    const c = Object.keys(MOCK_DATA[u])[0]
    setCareer(c)
    setSubject(Object.keys(MOCK_DATA[u][c])[0])
  }

  const handleCareer = c => {
    setCareer(c)
    setSubject(Object.keys(MOCK_DATA[uni][c])[0])
  }

  const files = MOCK_DATA[uni][career]?.[subject] ?? []

  return (
    <div className="mock-browser">
      {/* Browser chrome */}
      <div className="mock-chrome">
        <div className="mock-chrome-dots">
          <span className="mcd mcd--red" />
          <span className="mcd mcd--yellow" />
          <span className="mcd mcd--green" />
        </div>
        <div className="mock-chrome-url">
          <span className="mock-url-lock">🔒</span>
          apuntesargentina.ar
        </div>
        <div className="mock-chrome-spacer" />
      </div>

      {/* App content */}
      <div className="mock-app">
        {/* Top bar */}
        <div className="mock-topbar">
          <div className="mock-search-wrap">
            <Search size={14} className="mock-search-icon" />
            <input
              className="mock-search"
              placeholder="Buscar apuntes, materias, carreras…"
              readOnly
            />
          </div>
          <button className="mock-upload-btn" disabled>
            <Upload size={13} /> Subir apunte
          </button>
        </div>

        {/* Uni tabs */}
        <div className="mock-uni-tabs">
          {unis.map(u => (
            <button
              key={u}
              className={`mock-uni-tab ${u === uni ? 'mock-uni-tab--active' : ''}`}
              onClick={() => handleUni(u)}
            >
              {u}
            </button>
          ))}
        </div>

        <div className="mock-body">
          {/* Left sidebar — on mobile becomes horizontal scroll tabs */}
          <div className="mock-sidebar">
            <p className="mock-sidebar-label">Carreras</p>
            {careers.map(c => (
              <button
                key={c}
                className={`mock-career-btn ${c === career ? 'mock-career-btn--active' : ''}`}
                onClick={() => handleCareer(c)}
              >
                {c}
              </button>
            ))}

            <p className="mock-sidebar-label" style={{ marginTop: 20 }}>Materias</p>
            {subjects.map(s => (
              <button
                key={s}
                className={`mock-subject-btn ${s === subject ? 'mock-subject-btn--active' : ''}`}
                onClick={() => setSubject(s)}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Main content */}
          <div className="mock-main">
            {/* Breadcrumb */}
            <div className="mock-breadcrumb">
              <span className="mock-bc-root">ApuntesArgentina</span>
              <ChevronRight size={13} className="mock-bc-sep" />
              <span>{uni}</span>
              <ChevronRight size={13} className="mock-bc-sep" />
              <span>{career}</span>
              <ChevronRight size={13} className="mock-bc-sep" />
              <span className="mock-bc-current">{subject}</span>
            </div>

            {/* Stats row */}
            <div className="mock-stats-row">
              <span className="mock-stat"><FileText size={12} /> {files.length} apuntes</span>
              <span className="mock-stat"><Filter size={12} /> Todos los tipos</span>
              <span className="mock-stat"><Clock size={12} /> Más recientes</span>
            </div>

            {/* File list */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`${uni}-${career}-${subject}`}
                className="mock-files"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                {files.map((f, i) => (
                  <motion.div
                    key={f.name}
                    className="mock-file-row"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.25 }}
                  >
                    <div className="mock-file-pdf">
                      <FileText size={20} strokeWidth={1.5} />
                    </div>
                    <div className="mock-file-info">
                      <span className="mock-file-name">{f.name}</span>
                      <div className="mock-file-meta-row">
                        <span
                          className="mock-file-type"
                          style={{ background: TYPE_COLORS[f.type] ?? '#576F92' }}
                        >
                          {f.type}
                        </span>
                        <span className="mock-file-size">{f.size}</span>
                        <span className="mock-file-date">{f.date}</span>
                        <span className="mock-file-author">por {f.author}</span>
                      </div>
                    </div>
                    <div className="mock-file-actions">
                      <span className="mock-file-stars">
                        <Star size={12} fill="currentColor" /> {f.stars}
                      </span>
                      <button className="mock-dl-btn" disabled>
                        <Download size={14} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Coming-soon overlay */}
      <div className="mock-overlay">
        <div className="mock-overlay-badge">
          <span className="mock-overlay-dot" />
          Vista previa — En desarrollo
        </div>
      </div>
    </div>
  )
}
