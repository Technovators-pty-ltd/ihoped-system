import { useEffect, useState } from 'react'
import { Button, Card, EmptyState, PageHeader } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { getNotificationsFor, markAllRead, markNotificationRead } from '../../services/notificationService'
import type { AppNotification } from '../../types'
import { formatDateTime } from '../../utils/format'

export default function ClientNotifications() {
  const { user } = useAuth()
  const [items, setItems] = useState<AppNotification[]>([])

  const reload = async () => {
    if (!user) return
    setItems(await getNotificationsFor(user.id))
  }

  useEffect(() => {
    reload()
  }, [user])

  const unread = items.filter((n) => !n.read).length

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Updates about your applications and documents."
        actions={
          <Button
            variant="secondary"
            disabled={unread === 0}
            onClick={async () => {
              if (!user) return
              await markAllRead(user.id)
              reload()
            }}
          >
            Mark all as read
          </Button>
        }
      />

      <Card title="Recent notifications">
        {items.length === 0 ? (
          <EmptyState
            title="No notifications"
            description="You will see updates here as your application progresses."
          />
        ) : (
          <ul className="space-y-3">
            {items.map((n) => (
              <li
                key={n.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-100 px-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-navy-900">{n.title}</p>
                    {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{n.message}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDateTime(n.createdAt)}</p>
                </div>
                {!n.read && (
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      await markNotificationRead(n.id)
                      reload()
                    }}
                  >
                    Mark read
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
