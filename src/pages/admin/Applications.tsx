import { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, Input, Modal, PageHeader, Select, TextArea } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import {
  addInternalNote,
  assignApplication,
  getAllApplications,
  updateApplicationStatus,
} from '../../services/applicationService'
import { getAllClients } from '../../services/clientService'
import type { ApplicationStatus, ClientProfile, HousingApplication } from '../../types'
import { formatDate } from '../../utils/format'

const STATUSES: ApplicationStatus[] = [
  'Awaiting Documents',
  'Documents Under Review',
  'Documents Required',
  'In Progress',
  'Submitted',
  'Under Review',
  'Approved',
  'Rejected',
]

export default function AdminApplications() {
  const { user } = useAuth()
  const [apps, setApps] = useState<HousingApplication[]>([])
  const [clients, setClients] = useState<ClientProfile[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All')
  const [selected, setSelected] = useState<HousingApplication | null>(null)
  const [note, setNote] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [message, setMessage] = useState('')

  const reload = async () => {
    setApps(await getAllApplications())
    setClients(await getAllClients())
  }

  useEffect(() => {
    reload()
  }, [])

  const clientFor = (clientId: string) => clients.find((x) => x.id === clientId)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const qDigits = q.replace(/\s/g, '')
    return apps.filter((a) => {
      const matchS = status === 'All' || a.status === status
      if (!matchS) return false
      if (!q) return true

      const client = clientFor(a.clientId)
      const referenceMatch = a.referenceNumber.toLowerCase().includes(q)
      const idNumberMatch = Boolean(
        client?.idNumber && client.idNumber.replace(/\s/g, '').toLowerCase().includes(qDigits),
      )
      const accountIdMatch = Boolean(client?.accountId && client.accountId.toLowerCase().includes(q))
      const clientIdMatch = a.clientId.toLowerCase().includes(q)
      const nameMatch = Boolean(
        client && `${client.firstName} ${client.surname}`.toLowerCase().includes(q),
      )

      return referenceMatch || idNumberMatch || accountIdMatch || clientIdMatch || nameMatch
    })
  }, [apps, clients, query, status])

  const clientName = (id: string) => {
    const c = clientFor(id)
    return c ? `${c.firstName} ${c.surname}` : id
  }

  const changeStatus = async (next: ApplicationStatus) => {
    if (!user || !selected) return
    if (next === 'Rejected' && !rejectReason.trim()) {
      setMessage('A rejection reason is required.')
      return
    }
    if (next === 'Documents Required' && !note.trim()) {
      setMessage('Please provide a reason when requesting additional documents.')
      return
    }
    await updateApplicationStatus({
      applicationId: selected.id,
      status: next,
      adminId: user.id,
      adminName: user.name,
      note: note || undefined,
      rejectionReason: next === 'Rejected' ? rejectReason : undefined,
    })
    setMessage(`Status updated to ${next}.`)
    setSelected(null)
    setNote('')
    setRejectReason('')
    reload()
  }

  return (
    <div>
      <PageHeader title="Manage Applications" subtitle="Search, review and process housing applications." />
      {message && (
        <div className="mb-4">
          <Alert tone="info">{message}</Alert>
        </div>
      )}
      <Card>
        <div className="mb-4 grid gap-4 md:grid-cols-2">
          <Input
            label="Search by reference or ID"
            placeholder="Reference, SA ID number, or account ID"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Select label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="All">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-100 text-slate-500">
              <tr>
                <th className="px-3 py-3">Reference</th>
                <th className="px-3 py-3">Client</th>
                <th className="px-3 py-3">ID number</th>
                <th className="px-3 py-3">Province</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Submitted</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                    No applications match this search.
                  </td>
                </tr>
              ) : (
                filtered.map((a) => {
                  const client = clientFor(a.clientId)
                  return (
                    <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-3 py-3 font-medium">{a.referenceNumber}</td>
                      <td className="px-3 py-3">
                        <div>{clientName(a.clientId)}</div>
                        {client?.accountId && (
                          <div className="text-xs text-slate-400">{client.accountId}</div>
                        )}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs">{client?.idNumber || '—'}</td>
                      <td className="px-3 py-3">{a.preferredProvince}</td>
                      <td className="px-3 py-3">
                        <Badge status={a.status} />
                      </td>
                      <td className="px-3 py-3">{formatDate(a.submittedAt)}</td>
                      <td className="px-3 py-3">
                        <button className="font-medium text-accent hover:underline" onClick={() => setSelected(a)}>
                          Review
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={Boolean(selected)} title={selected?.referenceNumber || ''} onClose={() => setSelected(null)}>
        {selected && user && (
          <div className="space-y-4 text-sm">
            <p>
              <strong>Client:</strong> {clientName(selected.clientId)}
            </p>
            <p>
              <strong>ID number:</strong> {clientFor(selected.clientId)?.idNumber || '—'}
            </p>
            <p>
              <strong>Account ID:</strong> {clientFor(selected.clientId)?.accountId || '—'}
            </p>
            <p>
              <strong>Housing:</strong> {selected.currentHousingSituation}
            </p>
            <p>
              <strong>Reason:</strong> {selected.reason}
            </p>
            <p>
              <strong>Status:</strong> <Badge status={selected.status} />
            </p>
            <TextArea label="Internal note / request reason" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            <TextArea
              label="Rejection reason (required when rejecting)"
              rows={2}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                  onClick={async () => {
                  await assignApplication(selected.id, user.id, user.name)
                  setMessage('Application assigned to you.')
                  reload()
                }}
              >
                Assign to me
              </Button>
              <Button
                variant="secondary"
                onClick={async () => {
                  if (!note.trim()) return setMessage('Enter a note first.')
                  await addInternalNote(selected.id, user.id, user.name, note)
                  setMessage('Internal note added.')
                  setNote('')
                  reload()
                }}
              >
                Add note
              </Button>
              <Button onClick={() => changeStatus('Under Review')}>Under Review</Button>
              <Button variant="accent" onClick={() => changeStatus('Documents Required')}>
                Request documents
              </Button>
              <Button variant="accent" onClick={() => changeStatus('Approved')}>
                Approve
              </Button>
              <Button variant="danger" onClick={() => changeStatus('Rejected')}>
                Reject
              </Button>
            </div>
            {selected.internalNotes.length > 0 && (
              <div>
                <p className="mb-2 font-semibold">Internal notes</p>
                <ul className="space-y-2">
                  {selected.internalNotes.map((n) => (
                    <li key={n.id} className="rounded-lg bg-slate-50 px-3 py-2">
                      {n.note} <span className="text-xs text-slate-400">— {n.adminName}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
