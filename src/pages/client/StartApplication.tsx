import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Card, PageHeader } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { startOrContinueApplication } from '../../services/applicationService'

export default function StartApplication() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    ;(async () => {
      try {
        const { application, next } = await startOrContinueApplication(user.id)
        if (next === 'documents') {
          navigate(`/client/applications/upload?id=${application.id}`, { replace: true })
        } else {
          navigate(`/client/applications/form?id=${application.id}`, { replace: true })
        }
      } catch {
        setError('Could not start the application. Please try again.')
      }
    })()
  }, [user, navigate])

  return (
    <div>
      <PageHeader
        title="Start Housing Application"
        subtitle="Step 1: upload required documents for review. The application form unlocks after an administrator verifies them."
      />
      <Card>
        {error ? <Alert tone="error">{error}</Alert> : <p className="text-sm text-slate-500">Preparing your application…</p>}
      </Card>
    </div>
  )
}
