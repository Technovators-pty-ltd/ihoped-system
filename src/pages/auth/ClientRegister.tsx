import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, Button, Input, PasswordInput } from '../../components/ui'
import { getPrivacyNotice, registerClient } from '../../services/authService'

type FieldKey =
  | 'firstName'
  | 'surname'
  | 'username'
  | 'email'
  | 'idNumber'
  | 'password'
  | 'confirmPassword'
  | 'consent'
  | 'form'

type FieldErrors = Partial<Record<FieldKey, string>>

const FIELD_LABELS: Record<Exclude<FieldKey, 'form'>, string> = {
  firstName: 'Full Name',
  surname: 'Surname',
  username: 'Username',
  email: 'Email Address',
  idNumber: 'South African ID Number',
  password: 'Password',
  confirmPassword: 'Confirm Password',
  consent: 'POPIA consent',
}

function validateLocal(form: {
  firstName: string
  surname: string
  username: string
  email: string
  idNumber: string
  password: string
  confirmPassword: string
  consent: boolean
}): FieldErrors {
  const errors: FieldErrors = {}

  if (!form.firstName.trim()) errors.firstName = 'Please enter your first name.'
  if (!form.surname.trim()) errors.surname = 'Please enter your surname.'

  if (!form.username.trim()) {
    errors.username = 'Please choose a username.'
  } else if (!/^[a-z0-9_]{3,30}$/.test(form.username)) {
    errors.username = 'Must be 3–30 characters using only letters, numbers, or underscores.'
  }

  if (!form.email.trim()) {
    errors.email = 'Please enter your email address.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Enter a valid email address (example: name@email.com).'
  }

  if (!form.idNumber.trim()) {
    errors.idNumber = 'Please enter your South African ID number.'
  } else if (!/^\d{13}$/.test(form.idNumber)) {
    errors.idNumber = 'ID number must be exactly 13 digits.'
  }

  if (!form.password) {
    errors.password = 'Please enter a password.'
  } else if (form.password.length < 8) {
    errors.password = 'Password must be at least 8 characters long.'
  }

  if (!form.confirmPassword) {
    errors.confirmPassword = 'Please re-enter your password.'
  } else if (form.password !== form.confirmPassword) {
    errors.confirmPassword = 'The passwords do not match.'
  }

  if (!form.consent) {
    errors.consent = 'You must accept the POPIA privacy notice to register.'
  }

  return errors
}

