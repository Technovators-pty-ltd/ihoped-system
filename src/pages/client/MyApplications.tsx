import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, PageHeader, Select } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { getApplicationsForClient } from '../../services/applicationService'
import type { ApplicationStatus, HousingApplication } from '../../types'
import { formatDate } from '../../utils/format'

export default function MyApplications() {
  const { user } = useAuth()
  const [apps, setApps] = useState<HousingApplication[]>([])
  const [filter, setFilter] = useState<ApplicationStatus | 'All'>('All')

  useEffect(() => {
    if (!user) return
    getApplicationsForClient(user.id).then(setApps)
  }, [user])

  const filtered = filter === 'All' ? apps : apps.filter((a) => a.status === filter)

  return (
    <div>
      <PageHeader
        title="My Applications"
        subtitle="View and continue your housing applications."
        actions={
          <Link to="/client/applications/new">
            <Button>Start New Application</Button>
          </Link>
        }
      />
      <Card>
        <div className="mb-4 max-w-xs">
          <Select label="Filter by status" value={filter} onChange={(e) => setFilter(e.target.value as ApplicationStatus | 'All')}>
            <option value="All">All</option>
            {[
              'Awaiting Documents',
              'Documents Under Review',
              'Documents Required',
              'In Progress',
              'Submitted',
              'Under Review',
              'Approved',
              'Rejected',
            ].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        {filtered.length === 0 ? (
          <EmptyState title="No applications found" description="Start a new housing application to get started." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-100 text-slate-500">
                <tr>
                  <th className="px-3 py-3 font-medium">Reference</th>
                  <th className="px-3 py-3 font-medium">Province</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Updated</th>
                  <th className="px-3 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((app) => (
                  <tr key={app.id} className="border-b border-slate-50 hover:bg-slate-50/80">
                    <td className="px-3 py-3 font-medium text-navy-900">{app.referenceNumber}</td>
                    <td className="px-3 py-3">{app.preferredProvince}</td>
                    <td className="px-3 py-3">
                      <Badge status={app.status} />
                    </td>
                    <td className="px-3 py-3">{formatDate(app.updatedAt)}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link to={`/client/status?id=${app.id}`} className="text-accent hover:underline">
                          Track
                        </Link>
                        {['Awaiting Documents', 'Documents Under Review', 'Documents Required'].includes(app.status) && (
                          <Link to={`/client/applications/upload?id=${app.id}`} className="text-navy-700 hover:underline">
                            {app.status === 'Documents Required' ? 'Fix declined documents' : 'Attach documents'}
                          </Link>
                        )}
                        {app.status === 'In Progress' && (
                          <Link to={`/client/applications/form?id=${app.id}`} className="text-navy-700 hover:underline">
                            Continue form
                          </Link>
                        )}
                      </div>
                    </td>
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
