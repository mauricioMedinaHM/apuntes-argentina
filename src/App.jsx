import { motion, useInView, AnimatePresence } from 'motion/react'
import { useRef, useState, useEffect } from 'react'
import {
  BookOpen,
  Search,
  Upload,
  Github,
  Instagram,
  Twitter,
  MapPin,
  Users,
  Heart,
  ArrowRight,
  BookMarked,
  Terminal,
  FolderOpen,
  FileSearch,
  Download,
  List,
  RotateCcw,
  Cpu,
} from 'lucide-react'

import { SignInButton, SignUpButton, UserButton, useAuth } from '@clerk/react'
import VaultAnimation from './VaultAnimation'
import MockApuntes from './MockApuntes'
import SplashScreen, { shouldShowSplash } from './SplashScreen'
import UploadPage from './UploadPage'
import ApuntesPage from './ApuntesPage'
import { UNIVERSITIES } from './universities.js'
import './App.css'
import './UploadPage.css'
import './ApuntesPage.css'

const MCP_TOOLS = [
  { icon: MapPin,      fn: 'list_universities', desc: 'Devuelve las universidades disponibles en el vault.' },
  { icon: BookOpen,    fn: 'list_careers',      desc: 'Lista las carreras disponibles para una universidad.' },
  { icon: FolderOpen,  fn: 'list_subjects',     desc: 'Muestra las materias con apuntes cargados.' },
  { icon: Download,    fn: 'load_subject',      desc: 'Descarga los PDFs, extrae el texto y lo guarda en sesión.' },
  { icon: FileSearch,  fn: 'search_notes',      desc: 'Búsqueda TF-IDF sobre el contenido cargado en la sesión actual.' },
  { icon: List,        fn: 'get_context',       desc: 'Muestra qué materias, archivos y chunks están en sesión.' },
  { icon: RotateCcw,   fn: 'clear_context',     desc: 'Resetea el contexto de sesión para empezar de nuevo.' },
]

const MCP_CONFIG = `{
  "mcpServers": {
    "apuntes-argentina": {
      "command": "node",
      "args": ["/ruta/a/apuntes-argentina-mcp/dist/index.js"],
      "env": {
        "S3_BUCKET_NAME": "apuntes-argentina",
        "S3_ACCESS_KEY_ID": "tu_key",
        "S3_SECRET_ACCESS_KEY": "tu_secret",
        "S3_ENDPOINT": "https://xxx.r2.cloudflarestorage.com",
        "S3_REGION": "auto"
      }
    }
  }
}`

const STEPS = [
  {
    icon: MapPin,
    step: '01',
    title: 'Entrás',
    desc: 'Accedés a ApuntesArgentina sin registrarte. Sin formularios, sin contraseñas.',
  },
  {
    icon: Search,
    step: '02',
    title: 'Buscás tu facultad',
    desc: 'Elegís tu universidad y materia. Todo organizado por carrera y cátedra.',
  },
  {
    icon: BookOpen,
    step: '03',
    title: 'Encontrás los apuntes',
    desc: 'Descargás lo que necesitás y, si querés, subís los tuyos para ayudar a los que vienen.',
  },
]

