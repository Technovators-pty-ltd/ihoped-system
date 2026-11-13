import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Card, PasswordInput } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { changeAdminPassword } from '../../services/authService'

export default function AdminChangePassword() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (newPassword !== confirm) {
      setError('New passwords do not match.')
      return
    }
    setLoading(true)
    const result = await changeAdminPassword(user.id, currentPassword, newPassword)
    setLoading(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setUser(result.user)
    navigate('/admin')
  }

  return (
    <div className="mx-auto max-w-lg">
      <Card title="Change initial password">
        <p className="mb-4 text-sm text-slate-500">
          For security, you must set a new password before accessing the administrator dashboard.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <PasswordInput label="Current Password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          <PasswordInput label="New Password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <PasswordInput label="Confirm New Password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving…' : 'Update password'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
