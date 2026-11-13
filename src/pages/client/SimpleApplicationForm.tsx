import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Button, Card, Input, PageHeader, Select, TextArea } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import {
  canFillApplicationForm,
  getApplication,
  saveApplicationProgress,
  submitApplication,
} from '../../services/applicationService'
import { getPrivacyNotice } from '../../services/authService'
import {
  areAllMandatoryDocumentsVerified,
  areAllUploadedDocumentsVerified,
  refreshDocumentData,
} from '../../services/documentService'
import type { HousingApplication } from '../../types'

const PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'Northern Cape',
  'North West',
  'Western Cape',
]

const HOUSING = ['Informal settlement', 'Renting', 'Living with family', 'Homeless', 'Backyard dwelling', 'Other']

type FormState = {
  preferredProvince: string
  preferredMunicipality: string
  currentHousingSituation: string
  reason: string
  consentAccepted: boolean
}

export default function SimpleApplicationForm() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const editId = params.get('id') || undefined
  const [privacy, setPrivacy] = useState('')
  const [application, setApplication] = useState<HousingApplication | null>(null)
  const [lockedReason, setLockedReason] = useState('')
  const [message, setMessage] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [docsVerified, setDocsVerified] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')
  const [form, setForm] = useState<FormState>({
    preferredProvince: '',
    preferredMunicipality: '',
    currentHousingSituation: '',
    reason: '',
    consentAccepted: false,
  })
  const canSaveRef = useRef(false)
  const formRef = useRef(form)
  const applicationRef = useRef(application)

  useEffect(() => {
    formRef.current = form
  }, [form])

  useEffect(() => {
    applicationRef.current = application
  }, [application])

  useEffect(() => {
    getPrivacyNotice().then(setPrivacy)
  }, [])

  useEffect(() => {
    if (!user) return
    ;(async () => {
      if (!editId) {
        setLockedReason('Start an application and complete document verification first.')
        return
      }
      await refreshDocumentData(user.id)
      const app = await getApplication(editId)
      if (!app || app.clientId !== user.id) {
        setLockedReason('Application not found.')
        return
      }
      setApplication(app)
      setDocsVerified(
        areAllUploadedDocumentsVerified(user.id) || areAllMandatoryDocumentsVerified(user.id),
      )
      if (!canFillApplicationForm(app.status)) {
        setLockedReason(
          app.status === 'Documents Under Review'
            ? 'Your documents are still under review. The form will unlock after an administrator verifies them.'
            : app.status === 'Awaiting Documents' || app.status === 'Documents Required'
              ? 'Attach and submit your required documents for review before completing this form.'
              : 'This application is not available for editing.',
        )
        return
      }
      setLockedReason('')
      setForm({
        preferredProvince: app.preferredProvince || '',
        preferredMunicipality: app.preferredMunicipality || '',
        currentHousingSituation: app.currentHousingSituation || '',
        reason: app.reason || '',
        consentAccepted: Boolean(app.consentAccepted),
      })
      canSaveRef.current = true
    })()
  }, [user, editId])

  const set = (key: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const persistProgress = async (silent = true) => {
    if (!user || !applicationRef.current || !canSaveRef.current) return
    const current = formRef.current
    const result = await saveApplicationProgress(user.id, {
      id: applicationRef.current.id,
      preferredProvince: current.preferredProvince,
      preferredMunicipality: current.preferredMunicipality,
      currentHousingSituation: current.currentHousingSituation,
      reason: current.reason,
      consentAccepted: current.consentAccepted,
    })
    if (!result.ok) {
      if (!silent) setMessage({ tone: 'error', text: result.error })
      return
    }
    setApplication(result.application)
    setSaveStatus(`Saved ${new Date().toLocaleTimeString()}`)
    if (!silent) setMessage({ tone: 'success', text: 'Progress saved.' })
  }

  useEffect(() => {
    if (!application || lockedReason) return
    const timer = window.setTimeout(() => {
      persistProgress(true)
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [form, application, lockedReason])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') persistProgress(true)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const submit = async () => {
    if (!user || !application) return
    if (!areAllUploadedDocumentsVerified(user.id) && !areAllMandatoryDocumentsVerified(user.id)) {
      setMessage({
        tone: 'error',
        text: 'The application cannot be sent until all mandatory documents are attached and verified by an administrator.',
      })
      return
    }
    setLoading(true)
    await persistProgress(true)
    const result = await submitApplication(user.id, application.id)
    setLoading(false)
    if (!result.ok) {
      setMessage({ tone: 'error', text: result.error })
      return
    }
    canSaveRef.current = false
    setMessage({ tone: 'success', text: 'Application submitted successfully.' })
    navigate('/client/applications')
  }

  if (lockedReason) {
    return (
      <div>
        <PageHeader
          title="Housing Application Form"
          subtitle="Available only after your required documents have been verified by an administrator."
        />
        <Card>
          <Alert tone="warning">{lockedReason}</Alert>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              to={application ? `/client/applications/upload?id=${application.id}` : '/client/applications/new'}
              className="inline-flex rounded-xl bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Attach application documents
            </Link>
            <Link
              to="/client/applications/new"
              className="inline-flex rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-navy-900"
            >
              Start / continue application
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Housing Application Form"
        subtitle={
          application
            ? `Step 2 — complete your application (${application.referenceNumber}). Progress is saved automatically.`
            : 'Complete your housing application. Progress is saved automatically.'
        }
      />
      <Card>
        {message && (
          <div className="mb-4">
            <Alert tone={message.tone}>{message.text}</Alert>
          </div>
        )}
        {!docsVerified && (
          <div className="mb-4">
            <Alert tone="error">
              All mandatory documents must be attached and verified before this application can be sent.
            </Alert>
          </div>
        )}
        {saveStatus && <p className="mb-4 text-xs text-slate-400">{saveStatus}</p>}
        <div className="grid gap-4 md:grid-cols-2">
          <Select
            label="Preferred Province"
            required
            value={form.preferredProvince}
            onChange={(e) => set('preferredProvince', e.target.value)}
          >
            <option value="">Select province</option>
            {PROVINCES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
          <Input
            label="Preferred Municipality"
            required
            value={form.preferredMunicipality}
            onChange={(e) => set('preferredMunicipality', e.target.value)}
          />
          <Select
            label="Current Housing Situation"
            required
            value={form.currentHousingSituation}
            onChange={(e) => set('currentHousingSituation', e.target.value)}
          >
            <option value="">Select situation</option>
            {HOUSING.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </Select>
        </div>
        <div className="mt-4">
          <TextArea
            label="Reason for Applying for Housing Assistance"
            required
            rows={5}
            value={form.reason}
            onChange={(e) => set('reason', e.target.value)}
          />
        </div>
        <label className="mt-4 flex items-start gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            className="mt-1"
            checked={form.consentAccepted}
            onChange={(e) => set('consentAccepted', e.target.checked)}
          />
          <span>
            I declare that the information supplied is accurate and I consent to processing of my personal information.
            <span className="mt-1 block text-xs text-slate-400">{privacy}</span>
          </span>
        </label>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="button" variant="secondary" disabled={loading} onClick={() => persistProgress(false)}>
            Save progress
          </Button>
          <Button type="button" disabled={loading || !docsVerified} onClick={submit}>
            Submit Application
          </Button>
        </div>
        {!docsVerified && (
          <p className="mt-2 text-xs text-amber-700">
            Submission stays disabled until every mandatory document is verified.
          </p>
        )}
      </Card>
    </div>
  )
}
