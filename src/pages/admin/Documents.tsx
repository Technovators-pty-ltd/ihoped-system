import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faCheckCircle, faFileAlt, faUser } from '@fortawesome/free-solid-svg-icons'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, EmptyState, Input, Modal, PageHeader, Select, TextArea } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { syncApplicationAfterDocumentReview } from '../../services/applicationService'
import { getAllDocuments, getDocumentCategories, reviewDocument } from '../../services/documentService'
import { getAllClients } from '../../services/clientService'
import type { ClientProfile, DocumentCategory, UploadedDocument } from '../../types'
import { formatDate, formatDateTime, formatFileSize } from '../../utils/format'
import { maskIdNumber } from '../../utils/saId'

type ClientDocGroup = {
  clientId: string
  client?: ClientProfile
  documents: UploadedDocument[]
  pending: number
  verified: number
  rejected: number
  latestUpload?: string
}

const CLIENT_PAGE_SIZE = 9
const DOC_PAGE_SIZE = 5

function PaginationBar({
  page,
  totalPages,
  totalItems,
  pageSize,
  onChange,
  label,
}: {
  page: number
  totalPages: number
  totalItems: number
  pageSize: number
  onChange: (page: number) => void
  label: string
}) {
  if (totalItems <= pageSize) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalItems)

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3">
      <p className="text-sm text-slate-500">
        Showing {from}–{to} of {totalItems} {label}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Previous
        </Button>
        <span className="px-2 text-sm font-medium text-navy-900">
          Page {page} of {totalPages}
        </span>
        <Button variant="secondary" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  )
}

