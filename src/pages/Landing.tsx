import { Link } from 'react-router-dom'
import { ThemeToggle } from '../components/ThemeToggle'
import { Logo } from '../components/ui'

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-navy-950 via-navy-900 to-navy-700 text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle at 15% 20%, rgba(33, 126, 180, 0.35) 0%, transparent 38%), radial-gradient(circle at 85% 10%, rgba(244, 162, 31, 0.28) 0%, transparent 42%)',
        }}
      />
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <header className="flex items-center justify-between gap-3">
          <Logo light />
          <div className="flex flex-wrap items-center justify-end gap-3">
            <ThemeToggle className="border-white/20 bg-white/10 text-white hover:bg-white/20 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20" />
            <Link to="/login" className="rounded-xl px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
              Sign in
            </Link>
            <Link to="/register" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-slate-100">
              Register
            </Link>
          </div>
        </header>
        <main className="flex flex-1 flex-col justify-center py-16">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-accent">IHOPED</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
            Housing Application Management
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-300">
            A professional platform for clients to apply for housing assistance and for administrators to review,
            verify and track applications end to end.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/register" className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white hover:bg-accent-light">
              Apply as a client
            </Link>
            <Link to="/login" className="rounded-xl border border-white/30 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10">
              Sign in
            </Link>
          </div>
        </main>
      </div>
    </div>
  )
}
