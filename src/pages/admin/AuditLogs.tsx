import { useEffect, useState } from 'react'
import { Card, EmptyState, PageHeader } from '../../components/ui'
import { getAuditLogs } from '../../services/auditService'
import type { AuditLog } from '../../types'
import { formatDateTime } from '../../utils/format'

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([])

  useEffect(() => {
    getAuditLogs().then(setLogs).catch(() => setLogs([]))
  }, [])

  return (
    <div>
      <PageHeader title="Audit Logs" subtitle="Administrative actions recorded for accountability." />
      <Card>
        {logs.length === 0 ? (
          <EmptyState title="No audit entries" description="Admin actions will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-100 text-slate-500">
                <tr>
                  <th className="px-3 py-3">When</th>
                  <th className="px-3 py-3">Actor</th>
                  <th className="px-3 py-3">Action</th>
                  <th className="px-3 py-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-slate-50">
                    <td className="px-3 py-3 whitespace-nowrap">{formatDateTime(l.createdAt)}</td>
                    <td className="px-3 py-3">
                      {l.actorName} ({l.actorRole})
                    </td>
                    <td className="px-3 py-3 font-medium">{l.action}</td>
                    <td className="px-3 py-3 text-slate-600">{l.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
