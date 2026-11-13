import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Badge, Card, EmptyState, PageHeader, Select, Timeline } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { getApplicationsForClient, getStatusHistory } from '../../services/applicationService'
import { areAllUploadedDocumentsVerified, refreshDocumentData } from '../../services/documentService'
import type { HousingApplication, StatusHistoryEntry } from '../../types'
import { buildApplicationStatusSteps } from '../../utils/applicationProgress'
import { formatDateTime } from '../../utils/format'

export default function ApplicationStatusPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const [apps, setApps] = useState<HousingApplication[]>([])
  const [history, setHistory] = useState<StatusHistoryEntry[]>([])
  const [documentsFullyVerified, setDocumentsFullyVerified] = useState(false)
  const selectedId = params.get('id') || ''

  useEffect(() => {
    if (!user) return
    ;(async () => {
      await refreshDocumentData(user.id)
      setDocumentsFullyVerified(areAllUploadedDocumentsVerified(user.id))
      const list = await getApplicationsForClient(user.id)
      setApps(list)
      if (!selectedId && list[0]) setParams({ id: list[0].id })
    })()
  }, [user, selectedId, setParams])

  useEffect(() => {
    if (!selectedId) return
    getStatusHistory(selectedId).then(setHistory)
  }, [selectedId])

  const app = apps.find((a) => a.id === selectedId)

  const steps = useMemo(
    () => buildApplicationStatusSteps(app, { documentsFullyVerified }),
    [app, documentsFullyVerified],
  )

  return (
    <div>
      <PageHeader title="Application Status" subtitle="Track document review and application progress." />
      {apps.length === 0 ? (
        <EmptyState title="No applications to track" description="Start an application to see status updates here." />
      ) : (
        <>
          <div className="mb-4 max-w-md">
            <Select label="Select application" value={selectedId} onChange={(e) => setParams({ id: e.target.value })}>
              {apps.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.referenceNumber} — {a.status}
                </option>
              ))}
            </Select>
          </div>
          {app && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card title="Progress timeline">
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-sm text-slate-500">Current status:</span>
                  <Badge status={app.status} />
                </div>
                <Timeline steps={steps} />
              </Card>
              <Card title="Status history">
                <ul className="space-y-3">
                  {history.map((h) => (
                    <li key={h.id} className="rounded-xl border border-slate-100 px-3 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <Badge status={h.status} />
                        <span className="text-xs text-slate-400">{formatDateTime(h.createdAt)}</span>
                      </div>
                      {h.note && <p className="mt-2 text-sm text-slate-600">{h.note}</p>}
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  )
}
