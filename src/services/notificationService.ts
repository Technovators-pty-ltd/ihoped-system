import type { AppNotification } from '../types'
import { api } from './api'

export async function getNotificationsFor(_userId: string): Promise<AppNotification[]> {
  const data = await api<{ notifications: AppNotification[] }>('/notifications')
  return data.notifications
}

export async function markNotificationRead(id: string) {
  await api(`/notifications/${id}/read`, { method: 'POST' })
}

export async function markAllRead(_userId: string) {
  await api('/notifications/read-all', { method: 'POST' })
}

export async function sendAdminNotification(input: {
  target: 'all' | 'single'
  clientId?: string
  title: string
  message: string
  adminId: string
  adminName: string
}) {
  await api('/notifications/send', {
    method: 'POST',
    json: {
      target: input.target,
      clientId: input.clientId,
      title: input.title,
      message: input.message,
    },
  })
}

/** Server creates notifications; kept for compatibility. */
export function notifyUser(
  _userId: string,
  _userRole: string,
  _title: string,
  _message: string,
  _type?: string,
) {
  // no-op on client — notifications are created by the API
}
