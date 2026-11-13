import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, Input } from '../../components/ui'
import { requestPasswordReset } from '../../services/authService'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const result = await requestPasswordReset(email)
    setLoading(false)
    if (!result.ok) {
      setMessage(result.error)
      return
    }
    setMessage('If an account exists for that email, a reset link has been generated.')
    if (result.demoToken) setToken(result.demoToken)
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-navy-900">Forgot password</h2>
      <p className="mt-1 text-sm text-slate-500">
        We will generate a time-limited reset token (email simulated in this demo).
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {message && <Alert tone="info">{message}</Alert>}
        <Input label="Email Address" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
      {token && (
        <Alert tone="success">
          Demo reset link:{' '}
          <Link className="font-semibold underline" to={`/reset-password?token=${token}`}>
            Reset password
          </Link>
        </Alert>
      )}
      <p className="mt-5 text-center text-sm">
        <Link to="/login" className="font-semibold text-navy-800 hover:text-accent">
          Back to login
        </Link>
      </p>
    </div>
  )
}
