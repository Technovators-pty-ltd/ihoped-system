import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight, faBell } from '@fortawesome/free-solid-svg-icons'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { AppNotification } from '../types'
import { formatRelativeTime } from '../utils/format'
import { markNotificationRead } from '../services/notificationService'

export function NotificationBell({
  notifications,
  notificationsPath,
  onChanged,
}: {
  notifications: AppNotification[]
  notificationsPath: string
  onChanged?: () => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const unread = notifications.filter((n) => !n.read).length
  const recent = notifications.slice(0, 6)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const openItem = async (n: AppNotification) => {
    if (!n.read) {
      await markNotificationRead(n.id)
      onChanged?.()
    }
    setOpen(false)
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className={`relative rounded-xl p-2 text-navy-800 transition hover:bg-slate-100 ${
          open ? 'bg-slate-100 ring-2 ring-accent/30' : ''
        }`}
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <FontAwesomeIcon
          icon={faBell}
          className={`text-lg ${unread > 0 && !open ? 'bell-ring origin-top' : ''}`}
        />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white shadow-sm">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,24rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <p className="font-semibold text-navy-900">Recent updates</p>
              <p className="text-xs text-slate-500">
                {unread > 0 ? `${unread} unread` : 'You are up to date'}
              </p>
            </div>
            <Link
              to={notificationsPath}
              onClick={() => setOpen(false)}
              className="text-sm font-semibold text-accent hover:text-accent-light"
            >
              View all
            </Link>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {recent.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">No notifications yet.</p>
            ) : (
              <ul>
                {recent.map((n) => (
                  <li key={n.id} className="border-b border-slate-50 last:border-0">
                    <Link
                      to={notificationsPath}
                      onClick={() => openItem(n)}
                      className={`flex gap-3 px-4 py-3 transition hover:bg-slate-50 ${
                        n.read ? 'bg-white' : 'bg-teal-50/40'
                      }`}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white">
                        iH
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-navy-900">{n.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{n.message}</p>
                        <p className="mt-1 text-[11px] text-slate-400">{formatRelativeTime(n.createdAt)}</p>
                      </div>
                      {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" />}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-slate-100 p-2">
            <Link
              to={notificationsPath}
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-navy-900 hover:bg-slate-50"
            >
              View all notifications
              <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
