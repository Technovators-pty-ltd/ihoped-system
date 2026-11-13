import { useEffect, useState } from 'react'
import { Alert, Button, Card, Input, PageHeader, Select, TextArea } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { getAllClients } from '../../services/clientService'
import { addAuditLog } from '../../services/auditService'
import { sendAdminNotification } from '../../services/notificationService'
import type { ClientProfile } from '../../types'

export default function AdminNotifications() {
  const { user } = useAuth()
  const [clients, setClients] = useState<ClientProfile[]>([])
  const [target, setTarget] = useState<'all' | 'single'>('all')
  const [clientId, setClientId] = useState('')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    getAllClients().then((list) => {
      setClients(list)
      if (list[0]) setClientId(list[0].id)
    })
  }, [])

  const send = (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    sendAdminNotification({
      target,
      clientId,
      title,
      message,
      adminId: user.id,
      adminName: user.name,
    })
    addAuditLog(user.id, user.name, 'admin', 'NOTIFICATION_SEND', `${target} notification: ${title}`)
    setFeedback('Notification sent.')
    setTitle('')
    setMessage('')
  }

  return (
    <div>
      <PageHeader title="Notifications" subtitle="Send individual or bulk notifications to clients." />
      <Card>
        {feedback && (
          <div className="mb-4">
            <Alert tone="success">{feedback}</Alert>
          </div>
        )}
        <form onSubmit={send} className="max-w-xl space-y-4">
          <Select label="Audience" value={target} onChange={(e) => setTarget(e.target.value as 'all' | 'single')}>
            <option value="all">All active clients</option>
            <option value="single">Single client</option>
          </Select>
          {target === 'single' && (
            <Select label="Client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.surname} ({c.email})
                </option>
              ))}
            </Select>
          )}
          <Input label="Title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          <TextArea label="Message" required rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
          <Button type="submit">Send notification</Button>
        </form>
      </Card>
    </div>
  )
}
