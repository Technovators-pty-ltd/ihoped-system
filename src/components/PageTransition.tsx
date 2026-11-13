import { useEffect, useRef, useState } from 'react'
import { useLocation, useOutlet } from 'react-router-dom'

/** Full loader duration between pages. */
const LOAD_MS = 400
const HIDE_MS = 100

/**
 * Technovators-style page loader: full-screen overlay with spinner,
 * percentage counter, progress bar, then reveal the next page.
 */
export function PageTransition() {
  const location = useLocation()
  const outlet = useOutlet()
  const outletRef = useRef(outlet)
  outletRef.current = outlet

  const [current, setCurrent] = useState({ key: location.key, node: outlet })
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(0)
  const rafRef = useRef(0)
  const timers = useRef<number[]>([])

  useEffect(() => {
    return () => {
      window.cancelAnimationFrame(rafRef.current)
      timers.current.forEach((t) => window.clearTimeout(t))
    }
  }, [])

  useEffect(() => {
    if (location.key === current.key) {
      setCurrent((prev) => ({ ...prev, node: outletRef.current }))
      return
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.cancelAnimationFrame(rafRef.current)
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []

    if (reduceMotion) {
      setCurrent({ key: location.key, node: outletRef.current })
      return
    }

    const targetKey = location.key
    setVisible(true)
    setProgress(0)

    const start = performance.now()
    const tick = (now: number) => {
      const raw = Math.min(1, (now - start) / LOAD_MS)
      // Linear count — feels fast and even for the full 4 seconds
      setProgress(Math.round(raw * 100))
      if (raw < 1) {
        rafRef.current = window.requestAnimationFrame(tick)
      }
    }
    rafRef.current = window.requestAnimationFrame(tick)

    const swapTimer = window.setTimeout(() => {
      setProgress(100)
      setCurrent({ key: targetKey, node: outletRef.current })
      const hideTimer = window.setTimeout(() => {
        setVisible(false)
        setProgress(0)
      }, HIDE_MS)
      timers.current.push(hideTimer)
    }, LOAD_MS)

    timers.current.push(swapTimer)
    // Only depend on route key — not outlet — so progress updates don't restart the timer
  }, [location.key, current.key])

  const display = progress < 100 ? String(progress).padStart(2, '0') : '100'

  return (
    <>
      <div className={visible ? 'page-loader' : 'page-loader page-loader--hidden'} aria-hidden={!visible}>
        <div className="loader-content">
          <div className="loader-spinner" />
          <div className="loader-mark">IH</div>
        </div>
        <div className="loader-counter">
          <span>{display}</span>
          <span className="loader-counter-suffix">%</span>
        </div>
        <div className="loader-progress">
          <span className="loader-progress-bar" style={{ width: `${progress}%` }} />
        </div>
        <div className="loader-status">Loading Experience</div>
      </div>

      <div className={visible ? 'page-transition page-transition--hold' : 'page-transition page-transition--in'}>
        {current.node}
      </div>
    </>
  )
}