export default function ClientRegister() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    firstName: '',
    surname: '',
    username: '',
    email: '',
    idNumber: '',
    password: '',
    confirmPassword: '',
    consent: false,
  })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [privacy, setPrivacy] = useState('')
  const [loading, setLoading] = useState(false)
  const fieldRefs = useRef<Partial<Record<FieldKey, HTMLElement | null>>>({})

  useEffect(() => {
    getPrivacyNotice().then(setPrivacy)
  }, [])

  const set = (key: keyof typeof form, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => {
      if (!prev[key as FieldKey]) return prev
      const next = { ...prev }
      delete next[key as FieldKey]
      return next
    })
    setError('')
  }

  const focusFirstError = (errors: FieldErrors) => {
    const order: FieldKey[] = [
      'firstName',
      'surname',
      'username',
      'email',
      'idNumber',
      'password',
      'confirmPassword',
      'consent',
    ]
    const first = order.find((key) => errors[key])
    if (!first) return
    const el = fieldRefs.current[first]
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (el instanceof HTMLInputElement) el.focus()
    else el?.querySelector('input')?.focus()
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const localErrors = validateLocal(form)
    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors)
      const count = Object.keys(localErrors).length
      setError(
        count === 1
          ? `Please fix the highlighted field before registering.`
          : `Please fix the ${count} highlighted fields before registering.`,
      )
      focusFirstError(localErrors)
      return
    }

    setFieldErrors({})
    setLoading(true)
    const result = await registerClient(form)
    setLoading(false)
    if (!result.ok) {
      const field = (result.field as FieldKey | undefined) || 'form'
      if (field !== 'form') {
        setFieldErrors({ [field]: result.error.replace(/^[^:]+:\s*/, '') })
      }
      setError(result.error)
      focusFirstError(field !== 'form' ? { [field]: result.error } : {})
      return
    }
    setSuccess('Registration successful. You can now sign in with your email or username.')
    setTimeout(() => navigate('/login'), 1200)
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-navy-900">Create client account</h2>
      <p className="mt-1 text-sm text-slate-500">Register to apply for housing assistance.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        {error && (
          <Alert tone="error">
            <p className="font-semibold">Registration could not be completed</p>
            <p className="mt-1">{error}</p>
            {Object.keys(fieldErrors).length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {(Object.keys(fieldErrors) as FieldKey[])
                  .filter((key) => key !== 'form' && fieldErrors[key])
                  .map((key) => (
                    <li key={key}>
                      <strong>{FIELD_LABELS[key as Exclude<FieldKey, 'form'>]}:</strong>{' '}
                      {fieldErrors[key]}
                    </li>
                  ))}
              </ul>
            )}
          </Alert>
        )}
        {success && <Alert tone="success">{success}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div ref={(el) => { fieldRefs.current.firstName = el }}>
            <Input
              label="Full Name"
              required
              value={form.firstName}
              error={fieldErrors.firstName}
              onChange={(e) => set('firstName', e.target.value)}
            />
          </div>
          <div ref={(el) => { fieldRefs.current.surname = el }}>
            <Input
              label="Surname"
              required
              value={form.surname}
              error={fieldErrors.surname}
              onChange={(e) => set('surname', e.target.value)}
            />
          </div>
        </div>
        <div ref={(el) => { fieldRefs.current.username = el }}>
          <Input
            label="Username"
            required
            autoComplete="username"
            minLength={3}
            maxLength={30}
            value={form.username}
            error={fieldErrors.username}
            onChange={(e) => set('username', e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
            placeholder="e.g. thandi_n"
          />
          <p className="mt-1.5 text-xs text-slate-500">
            3–30 characters. Letters, numbers, and underscores only. You can sign in with this username or your email.
          </p>
        </div>
        <div ref={(el) => { fieldRefs.current.email = el }}>
          <Input
            label="Email Address"
            type="email"
            required
            value={form.email}
            error={fieldErrors.email}
            onChange={(e) => set('email', e.target.value)}
          />
        </div>
        <div ref={(el) => { fieldRefs.current.idNumber = el }}>
          <Input
            label="South African ID Number"
            required
            maxLength={13}
            value={form.idNumber}
            error={fieldErrors.idNumber}
            onChange={(e) => set('idNumber', e.target.value.replace(/\D/g, ''))}
          />
        </div>
        <div ref={(el) => { fieldRefs.current.password = el }}>
          <PasswordInput
            label="Password"
            required
            value={form.password}
            error={fieldErrors.password}
            onChange={(e) => set('password', e.target.value)}
          />
        </div>
        <div ref={(el) => { fieldRefs.current.confirmPassword = el }}>
          <PasswordInput
            label="Confirm Password"
            required
            value={form.confirmPassword}
            error={fieldErrors.confirmPassword}
            onChange={(e) => set('confirmPassword', e.target.value)}
          />
        </div>
        <div ref={(el) => { fieldRefs.current.consent = el }}>
          <label
            className={`flex items-start gap-2 rounded-xl border px-3 py-3 text-sm ${
              fieldErrors.consent ? 'border-red-400 bg-red-50 text-red-800' : 'border-transparent text-slate-600'
            }`}
          >
            <input
              type="checkbox"
              className="mt-1"
              checked={form.consent}
              onChange={(e) => set('consent', e.target.checked)}
            />
            <span>
              I consent to the processing of my personal information in accordance with POPIA.
              {privacy && <span className="mt-1 block text-xs text-slate-400">{privacy}</span>}
              {fieldErrors.consent && <span className="mt-1 block text-xs font-medium text-red-600">{fieldErrors.consent}</span>}
            </span>
          </label>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Registering…' : 'Register'}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-500">
        Already registered?{' '}
        <Link to="/login" className="font-semibold text-navy-800 hover:text-accent">
          Sign in
        </Link>
      </p>
    </div>
  )
}
