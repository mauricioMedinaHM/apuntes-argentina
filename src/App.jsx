import { motion, useInView, AnimatePresence } from 'motion/react'
import { useRef, useState } from 'react'
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
} from 'lucide-react'
import VaultAnimation from './VaultAnimation'
import MockApuntes from './MockApuntes'
import SplashScreen, { shouldShowSplash } from './SplashScreen'
import './App.css'

const UNIVERSITIES = [
  { id: 'uba',    name: 'UBA',   full: 'Universidad de Buenos Aires',        color: '#23355C', logo: '/logos/uba.svg'    },
  { id: 'unc',    name: 'UNC',   full: 'Universidad Nacional de Córdoba',     color: '#2D5FA3', logo: '/logos/unc.png'    },
  { id: 'unlp',   name: 'UNLP',  full: 'Universidad Nacional de La Plata',    color: '#003087', logo: '/logos/unlp.svg'   },
  { id: 'utn',    name: 'UTN',   full: 'Universidad Tecnológica Nacional',    color: '#C8102E', logo: '/logos/utn.png'    },
  { id: 'unr',    name: 'UNR',   full: 'Universidad Nacional de Rosario',     color: '#005B5E', logo: '/logos/unr.png'    },
  { id: 'uncuyo', name: 'UNCu',  full: 'Universidad Nacional de Cuyo',        color: '#6B2D8B', logo: null               },
  { id: 'unne',   name: 'UNNE',  full: 'Univ. Nacional del Nordeste',         color: '#1B6CA8', logo: '/logos/unne.jpg'  },
  { id: 'unsa',   name: 'UNSA',  full: 'Univ. Nacional de Salta',             color: '#8B0000', logo: '/logos/unsa.png'  },
  { id: 'unt',    name: 'UNT',   full: 'Univ. Nacional de Tucumán',           color: '#1A5C38', logo: null               },
  { id: 'unmdp',  name: 'UNMdP', full: 'Univ. Nacional de Mar del Plata',     color: '#004B87', logo: '/logos/unmdp.jpg' },
  { id: 'unsj',   name: 'UNSJ',  full: 'Univ. Nacional de San Juan',          color: '#5C3317', logo: null               },
  { id: 'unlam',  name: 'UNLaM', full: 'Univ. Nacional de La Matanza',        color: '#2C6B2F', logo: '/logos/unlam.png' },
]

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
  const inView = useInView(ref, { once: true, margin: '-80px' })

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

function UniversityCard({ uni, delay }) {
  return (
    <FadeIn delay={delay}>
      <motion.div
        className="uni-card"
        whileHover={{ y: -4, boxShadow: '0 8px 24px rgba(35,53,92,0.15)' }}
        transition={{ duration: 0.2 }}
      >
        {uni.logo ? (
          <div className="uni-logo-wrap">
            <img
              src={uni.logo}
              alt={`Logo ${uni.name}`}
              className="uni-logo-img"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="uni-initial" style={{ background: uni.color }}>
            {uni.name}
          </div>
        )}
        <span className="uni-full">{uni.full}</span>
      </motion.div>
    </FadeIn>
  )
}

export default function App() {
  const [showSplash, setShowSplash] = useState(shouldShowSplash)

  return (
    <>
      {/* Splash — only on first visit per session, exits by sliding up */}
      <AnimatePresence>
        {showSplash && (
          <SplashScreen key="splash" onDone={() => setShowSplash(false)} />
        )}
      </AnimatePresence>

    <div className="app">
      {/* ── HERO ── */}
      <header className="hero">
        <nav className="nav">
          <div className="nav-logo">
            <BookMarked size={24} strokeWidth={2} />
            <span>ApuntesArgentina</span>
          </div>
          <a
            href="https://github.com/mauricioMedinaHM/apuntes-argentina"
            target="_blank"
            rel="noopener noreferrer"
            className="nav-github"
          >
            <Github size={18} />
            GitHub
          </a>
        </nav>

        <div className="hero-content">
          <motion.div
            className="hero-badge"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Heart size={14} fill="currentColor" /> Proyecto sin fines de lucro · Open Source
          </motion.div>

          <motion.h1
            className="hero-title"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            Apuntes<span className="hero-title-accent">Argentina</span>
          </motion.h1>

          <motion.p
            className="hero-tagline"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
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
            <div className="coming-soon-wrapper">
              <button className="btn-primary" disabled>
                Ir a los apuntes <ArrowRight size={18} />
              </button>
              <span className="coming-soon-label">
                Próximamente — estamos buscando financiamiento para el vault
              </span>
            </div>
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
              Arrancamos con las universidades públicas más grandes del país.
              Si la tuya no está, podés agregarla.
            </p>
          </FadeIn>

          <div className="unis-grid">
            {UNIVERSITIES.map((uni, i) => (
              <UniversityCard key={uni.id} uni={uni} delay={i * 0.05} />
            ))}
          </div>
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

      {/* ── MOBILE STICKY CTA (skill: bottom navigation clarity + safe areas) ── */}
      <div className="mobile-cta-bar">
        <button className="btn-primary" disabled>
          Ir a los apuntes <ArrowRight size={18} />
        </button>
      </div>

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
