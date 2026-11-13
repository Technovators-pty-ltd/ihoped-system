import { useEffect, useState } from 'react'
import { Alert, Button, Card, Input, PageHeader, PasswordInput } from '../../components/ui'
import { api } from '../../services/api'
import type { AdminProfile } from '../../types'
import { formatDate } from '../../utils/format'

type AdminRow = Omit<AdminProfile, 'passwordHash'>

export default function Administrators() {
  const [admins, setAdmins] = useState<AdminRow[]>([])
  const [form, setForm] = useState({ username: '', fullName: '', email: '', password: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const reload = async () => {
    const data = await api<{ admins: AdminRow[] }>('/admin/admins')
    setAdmins(data.admins)
  }

  useEffect(() => {
    reload().catch(() => setError('Could not load administrators.'))
  }, [])

  const createAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await api('/admin/admins', { method: 'POST', json: form })
      setForm({ username: '', fullName: '', email: '', password: '' })
      setMessage('Administrator account created.')
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create administrator.')
    }
  }

  return (
    <div>
      <PageHeader title="Administrator Accounts" subtitle="Manage administrator access to the control panel." />
      {message && (
        <div className="mb-4">
          <Alert tone="success">{message}</Alert>
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Existing administrators">
          <ul className="space-y-3">
            {admins.map((a) => (
              <li key={a.id} className="rounded-xl border border-slate-100 px-4 py-3 text-sm">
                <p className="font-semibold text-navy-900">
                  {a.fullName} <span className="text-slate-400">(@{a.username})</span>
                </p>
                <p className="text-slate-500">{a.email}</p>
                <p className="text-xs text-slate-400">
                  Created {formatDate(a.createdAt)} · {a.active ? 'Active' : 'Inactive'}
                </p>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Add administrator">
          <form onSubmit={createAdmin} className="space-y-4">
            <Input label="Username" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            <Input label="Full name" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            <Input label="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <PasswordInput
              label="Temporary password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <Button type="submit">Create administrator</Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