export default function AdminDocuments() {
  const { user } = useAuth()
  const [docs, setDocs] = useState<UploadedDocument[]>([])
  const [categories, setCategories] = useState<DocumentCategory[]>([])
  const [clients, setClients] = useState<ClientProfile[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | 'Needs Review' | 'Verified' | 'Rejected' | 'Resubmission Required'>('All')
  const [docStatusFilter, setDocStatusFilter] = useState<'All' | UploadedDocument['status']>('All')
  const [activeClientId, setActiveClientId] = useState<string | null>(null)
  const [selected, setSelected] = useState<UploadedDocument | null>(null)
  const [note, setNote] = useState('')
  const [message, setMessage] = useState('')
  const [clientPage, setClientPage] = useState(1)
  const [docPage, setDocPage] = useState(1)

  const reload = async () => {
    setDocs(await getAllDocuments())
    setCategories(await getDocumentCategories())
    setClients(await getAllClients())
  }

  useEffect(() => {
    reload()
  }, [])

  const groups = useMemo<ClientDocGroup[]>(() => {
    const map = new Map<string, UploadedDocument[]>()
    docs.forEach((d) => {
      const list = map.get(d.clientId) || []
      list.push(d)
      map.set(d.clientId, list)
    })

    const statusRank = (status: UploadedDocument['status']) => {
      if (status === 'Verified') return 0
      if (status === 'Uploaded' || status === 'Pending') return 1
      if (status === 'Resubmission Required') return 2
      if (status === 'Rejected') return 3
      return 4
    }

    return Array.from(map.entries())
      .map(([clientId, documents]) => {
        const sorted = [...documents].sort((a, b) => {
          const byStatus = statusRank(a.status) - statusRank(b.status)
          if (byStatus !== 0) return byStatus
          return b.uploadedAt.localeCompare(a.uploadedAt)
        })
        return {
          clientId,
          client: clients.find((c) => c.id === clientId),
          documents: sorted,
          pending: documents.filter((d) => d.status === 'Uploaded').length,
          verified: documents.filter((d) => d.status === 'Verified').length,
          rejected: documents.filter((d) => ['Rejected', 'Resubmission Required'].includes(d.status)).length,
          latestUpload: [...documents].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))[0]?.uploadedAt,
        }
      })
      .sort((a, b) => {
        if (b.pending !== a.pending) return b.pending - a.pending
        return (b.latestUpload || '').localeCompare(a.latestUpload || '')
      })
  }, [docs, clients])

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase()
    return groups.filter((g) => {
      const name = g.client ? `${g.client.firstName} ${g.client.surname}`.toLowerCase() : ''
      const email = g.client?.email.toLowerCase() || ''
      const account = g.client?.accountId.toLowerCase() || ''
      const matchesQuery =
        !q ||
        name.includes(q) ||
        email.includes(q) ||
        account.includes(q) ||
        g.clientId.toLowerCase().includes(q)

      if (!matchesQuery) return false

      if (statusFilter === 'Needs Review') return g.pending > 0
      if (statusFilter === 'Verified') return g.verified > 0 && g.pending === 0 && g.rejected === 0
      if (statusFilter === 'Rejected') return g.documents.some((d) => d.status === 'Rejected')
      if (statusFilter === 'Resubmission Required') return g.rejected > 0
      return true
    })
  }, [groups, query, statusFilter])

  useEffect(() => {
    setClientPage(1)
  }, [query, statusFilter])

  useEffect(() => {
    setDocPage(1)
  }, [activeClientId, docStatusFilter])

  const clientTotalPages = Math.max(1, Math.ceil(filteredGroups.length / CLIENT_PAGE_SIZE))
  const safeClientPage = Math.min(clientPage, clientTotalPages)
  const pagedGroups = useMemo(() => {
    const start = (safeClientPage - 1) * CLIENT_PAGE_SIZE
    return filteredGroups.slice(start, start + CLIENT_PAGE_SIZE)
  }, [filteredGroups, safeClientPage])

  const activeGroup = groups.find((g) => g.clientId === activeClientId) || null

  const activeDocuments = useMemo(() => {
    if (!activeGroup) return []
    if (docStatusFilter === 'All') return activeGroup.documents
    return activeGroup.documents.filter((d) => d.status === docStatusFilter)
  }, [activeGroup, docStatusFilter])

  const docTotalPages = Math.max(1, Math.ceil(activeDocuments.length / DOC_PAGE_SIZE))
  const safeDocPage = Math.min(docPage, docTotalPages)
  const pagedDocuments = useMemo(() => {
    const start = (safeDocPage - 1) * DOC_PAGE_SIZE
    return activeDocuments.slice(start, start + DOC_PAGE_SIZE)
  }, [activeDocuments, safeDocPage])

  const categoryFor = (id: string) => categories.find((c) => c.id === id)
  const label = (id: string) => categoryFor(id)?.title || id
  const descriptionFor = (id: string) => (categoryFor(id)?.description || '').trim()

  const displayName = (group: ClientDocGroup) =>
    group.client ? `${group.client.firstName} ${group.client.surname}` : group.clientId

  const review = async (status: UploadedDocument['status']) => {
    if (!user || !selected) return
    if ((status === 'Rejected' || status === 'Resubmission Required') && !note.trim()) {
      setMessage('Please provide a reason.')
      return
    }
    await reviewDocument({
      documentId: selected.id,
      status,
      note,
      adminId: user.id,
      adminName: user.name,
    })
    syncApplicationAfterDocumentReview('', user.id, user.name)
    setMessage(
      status === 'Verified'
        ? 'Document verified. When all mandatory documents are verified, the client form unlocks automatically.'
        : `Document marked as ${status}.`,
    )
    setSelected(null)
    setNote('')
    reload()
  }

  return (
    <div>
      <PageHeader
        title="Review Documents"
        subtitle={
          activeGroup
            ? `Documents for ${displayName(activeGroup)}`
            : 'Select a client card to review their uploaded documents.'
        }
        actions={
          activeGroup ? (
            <Button
              variant="secondary"
              onClick={() => {
                setActiveClientId(null)
                setDocStatusFilter('All')
              }}
            >
              <FontAwesomeIcon icon={faArrowLeft} /> Back to clients
            </Button>
          ) : undefined
        }
      />

      {message && (
        <div className="mb-4">
          <Alert tone="info">{message}</Alert>
        </div>
      )}

      {!activeGroup ? (
        <>
          <div className="mb-4 grid gap-4 md:grid-cols-2 lg:max-w-3xl">
            <Input
              label="Search clients"
              placeholder="Name, email or account ID"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setClientPage(1)
              }}
            />
            <Select
              label="Filter by status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(
                  e.target.value as 'All' | 'Needs Review' | 'Verified' | 'Rejected' | 'Resubmission Required',
                )
                setClientPage(1)
              }}
            >
              <option value="All">All clients</option>
              <option value="Needs Review">Needs review</option>
              <option value="Verified">Fully verified / approved</option>
              <option value="Rejected">Has rejected documents</option>
              <option value="Resubmission Required">Resubmission required</option>
            </Select>
          </div>

          {filteredGroups.length === 0 ? (
            <EmptyState
              title="No clients match this filter"
              description="Try another status filter, or clear the search to see everyone with uploads."
            />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {pagedGroups.map((group) => (
                  <button
                    key={group.clientId}
                    type="button"
                    onClick={() => {
                      setActiveClientId(group.clientId)
                      setDocPage(1)
                    }}
                    className="slide-up rounded-2xl border border-slate-200/80 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-navy-600/30 hover:shadow-md"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy-900 text-white">
                        <FontAwesomeIcon icon={faUser} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-navy-900">{displayName(group)}</p>
                        <p className="truncate text-xs text-slate-500">
                          {group.client?.email || group.clientId}
                        </p>
                        {group.client?.accountId && (
                          <p className="mt-1 text-xs text-slate-400">{group.client.accountId}</p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-slate-50 px-2 py-2">
                        <p className="text-lg font-bold text-navy-900">{group.documents.length}</p>
                        <p className="text-[11px] text-slate-500">Files</p>
                      </div>
                      <div className="rounded-xl bg-amber-50 px-2 py-2">
                        <p className="text-lg font-bold text-amber-700">{group.pending}</p>
                        <p className="text-[11px] text-amber-700/80">To review</p>
                      </div>
                      <div className="rounded-xl bg-emerald-50 px-2 py-2">
                        <p className="text-lg font-bold text-emerald-700">{group.verified}</p>
                        <p className="text-[11px] text-emerald-700/80">Verified</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-slate-400">
                        Latest: {formatDate(group.latestUpload)}
                      </p>
                      {group.pending > 0 ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                          Action needed
                        </span>
                      ) : group.rejected > 0 ? (
                        <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-semibold text-orange-800">
                          {group.rejected} resubmission
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                          Up to date
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              <PaginationBar
                page={safeClientPage}
                totalPages={clientTotalPages}
                totalItems={filteredGroups.length}
                pageSize={CLIENT_PAGE_SIZE}
                onChange={setClientPage}
                label="clients"
              />
            </>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-navy-900">{displayName(activeGroup)}</p>
                <p className="text-sm text-slate-500">{activeGroup.client?.email || activeGroup.clientId}</p>
                {activeGroup.client && (
                  <p className="mt-1 text-xs text-slate-400">
                    Account {activeGroup.client.accountId} · ID {maskIdNumber(activeGroup.client.idNumber)}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">
                  {activeGroup.pending} to review
                </span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-800">
                  {activeGroup.verified} verified
                </span>
                <span className="rounded-full bg-orange-50 px-2.5 py-1 font-semibold text-orange-800">
                  {activeGroup.rejected} needs resubmission
                </span>
              </div>
            </div>
          </Card>

          <div className="max-w-xs">
            <Select
              label="Filter documents"
              value={docStatusFilter}
              onChange={(e) => {
                setDocStatusFilter(e.target.value as 'All' | UploadedDocument['status'])
                setDocPage(1)
              }}
            >
              <option value="All">All documents</option>
              <option value="Uploaded">Needs review</option>
              <option value="Verified">Verified / approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Resubmission Required">Resubmission required</option>
              <option value="Pending">Pending</option>
            </Select>
          </div>

          {activeDocuments.length === 0 ? (
            <EmptyState
              title="No documents for this filter"
              description="Choose another status to see this client's files."
            />
          ) : (
            <>
              <div className="space-y-3">
                {pagedDocuments.map((d, index) => {
                  const isVerified = d.status === 'Verified'
                  const prev = pagedDocuments[index - 1]
                  const showVerifiedHeading =
                    docStatusFilter === 'All' &&
                    isVerified &&
                    (index === 0 || prev?.status !== 'Verified')
                  const showNeedsReviewHeading =
                    docStatusFilter === 'All' &&
                    !isVerified &&
                    (index === 0 || prev?.status === 'Verified')

                  return (
                    <div key={d.id}>
                      {showVerifiedHeading && (
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                          Verified documents ({activeDocuments.filter((x) => x.status === 'Verified').length})
                        </p>
                      )}
                      {showNeedsReviewHeading && (
                        <p className={`mb-3 text-xs font-semibold uppercase tracking-wide text-amber-700 ${index > 0 ? 'mt-4' : ''}`}>
                          Remaining documents
                        </p>
                      )}
                      <div
                        className={`rounded-2xl border p-5 shadow-sm ${
                          isVerified
                            ? 'border-emerald-300 bg-emerald-50/70 dark:border-emerald-700 dark:bg-emerald-950/40'
                            : 'border-slate-200/80 bg-white'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="flex min-w-0 items-start gap-3">
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                                isVerified
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-100 text-navy-800'
                              }`}
                            >
                              <FontAwesomeIcon icon={isVerified ? faCheckCircle : faFileAlt} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-semibold text-navy-900">{label(d.categoryId)}</h3>
                                <Badge status={d.status} />
                                {isVerified && (
                                  <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                                    Verified
                                  </span>
                                )}
                              </div>
                              {descriptionFor(d.categoryId) && (
                                <p className="mt-1 text-sm leading-relaxed text-navy-800">
                                  {descriptionFor(d.categoryId)}
                                </p>
                              )}
                              <p className="mt-1 text-sm text-slate-500">
                                {d.fileName} · {formatFileSize(d.fileSize)}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">Uploaded {formatDateTime(d.uploadedAt)}</p>
                              {d.reviewNote && <p className="mt-2 text-xs text-amber-700">Note: {d.reviewNote}</p>}
                            </div>
                          </div>
                          <Button variant={isVerified ? 'secondary' : 'primary'} onClick={() => setSelected(d)}>
                            {isVerified ? 'View' : 'Review'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <PaginationBar
                page={safeDocPage}
                totalPages={docTotalPages}
                totalItems={activeDocuments.length}
                pageSize={DOC_PAGE_SIZE}
                onChange={setDocPage}
                label="documents"
              />
            </>
          )}
        </div>
      )}

      <Modal open={Boolean(selected)} title="Document review" onClose={() => setSelected(null)}>
        {selected && (
          <div className="space-y-4">
            <p className="text-sm">
              {label(selected.categoryId)} — {selected.fileName}
            </p>
            {selected.previewUrl &&
              (selected.fileType.startsWith('image/') ? (
                <img src={selected.previewUrl} alt="" className="max-h-64 w-full rounded-xl object-contain" />
              ) : (
                <iframe title="preview" src={selected.previewUrl} className="h-64 w-full rounded-xl border" />
              ))}
            <TextArea label="Review note / reason" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => review('Verified')}>Verify</Button>
              <Button variant="accent" onClick={() => review('Resubmission Required')}>
                Request resubmission
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
