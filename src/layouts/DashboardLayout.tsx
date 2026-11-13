import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBars, faRightFromBracket, faShieldHalved, faTimes, faUser } from '@fortawesome/free-solid-svg-icons'
import { useCallback, useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { NotificationBell } from '../components/NotificationBell'
import { PageTransition } from '../components/PageTransition'
import { ThemeToggle } from '../components/ThemeToggle'
import { Logo } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { getNotificationsFor } from '../services/notificationService'
import type { AppNotification } from '../types'

export type NavItem = {
  to: string
  label: string
  icon: React.ReactNode
  /** When set, these path prefixes keep the item active (e.g. start-application flow). */
  matchPaths?: string[]
  /** Exact match only (useful for list routes that share a prefix with nested pages). */
  end?: boolean
  /** Draw a spaced separator line after this item. */
  dividerAfter?: boolean
  /** Optional section heading shown above this item. */
  section?: string
}

function initialsFor(name?: string) {
  if (!name?.trim()) return 'IH'
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || 'IH'
}

export function DashboardLayout({
  items,
  basePath,
}: {
  items: NavItem[]
  basePath: string
}) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])

  const refreshNotifications = useCallback(async () => {
    if (!user) return
    setNotifications(await getNotificationsFor(user.id))
  }, [user])

  useEffect(() => {
    refreshNotifications()
  }, [refreshNotifications, location.pathname])

  useEffect(() => {
    const onFocus = () => refreshNotifications()
    window.addEventListener('focus', onFocus)
    const timer = window.setInterval(refreshNotifications, 8000)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.clearInterval(timer)
    }
  }, [refreshNotifications])

  const onLogout = () => {
    logout()
    navigate('/login')
  }

  const isItemActive = (item: NavItem) => {
    const path = location.pathname
    if (item.matchPaths?.length) {
      return item.matchPaths.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
    }
    if (item.end || item.to === basePath) {
      return path === item.to
    }
    return path === item.to || path.startsWith(`${item.to}/`)
  }

  const roleLabel = user?.role === 'admin' ? 'Administrator' : 'Client'
  const handle = user?.email || user?.username || 'Signed in'

  const userCard = (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-slate-900/60">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy-900 text-sm font-bold tracking-wide text-white">
          {initialsFor(user?.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-navy-900 dark:text-slate-100">{user?.name}</p>
          <p className="truncate text-[11px] text-slate-500">{handle}</p>
          <span className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-400">
            <FontAwesomeIcon icon={user?.role === 'admin' ? faShieldHalved : faUser} className="text-[10px]" />
            {roleLabel}
          </span>
        </div>
      </div>
    </div>
  )

  const nav = (
    <nav className="space-y-1 px-3">
      {items.map((item) => {
        const active = isItemActive(item)
        return (
          <div key={item.to}>
            {item.section ? (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {item.section}
              </p>
            ) : null}
            <NavLink
              to={item.to}
              end={item.end || item.to === basePath}
              onClick={() => setOpen(false)}
              className={() =>
                `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  active
                    ? 'bg-navy-900 text-white shadow-sm ring-1 ring-white/25 dark:bg-[#1a406e] dark:text-white dark:ring-2 dark:ring-white dark:shadow-[0_0_0_1px_rgba(255,255,255,0.35)]'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-navy-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                }`
              }
            >
              <span className="w-5 text-center text-base">{item.icon}</span>
              <span className="flex-1 leading-snug">{item.label}</span>
            </NavLink>
            {item.dividerAfter ? (
              <div className="mx-2 mb-8 mt-5 border-t border-slate-200 dark:border-slate-700" aria-hidden="true" />
            ) : null}
          </div>
        )
      })}
    </nav>
  )

  const logoutButton = (
    <button
      onClick={onLogout}
      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/70"
    >
      <FontAwesomeIcon icon={faRightFromBracket} /> Logout
    </button>
  )

  return (
    <div className="min-h-screen bg-surface text-navy-900 dark:text-slate-100">
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-72 flex-col border-r border-slate-200 bg-white py-5 dark:border-slate-700 dark:bg-[#0d1522] lg:flex">
        <div className="mb-6 px-5">
          <Logo />
        </div>
        <div className="flex-1 overflow-y-auto">{nav}</div>
        <div className="mt-4 space-y-0 px-4 pt-2">
          {userCard}
          {logoutButton}
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy-950/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col bg-white py-5 shadow-xl dark:bg-[#0d1522]">
            <div className="mb-4 flex items-center justify-between px-5">
              <Logo />
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="rounded-lg p-2 text-navy-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{nav}</div>
            <div className="px-4 pb-2 pt-3">
              {userCard}
              {logoutButton}
            </div>
          </aside>
        </div>
      )}

      <div className="flex min-h-screen min-w-0 flex-col lg:ml-72">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-700 dark:bg-[#0d1522]/90 md:px-6">
          <button
            className="relative rounded-lg p-2 text-navy-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 lg:hidden"
            onClick={() => setOpen(true)}
          >
            <FontAwesomeIcon icon={faBars} />
          </button>
          <div className="hidden text-sm text-slate-500 dark:text-slate-400 lg:block">
            iHOPED Housing Application Management
          </div>
          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <NotificationBell
              notifications={notifications}
              notificationsPath={`${basePath}/notifications`}
              onChanged={refreshNotifications}
            />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-navy-900 dark:text-slate-100">{user?.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{handle}</p>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 p-4 md:p-6 lg:p-8">
          <PageTransition />
        </main>
      </div>
    </div>
  )
}
