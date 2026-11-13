import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTimes } from '@fortawesome/free-solid-svg-icons'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Input, Modal, PageHeader } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { adminUpdateClient, getAllClients, setClientActive } from '../../services/clientService'
import { getApplicationsForClient } from '../../services/applicationService'
import { getClientDocuments } from '../../services/documentService'
import type { ClientProfile, HousingApplication, UploadedDocument } from '../../types'
import { maskIdNumber } from '../../utils/saId'
import { formatDate } from '../../utils/format'

export default function AdminClients() {
  const { user } = useAuth()
  const [clients, setClients] = useState<ClientProfile[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<ClientProfile | null>(null)
  const [apps, setApps] = useState<HousingApplication[]>([])
  const [docs, setDocs] = useState<UploadedDocument[]>([])
  const [editPhone, setEditPhone] = useState('')
  const [message, setMessage] = useState('')

  const reload = async () => setClients(await getAllClients())

  useEffect(() => {
    reload()
  }, [])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return clients.filter(
      (c) =>
        `${c.firstName} ${c.surname}`.toLowerCase().includes(q) ||
        c.username.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.idNumber.includes(q),
    )
  }, [clients, query])

  const openClient = async (c: ClientProfile) => {
    setSelected(c)
    setEditPhone(c.phone || '')
    setApps(await getApplicationsForClient(c.id))
    setDocs(await getClientDocuments(c.id))
  }

  const closeClient = () => {
    setSelected(null)
    setApps([])
    setDocs([])
    setEditPhone('')
  }

  return (
    <div>
      <PageHeader title="Manage Clients" subtitle="Search, view and manage registered client accounts." />
      {message && (
        <div className="mb-4">
          <Alert tone="success">{message}</Alert>
        </div>
      )}
      <Card>
        <div className="mb-4 max-w-md">
          <Input label="Search by name, username, email or ID" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-100 text-slate-500">
              <tr>
                <th className="px-3 py-3">Name</th>
                <th className="px-3 py-3">Username</th>
                <th className="px-3 py-3">Email</th>
                <th className="px-3 py-3">ID</th>
                <th className="px-3 py-3">Registered</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-3 py-3 font-medium">
                    {c.firstName} {c.surname}
                  </td>
                  <td className="px-3 py-3">{c.username}</td>
                  <td className="px-3 py-3">{c.email}</td>
                  <td className="px-3 py-3">{maskIdNumber(c.idNumber)}</td>
                  <td className="px-3 py-3">{formatDate(c.registeredAt)}</td>
                  <td className="px-3 py-3">{c.active ? 'Active' : 'Inactive'}</td>
                  <td className="px-3 py-3">
                    <button className="font-medium text-accent hover:underline" onClick={() => openClient(c)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={Boolean(selected)}
        title={selected ? `${selected.firstName} ${selected.surname}` : ''}
        onClose={closeClient}
        footer={
          selected && user ? (
            <>
              <Button
                variant="secondary"
                onClick={async () => {
                  await adminUpdateClient(selected.id, { phone: editPhone }, user.id, user.name)
                  setMessage('Client updated.')
                  closeClient()
                  reload()
                }}
              >
                Save phone
              </Button>
              <Button
                variant={selected.active ? 'danger' : 'accent'}
                onClick={async () => {
                  await setClientActive(selected.id, !selected.active, user.id, user.name)
                  setMessage(`Client ${selected.active ? 'deactivated' : 'activated'}.`)
                  closeClient()
                  reload()
                }}
              >
                {selected.active ? 'Deactivate' : 'Activate'}
              </Button>
            </>
          ) : undefined
        }
      >
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="-mt-1 mb-1 flex justify-end">
              <button
                type="button"
                onClick={closeClient}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-700 transition hover:bg-red-600 hover:text-white"
                aria-label="Close"
                title="Close"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <p>
              <span className="text-slate-500">Account:</span> {selected.accountId}
            </p>
            <p>
              <span className="text-slate-500">Username:</span> {selected.username}
            </p>
            <p>
              <span className="text-slate-500">Email:</span> {selected.email}
            </p>
            <p>
              <span className="text-slate-500">ID:</span> {maskIdNumber(selected.idNumber)}
            </p>
            <Input label="Phone" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            <div>
              <p className="mb-2 font-semibold">Applications ({apps.length})</p>
              <ul className="space-y-1 text-slate-600">
                {apps.map((a) => (
                  <li key={a.id}>
                    {a.referenceNumber} — {a.status}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2 font-semibold">Documents ({docs.length})</p>
              <ul className="space-y-1 text-slate-600">
                {docs.map((d) => (
                  <li key={d.id}>
                    {d.fileName} — {d.status}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
