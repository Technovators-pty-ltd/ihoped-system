import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Button, PasswordInput } from '../../components/ui'
import { resetPassword } from '../../services/authService'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await resetPassword(token, password, confirmPassword)
    setLoading(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setSuccess('Password updated. Redirecting to login…')
    setTimeout(() => navigate('/login'), 1000)
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-navy-900">Reset password</h2>
      <p className="mt-1 text-sm text-slate-500">Choose a new secure password for your account.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        {success && <Alert tone="success">{success}</Alert>}
        <PasswordInput label="New Password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <PasswordInput
          label="Confirm Password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <Button type="submit" className="w-full" disabled={loading || !token}>
          {loading ? 'Updating…' : 'Update password'}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm">
        <Link to="/login" className="font-semibold text-navy-800 hover:text-accent">
          Back to login
        </Link>
      </p>
    </div>
  )
}
