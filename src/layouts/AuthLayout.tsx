import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageTransition } from '../components/PageTransition'
import { ThemeToggle } from '../components/ThemeToggle'
import { Logo } from '../components/ui'

const LOCAL_VIDEO = '/videos/ihoped-login.mp4'
const REMOTE_VIDEO = 'https://www.ihoped.co.za/Videos/canva/224b51e3ef43cfaa260faa855d2f763e.mp4'
const VIDEO_POSTER = '/videos/ihoped-project-poster.jpg'

export function AuthLayout() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const blobUrlRef = useRef<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let cancelled = false

    const playSafe = async () => {
      if (!video || cancelled) return
      video.muted = true
      video.defaultMuted = true
      video.playsInline = true
      try {
        await video.play()
      } catch {
        // Keep poster visible if autoplay is blocked.
      }
    }

    const attachSrc = async (url: string) => {
      if (cancelled || !video) return false
      try {
        const res = await fetch(url)
        if (!res.ok) return false
        const buf = await res.arrayBuffer()
        if (cancelled) return false
        const blobUrl = URL.createObjectURL(new Blob([buf], { type: 'video/mp4' }))
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = blobUrl
        video.src = blobUrl
        video.load()
        await new Promise<void>((resolve, reject) => {
          const onReady = () => {
            cleanup()
            resolve()
          }
          const onError = () => {
            cleanup()
            reject(new Error('video load failed'))
          }
          const cleanup = () => {
            video.removeEventListener('loadeddata', onReady)
            video.removeEventListener('error', onError)
          }
          video.addEventListener('loadeddata', onReady, { once: true })
          video.addEventListener('error', onError, { once: true })
        })
        if (!cancelled) {
          setReady(true)
          await playSafe()
        }
        return true
      } catch {
        return false
      }
    }

    ;(async () => {
      const ok = (await attachSrc(LOCAL_VIDEO)) || (await attachSrc(REMOTE_VIDEO))
      if (!ok && !cancelled) {
        // Last resort: direct remote URL
        video.src = REMOTE_VIDEO
        video.load()
        setReady(true)
        await playSafe()
      }
    })()

    return () => {
      cancelled = true
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [])

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* Left: full-cover iHOPED video */}
      <aside className="relative hidden min-h-screen overflow-hidden bg-navy-950 lg:block">
        <img
          src={VIDEO_POSTER}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${ready ? 'opacity-0' : 'opacity-100'}`}
          aria-hidden="true"
        />
        <video
          ref={videoRef}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${ready ? 'opacity-100' : 'opacity-0'}`}
          poster={VIDEO_POSTER}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          controls={false}
          disablePictureInPicture
          aria-hidden="true"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 z-10 p-10">
          <div className="max-w-xl rounded-2xl bg-black/55 px-5 py-5 backdrop-blur-sm ring-1 ring-white/15">
            <p
              className="text-sm font-bold uppercase tracking-[0.2em]"
              style={{ color: '#ffd27a', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
            >
              Housing Assistance
            </p>
            <h1
              className="mt-3 text-4xl font-bold leading-tight"
              style={{ color: '#ffffff', textShadow: '0 2px 8px rgba(0,0,0,0.85)' }}
            >
              Apply for housing support with confidence and clarity.
            </h1>
            <p
              className="mt-4 text-base leading-relaxed"
              style={{ color: '#f1f5f9', textShadow: '0 1px 3px rgba(0,0,0,0.75)' }}
            >
              Track applications, upload documents, and stay updated — all in one secure professional platform.
            </p>
          </div>
        </div>
      </aside>

      {/* Right: auth form — blue + gold like iHOPED highlight */}
      <aside
        className="relative flex min-h-screen flex-col justify-center overflow-hidden px-4 py-10 md:px-10"
        style={{
          backgroundImage:
            'linear-gradient(135deg, rgba(33, 126, 180, 0.28) 0%, rgba(33, 126, 180, 0.12) 45%, rgba(244, 162, 31, 0.16) 100%), linear-gradient(160deg, #0c2240 0%, #12345f 55%, #0a2540 100%)',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 18% 22%, rgba(33, 126, 180, 0.45) 0%, transparent 42%), radial-gradient(circle at 78% 82%, rgba(244, 162, 31, 0.22) 0%, transparent 40%), radial-gradient(circle at 70% 78%, rgba(33, 126, 180, 0.25) 0%, transparent 40%)',
          }}
        />
        <div className="relative mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center justify-between gap-3">
            <Link to="/">
              <Logo light />
            </Link>
            <div className="flex items-center gap-3">
              <ThemeToggle className="border-white/20 bg-white/10 text-white hover:bg-white/20 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20" />
              <Link to="/login" className="text-sm font-medium text-slate-300 hover:text-white">
                Sign in
              </Link>
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white p-6 shadow-2xl md:p-8">
            <PageTransition />
          </div>
        </div>
      </aside>
    </div>
  )
}