function FadeIn({ children, delay = 0, direction = 'up', className = '' }) {
  const ref = useRef(null)
  const isMobileView = typeof window !== 'undefined' && window.innerWidth <= 768
  const inView = useInView(ref, { once: true, margin: isMobileView ? '0px' : '-80px' })

  const variants = {
    hidden: {
      opacity: 0,
      y: direction === 'up' ? 32 : direction === 'down' ? -32 : 0,
      x: direction === 'left' ? 32 : direction === 'right' ? -32 : 0,
    },
    visible: { opacity: 1, y: 0, x: 0 },
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      variants={variants}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

function UniLogo({ uni }) {
  if (!uni.logo) {
    return (
      <div className="uni-logo-wrap">
        <div className="uni-initial" style={{ background: uni.color }}>{uni.name}</div>
      </div>
    )
  }

  // src directo — todos los archivos en universities.js existen y son válidos
  return (
    <div className="uni-logo-wrap">
      <img
        src={uni.logo}
        alt={`Logo ${uni.name}`}
        className="uni-logo-img"
        loading="lazy"
        decoding="async"
        onError={e => {
          e.currentTarget.closest('.uni-logo-wrap').innerHTML =
            `<div class="uni-initial" style="background:${uni.color};width:100%;height:38px;border-radius:6px;display:flex;align-items:center;justify-content:center;color:white;font-weight:800;font-size:0.72rem;letter-spacing:0.04em">${uni.name}</div>`
        }}
      />
    </div>
  )
}

function UniversityCard({ uni, delay }) {
  return (
    <FadeIn delay={delay}>
      <motion.div
        className="uni-card"
        whileHover={{ y: -4, boxShadow: '0 8px 24px rgba(35,53,92,0.15)' }}
        transition={{ duration: 0.2 }}
      >
        <UniLogo uni={uni} />
        <span className="uni-abbr">{uni.name}</span>
        <span className="uni-full">{uni.full}</span>
        <span className={`uni-type-badge uni-type-badge--${uni.type}`}>
          {uni.type === 'nacional' ? 'Nacional' : uni.type === 'privada' ? 'Privada' : uni.type === 'provincial' ? 'Provincial' : 'Instituto'}
        </span>
      </motion.div>
    </FadeIn>
  )
}

function NavAuth() {
  const { isSignedIn } = useAuth()
  if (isSignedIn) return <UserButton />
  return (
    <>
      <SignInButton mode="modal">
        <button className="nav-signin-btn">Iniciar sesión</button>
      </SignInButton>
      <SignUpButton mode="modal">
        <button className="nav-signup-btn">Registrarse</button>
      </SignUpButton>
    </>
  )
}

export default function App() {
  const [showSplash, setShowSplash] = useState(shouldShowSplash)
  const [view, setView]             = useState('landing') // 'landing' | 'upload' | 'apuntes'
  const [uniFilter, setUniFilter]   = useState('todas')
  const [navOpen, setNavOpen]       = useState(false)
  const [showAllUnis, setShowAllUnis] = useState(false)
  const [heroVisible, setHeroVisible] = useState(true)
  const heroRef = useRef(null)

  // Ocultar el CTA sticky mientras el hero (con su propio CTA) está a la vista
  useEffect(() => {
    if (view !== 'landing') return
    const el = heroRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => setHeroVisible(entry.isIntersecting),
      { threshold: 0.15 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [view, showSplash])
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768

  if (view === 'upload') {
    return <UploadPage onBack={() => setView('landing')} />
  }

  if (view === 'apuntes') {
    return (
      <ApuntesPage
        onBack={() => setView('landing')}
        onUpload={() => setView('upload')}
      />
    )
  }

  return (
    <>
      <AnimatePresence>
        {showSplash && (
          <SplashScreen key="splash" onDone={() => setShowSplash(false)} />
        )}
      </AnimatePresence>

    <div className="app">
      {/* ── HERO ── */}
      <header className="hero" ref={heroRef}>
        {/* Sol de Mayo watermark — image-led hero (Impeccable: Brand mode) */}
        <div className="hero-sol-watermark" aria-hidden="true" />
        <nav className="nav">
          <div className="nav-logo">
            <BookMarked size={24} strokeWidth={2} />
            <span>ApuntesArgentina</span>
          </div>

          {/* Desktop actions */}
          <div className="nav-actions nav-actions--desktop">
            <button className="nav-upload-btn" onClick={() => setView('upload')}>
              <Upload size={15} />
              Subir apunte
            </button>
            <a href="https://github.com/mauricioMedinaHM/apuntes-argentina" target="_blank" rel="noopener noreferrer" className="nav-github">
              <Github size={18} />
              GitHub
            </a>
            <NavAuth />
          </div>

          {/* Mobile: auth icon + hamburger */}
          <div className="nav-actions nav-actions--mobile">
            <button className="nav-hamburger" onClick={() => setNavOpen(o => !o)} aria-label="Menú">
              <span className={`nav-hamburger-line ${navOpen ? 'nav-hamburger-line--open' : ''}`} />
              <span className={`nav-hamburger-line ${navOpen ? 'nav-hamburger-line--open' : ''}`} />
              <span className={`nav-hamburger-line ${navOpen ? 'nav-hamburger-line--open' : ''}`} />
            </button>
          </div>

          {/* Mobile drawer — hijo del nav para que top:100% quede bajo la barra */}
          <AnimatePresence>
            {navOpen && (
              <motion.div
                className="nav-drawer"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <div className="nav-drawer-auth"><NavAuth /></div>
                <button className="nav-drawer-item" onClick={() => { setView('upload'); setNavOpen(false) }}>
                  <Upload size={18} /> Subir apunte
                </button>
                <a href="https://github.com/mauricioMedinaHM/apuntes-argentina" target="_blank" rel="noopener noreferrer" className="nav-drawer-item" onClick={() => setNavOpen(false)}>
                  <Github size={18} /> GitHub
                </a>
              </motion.div>
            )}
          </AnimatePresence>
        </nav>

        <div className="hero-content">
          <motion.div
            className="hero-badge"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            Open Source · Sin fines de lucro
          </motion.div>

          <motion.h1
            className="hero-title"
            initial={{ opacity: 0, y: 48 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            Apuntes
            <span className="hero-title-accent">Argentina</span>
          </motion.h1>

          <motion.p
            className="hero-tagline"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            Centralizá el conocimiento.<br />
            Compartí lo que sabés.<br />
            Ayudá a los que vienen después.
          </motion.p>

          <motion.div
            className="hero-cta-group"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.button
              className="btn-primary"
              onClick={() => setView('apuntes')}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              Ir a los apuntes <ArrowRight size={18} />
            </motion.button>

            <motion.a
              href="https://cafecito.app/apuntesargentina"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-cafecito"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <span className="btn-cafecito-icon">☕</span>
              Invitame un café
            </motion.a>
          </motion.div>
        </div>

        <motion.div
          className="hero-scroll"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.8 }}
        >
          <span />
        </motion.div>
      </header>

      {/* ── WHY ── */}
      <section className="section section-why">
        <div className="container">
          <FadeIn>
            <h2 className="section-title">¿Por qué existe ApuntesArgentina?</h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <p className="section-subtitle">
              Los apuntes de las universidades públicas argentinas están desperdigados.
              Grupos de WhatsApp que se pierden, Google Drives privados que no encontrás,
              compañeros que guardan todo para ellos mismos. La información existe,
              pero nadie la puede encontrar.
            </p>
          </FadeIn>

          <div className="why-cards">
            <FadeIn delay={0.1} direction="left">
              <div className="why-card why-card--problem">
                <div className="why-card-icon">
                  <Search size={28} />
                </div>
                <h3>El problema</h3>
                <p>
                  Cada año, miles de estudiantes pierden horas buscando apuntes
                  de materias que ya fueron cursadas. La información existe —
                  pero está fragmentada, desorganizada, y a veces ni se encuentra.
                </p>
              </div>
            </FadeIn>

            <FadeIn delay={0.2} direction="right">
              <div className="why-card why-card--solution">
                <div className="why-card-icon">
                  <BookOpen size={28} />
                </div>
                <h3>La solución</h3>
                <p>
                  Un solo lugar público, sin login, organizado por universidad y materia,
                  mantenido por la propia comunidad estudiantil. Lo que sabés hoy
                  puede ayudar a alguien mañana.
                </p>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="section section-how">
        <div className="container">
          <FadeIn>
            <h2 className="section-title section-title--light">¿Cómo funciona?</h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <p className="section-subtitle section-subtitle--light">
              Tres pasos. Sin registros. Sin complicaciones.
            </p>
          </FadeIn>

          <div className="steps">
            {STEPS.map((s, i) => (
              <FadeIn key={s.step} delay={i * 0.15}>
                <motion.div
                  className="step-card"
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="step-number">{s.step}</div>
                  <div className="step-icon">
                    <s.icon size={32} strokeWidth={1.5} />
                  </div>
                  <h3 className="step-title">{s.title}</h3>
                  <p className="step-desc">{s.desc}</p>
                </motion.div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── VAULT ANIMATION ── */}
      <section className="section section-vault">
        <div className="container">
          <FadeIn>
            <h2 className="section-title">Así se organizan tus apuntes</h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <p className="section-subtitle">
              Subís un archivo y el vault lo guarda automáticamente en la carpeta correcta:
              universidad, carrera y materia. Sin que tengas que hacer nada.
            </p>
          </FadeIn>
          <FadeIn delay={0.2}>
            <VaultAnimation />
          </FadeIn>
        </div>
      </section>

      {/* ── MOCK APUNTES ── */}
      <section className="section section-demo">
        <div className="container">
          <FadeIn>
            <h2 className="section-title">Vista previa de la plataforma</h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <p className="section-subtitle">
              Así va a verse ApuntesArgentina cuando esté lista. Podés explorar
              el mockup: elegí universidad, carrera y materia para ver los apuntes disponibles.
            </p>
          </FadeIn>
          <FadeIn delay={0.2}>
            <MockApuntes />
          </FadeIn>
        </div>
      </section>

      {/* ── UNIVERSITIES ── */}
      <section className="section section-unis">
        <div className="container">
          <FadeIn>
            <h2 className="section-title">Universidades disponibles</h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <p className="section-subtitle">
              {UNIVERSITIES.filter(u => u.type === 'nacional').length} universidades nacionales,{' '}
              {UNIVERSITIES.filter(u => u.type === 'privada').length} privadas y{' '}
              {UNIVERSITIES.filter(u => u.type === 'provincial' || u.type === 'instituto').length} provinciales/institutos.
              Si la tuya no está, podés agregarla.
            </p>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div className="unis-filter-bar">
              {[
                { key: 'todas',      label: `Todas (${UNIVERSITIES.length})` },
                { key: 'nacional',   label: `Nacionales (${UNIVERSITIES.filter(u => u.type === 'nacional').length})` },
                { key: 'privada',    label: `Privadas (${UNIVERSITIES.filter(u => u.type === 'privada').length})` },
                { key: 'provincial', label: `Provinciales (${UNIVERSITIES.filter(u => u.type === 'provincial').length})` },
              ].map(f => (
                <button
                  key={f.key}
                  className={`unis-filter-btn ${uniFilter === f.key ? 'unis-filter-btn--active' : ''}`}
                  onClick={() => { setUniFilter(f.key); setShowAllUnis(false) }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </FadeIn>

          <div className={`unis-grid-wrap ${showAllUnis ? '' : 'unis-grid-wrap--collapsed'}`}>
            <div className="unis-grid">
              {UNIVERSITIES
                .filter(u => uniFilter === 'todas' || u.type === uniFilter)
                .map((uni, i) => (
                  <UniversityCard key={uni.id} uni={uni} delay={i * 0.03} />
                ))}
            </div>
            {!showAllUnis && <div className="unis-fade-overlay" aria-hidden="true" />}
          </div>

          <div className="unis-expand-wrap">
            <button
              className="unis-expand-btn"
              onClick={() => setShowAllUnis(v => !v)}
            >
              {showAllUnis
                ? 'Ver menos'
                : `Ver todas las universidades (${UNIVERSITIES.filter(u => uniFilter === 'todas' || u.type === uniFilter).length})`}
            </button>
          </div>
        </div>
      </section>

      {/* ── MCP SERVER ── */}
      <section className="section section-mcp">
        <div className="container">
          <FadeIn>
            <span className="section-label section-label--light">Para desarrolladores</span>
            <h2 className="section-title section-title--light">
              Conectá tu IA a los apuntes
            </h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <p className="section-subtitle section-subtitle--light">
              ApuntesArgentina incluye un servidor MCP open source que conecta Claude, Cursor
              y ChatGPT directamente al vault. Cargás una materia, preguntás en lenguaje natural,
              y tu IA responde con el contenido real de los apuntes — como un NotebookLM propio.
            </p>
          </FadeIn>

          {/* Flow */}
          <FadeIn delay={0.15}>
            <div className="mcp-flow">
              {['Claude · Cursor · ChatGPT', 'MCP Server', 'S3 / R2 Vault', 'Apuntes'].map((label, i) => (
                <div key={label} className="mcp-flow-item">
                  <div className="mcp-flow-node">{label}</div>
                  {i < 3 && <ArrowRight size={16} className="mcp-flow-arrow" />}
                </div>
              ))}
            </div>
          </FadeIn>

          {/* 7 tools */}
          <div className="mcp-tools-grid">
            {MCP_TOOLS.map(({ icon: Icon, fn, desc }, i) => (
              <FadeIn key={fn} delay={0.05 * i}>
                <div className="mcp-tool-card">
                  <div className="mcp-tool-header">
                    <Icon size={16} className="mcp-tool-icon" />
                    <code className="mcp-tool-fn">{fn}()</code>
                  </div>
                  <p className="mcp-tool-desc">{desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>

          {/* Config snippet */}
          <FadeIn delay={0.2}>
            <div className="mcp-config-wrap">
              <div className="mcp-config-bar">
                <div className="mcp-config-dots">
                  <span /><span /><span />
                </div>
                <span className="mcp-config-filename">claude_desktop_config.json</span>
                <span className="mcp-config-tag">Claude Desktop</span>
              </div>
              <pre className="mcp-config-code">{MCP_CONFIG}</pre>
            </div>
          </FadeIn>

          <FadeIn delay={0.25}>
            <div className="mcp-cta">
              <motion.a
                href="https://github.com/mauricioMedinaHM/apuntes-argentina"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <Github size={18} />
                Ver el servidor MCP
              </motion.a>
              <motion.a
                href="https://github.com/mauricioMedinaHM/apuntes-argentina#contribuir-al-código"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <Terminal size={16} />
                Cómo conectarlo
              </motion.a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── CONTRIBUTE ── */}
      <section className="section section-contribute">
        <div className="container">
          <FadeIn>
            <div className="contribute-icon">
              <Users size={40} strokeWidth={1.5} />
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <h2 className="section-title section-title--light">Contribuí al proyecto</h2>
          </FadeIn>
          <FadeIn delay={0.2}>
            <p className="section-subtitle section-subtitle--light">
              ApuntesArgentina es open source. Cualquier estudiante puede subir sus apuntes,
              mejorar la plataforma, o proponer nuevas funcionalidades. No hace falta saber programar
              para aportar — alcanza con tener buenos apuntes.
            </p>
          </FadeIn>
          <FadeIn delay={0.3}>
            <p className="contribute-cta-line">
              También podés dejar algo para el que viene después.
            </p>
          </FadeIn>
          <FadeIn delay={0.4}>
            <div className="contribute-actions">
              <motion.a
                href="https://github.com/mauricioMedinaHM/apuntes-argentina"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <Github size={20} />
                Ver en GitHub
              </motion.a>
              <motion.a
                href="https://github.com/mauricioMedinaHM/apuntes-argentina/blob/main/CONTRIBUTING.md"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <Upload size={18} />
                Cómo contribuir
              </motion.a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── MOBILE STICKY CTA — solo cuando el hero ya no está visible ── */}
      <AnimatePresence>
        {!heroVisible && (
          <motion.div
            className="mobile-cta-bar"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <button className="btn-primary" onClick={() => setView('apuntes')}>
              Ir a los apuntes <ArrowRight size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FOOTER ── */}
      <footer className="footer">
        <div className="container">
          <div className="footer-top">
            <div className="footer-brand">
              <div className="footer-logo">
                <BookMarked size={22} strokeWidth={2} />
                <span>ApuntesArgentina</span>
              </div>
              <p className="footer-desc">
                Un proyecto abierto, sin fines de lucro, hecho por y para
                estudiantes de universidades públicas argentinas.
              </p>
              <div className="footer-social">
                <a
                  href="https://instagram.com/mauri.h.m"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="social-link"
                >
                  <Instagram size={20} />
                </a>
                <a
                  href="https://x.com/mauriHm_"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="X / Twitter"
                  className="social-link"
                >
                  <Twitter size={20} />
                </a>
                <a
                  href="https://github.com/mauricioMedinaHM/apuntes-argentina"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="GitHub"
                  className="social-link"
                >
                  <Github size={20} />
                </a>
              </div>
            </div>

            <nav className="footer-nav">
              <h4>Proyecto</h4>
              <a href="https://github.com/mauricioMedinaHM/apuntes-argentina" target="_blank" rel="noopener noreferrer">GitHub</a>
              <a href="https://github.com/mauricioMedinaHM/apuntes-argentina/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener noreferrer">Cómo contribuir</a>
              <a href="mailto:hh.mauri2190@gmail.com">Contacto</a>
              <a
                href="https://cafecito.app/apuntesargentina"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-cafecito"
              >
                ☕ Invitame un café
              </a>
            </nav>
          </div>

          <div className="footer-bottom">
            <span className="footer-badge">
              Proyecto sin fines de lucro · Open Source · Hecho por y para estudiantes argentinos
            </span>
          </div>
        </div>
      </footer>
    </div>
    </>
  )
}
