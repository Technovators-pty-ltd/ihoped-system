import { useState } from 'react'
import { Alert, Button, Card, Input, PageHeader, TextArea } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { notifyUser } from '../../services/notificationService'

const FAQS = [
  {
    q: 'How do I start a housing application?',
    a: 'Use Start New Housing Application to attach and submit your required documents. Check Required Documents first to see what is needed and whether each file must be certified. After an administrator verifies your uploads, the application form unlocks.',
  },
  {
    q: 'Why can I not fill the application form yet?',
    a: 'The form stays locked until all mandatory documents are verified by an administrator. If any document is rejected, replace it and submit documents for review again.',
  },
  {
    q: 'How long does review take?',
    a: 'Review timelines vary. You will receive in-app notifications when your status changes.',
  },
]

export default function HelpSupport() {
  const { user } = useAuth()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    notifyUser(
      user.id,
      'client',
      'Support request received',
      `We received your message: ${subject}. An administrator will respond shortly (demo acknowledgement).`,
      'info',
    )
    setSent(true)
    setSubject('')
    setMessage('')
  }

  return (
    <div>
      <PageHeader title="Help and Support" subtitle="Find answers or send a message to the iHOPED team." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Frequently asked questions">
          <ul className="space-y-4">
            {FAQS.map((f) => (
              <li key={f.q} className="rounded-xl bg-slate-50 px-4 py-3">
                <p className="font-semibold text-navy-900">{f.q}</p>
                <p className="mt-1 text-sm text-slate-600">{f.a}</p>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Contact support">
          {sent && (
            <div className="mb-4">
              <Alert tone="success">Your message was recorded. Check Notifications for confirmation.</Alert>
            </div>
          )}
          <form onSubmit={submit} className="space-y-4">
            <Input label="Subject" required value={subject} onChange={(e) => setSubject(e.target.value)} />
            <TextArea label="Message" required rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
            <Button type="submit">Send message</Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
