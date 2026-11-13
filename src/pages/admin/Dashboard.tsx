import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCheck,
  faClock,
  faFileCircleExclamation,
  faHouseUser,
  faThumbsDown,
  faUsers,
  faInbox,
} from '@fortawesome/free-solid-svg-icons'
import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, PageHeader, StatCard } from '../../components/ui'
import { getAllApplications } from '../../services/applicationService'
import { getAllClients } from '../../services/clientService'
import type { HousingApplication } from '../../types'

const COLORS = ['#0c2240', '#f4a21f', '#1da7a0', '#ef4444', '#217eb4', '#94a3b8', '#22c55e']

export default function AdminDashboard() {
  const [apps, setApps] = useState<HousingApplication[]>([])
  const [clientCount, setClientCount] = useState(0)

  useEffect(() => {
    ;(async () => {
      setApps(await getAllApplications())
      setClientCount((await getAllClients()).length)
    })()
  }, [])

  const count = (s: string) => apps.filter((a) => a.status === s).length

  const byStatus = useMemo(
    () =>
      [
        'Awaiting Documents',
        'Documents Under Review',
        'Documents Required',
        'In Progress',
        'Submitted',
        'Under Review',
        'Approved',
        'Rejected',
      ].map((status) => ({
        name: status,
        value: count(status),
      })),
    [apps],
  )

  const monthly = useMemo(() => {
    const map: Record<string, number> = {}
    apps.forEach((a) => {
      const key = new Date(a.createdAt).toLocaleString('en-ZA', { month: 'short', year: '2-digit' })
      map[key] = (map[key] || 0) + 1
    })
    return Object.entries(map).map(([month, total]) => ({ month, total }))
  }, [apps])

  return (
    <div>
      <PageHeader title="Admin Dashboard" subtitle="Overview of clients, applications and document workflows." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Registered Clients" value={clientCount} icon={<FontAwesomeIcon icon={faUsers} />} />
        <StatCard label="Total Housing Applications" value={apps.length} icon={<FontAwesomeIcon icon={faHouseUser} />} tone="teal" />
        <StatCard label="Documents Under Review" value={count('Documents Under Review')} icon={<FontAwesomeIcon icon={faInbox} />} tone="amber" />
        <StatCard label="Under Review" value={count('Under Review')} icon={<FontAwesomeIcon icon={faClock} />} tone="slate" />
        <StatCard label="Docs Required / Awaiting" value={count('Documents Required') + count('Awaiting Documents')} icon={<FontAwesomeIcon icon={faFileCircleExclamation} />} tone="red" />
        <StatCard label="Approved" value={count('Approved')} icon={<FontAwesomeIcon icon={faCheck} />} tone="green" />
        <StatCard label="Rejected" value={count('Rejected')} icon={<FontAwesomeIcon icon={faThumbsDown} />} tone="red" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Applications by status">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byStatus} dataKey="value" nameKey="name" outerRadius={100} label>
                  {byStatus.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Monthly application volume">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly.length ? monthly : [{ month: 'N/A', total: 0 }]}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="total" fill="#0c2240" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  )
}
