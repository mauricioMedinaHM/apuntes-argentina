import { motion } from 'motion/react'
import { useEffect } from 'react'

const SESSION_KEY = 'aa-splash-seen'

export function shouldShowSplash() {
  try { return !sessionStorage.getItem(SESSION_KEY) } catch { return false }
}

export default function SplashScreen({ onDone }) {
  useEffect(() => {
    const MIN_MS = 400   // never flash shorter than this
    const start  = Date.now()

    const dismiss = () => {
      const wait = Math.max(0, MIN_MS - (Date.now() - start))
      setTimeout(() => {
        try { sessionStorage.setItem(SESSION_KEY, '1') } catch {}
        onDone()
      }, wait)
    }

    // If everything is already loaded (cached visit), dismiss after MIN_MS
    if (document.readyState === 'complete') {
      dismiss()
      return
    }

    // Otherwise wait for the real load event — splash covers the load time
    window.addEventListener('load', dismiss, { once: true })
    return () => window.removeEventListener('load', dismiss)
  }, [onDone])

  return (
    <motion.div
      className="splash"
      initial={{ y: 0 }}
      exit={{ y: '-100%', transition: { duration: 0.65, ease: [0.76, 0, 0.24, 1] } }}
    >
      <motion.img
        src="/sol-de-mayo.svg"
        alt="Sol de Mayo"
        className="splash-sun"
        initial={{ opacity: 0, scale: 0.88 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        draggable={false}
      />
    </motion.div>
  )
}
