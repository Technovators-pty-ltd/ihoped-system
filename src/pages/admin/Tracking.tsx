import { useEffect, useState } from 'react'
import { Badge, Card, PageHeader, Select, Timeline } from '../../components/ui'
import { getAllApplications, getStatusHistory } from '../../services/applicationService'
import type { HousingApplication, StatusHistoryEntry } from '../../types'
import { formatDateTime } from '../../utils/format'

export default function AdminTracking() {
  const [apps, setApps] = useState<HousingApplication[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [history, setHistory] = useState<StatusHistoryEntry[]>([])

  useEffect(() => {
    getAllApplications().then((list) => {
      setApps(list)
      if (list[0]) setSelectedId(list[0].id)
    })
  }, [])

  useEffect(() => {
    if (!selectedId) return
    getStatusHistory(selectedId).then(setHistory)
  }, [selectedId])

  const app = apps.find((a) => a.id === selectedId)

  return (
    <div>
      <PageHeader title="Application Tracking" subtitle="Follow status changes across the application lifecycle." />
      <div className="mb-4 max-w-md">
        <Select label="Application" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          {apps.map((a) => (
            <option key={a.id} value={a.id}>
              {a.referenceNumber} — {a.status}
            </option>
          ))}
        </Select>
      </div>
      {app && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Current status">
            <Badge status={app.status} />
            <p className="mt-4 text-sm text-slate-600">Last updated {formatDateTime(app.updatedAt)}</p>
            <div className="mt-6">
              <Timeline
                steps={history.map((h, idx) => ({
                  label: h.status,
                  done: idx < history.length - 1,
                  current: idx === history.length - 1,
                  date: formatDateTime(h.createdAt),
                }))}
              />
            </div>
          </Card>
          <Card title="Detailed history">
            <ul className="space-y-3">
              {history.map((h) => (
                <li key={h.id} className="rounded-xl border border-slate-100 px-3 py-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <Badge status={h.status} />
                    <span className="text-xs text-slate-400">{formatDateTime(h.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-slate-600">{h.note || '—'}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    By {h.changedByRole}: {h.changedBy}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  )
}
