import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHouse } from '@fortawesome/free-solid-svg-icons'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, Button, Input, PasswordInput } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { clearLoginLocks, login } from '../../services/authService'

function useLiveClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const tick = () => setNow(new Date())
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])

  return {
    time: now.toLocaleTimeString('en-ZA', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }),
    date: now.toLocaleDateString('en-ZA', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
    weekday: now.toLocaleDateString('en-ZA', { weekday: 'long' }),
  }
}

export default function Login() {
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const clock = useLiveClock()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    clearLoginLocks()
  }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await login(identifier, password, remember)
    setLoading(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setUser(result.user)
    navigate(result.user.role === 'admin' ? '/admin' : '/client')
  }

  return (
    <div className="relative">
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <p className="font-bold tabular-nums text-navy-900">{clock.time}</p>
        <span className="text-slate-300" aria-hidden="true">
          |
        </span>
        <p className="font-semibold text-accent">{clock.weekday}</p>
        <span className="text-slate-300" aria-hidden="true">
          |
        </span>
        <p className="text-slate-500">{clock.date}</p>
      </div>

      <h2 className="welcome-title flex items-center gap-2.5 text-2xl font-bold text-navy-900">
        <FontAwesomeIcon icon={faHouse} className="text-[#217eb4]" aria-hidden="true" />
        <span>
          Welcome to{' '}
          <span className="welcome-brand italic text-[#217eb4]">iHOPED</span>
        </span>
      </h2>
      <p className="mt-1 text-sm text-slate-500">Sign in to continue.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Input
          label="Email or Username"
          type="text"
          autoComplete="username"
          required
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />
        <PasswordInput label="Password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-slate-600">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Remember Me
          </label>
          <Link to="/forgot-password" className="font-medium text-navy-700 hover:text-accent">
            Forgot Password?
          </Link>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-500">
        New client?{' '}
        <Link to="/register" className="font-semibold text-navy-800 hover:text-accent">
          Create an account
        </Link>
      </p>
    </div>
  )
}
