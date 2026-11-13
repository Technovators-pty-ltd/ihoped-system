import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCheckCircle,
  faChevronLeft,
  faChevronRight,
  faEye,
  faPaperclip,
  faTriangleExclamation,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Badge, Button, Card, EmptyState, PageHeader } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import {
  getApplication,
  getApplicationsForClient,
  isDocumentPhase,
  startOrContinueApplication,
  submitDocumentsForReview,
} from '../../services/applicationService'
import {
  getClientDocuments,
  getDocumentUploadProgress,
  refreshDocumentData,
  removeDocument,
  uploadDocument,
} from '../../services/documentService'
import type { DocumentCategory, HousingApplication, UploadedDocument } from '../../types'
import { formatDate, formatFileSize } from '../../utils/format'

const PAGE_SIZE = 3

export default function ApplicationDocuments() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [categories, setCategories] = useState<DocumentCategory[]>([])
  const [docs, setDocs] = useState<UploadedDocument[]>([])
  const [application, setApplication] = useState<HousingApplication | null>(null)
  const [message, setMessage] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [preview, setPreview] = useState<UploadedDocument | null>(null)
  const [progress, setProgress] = useState({ mandatoryTotal: 0, mandatoryAttached: 0, complete: false })
  const [attachingId, setAttachingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})
  const listTopRef = useRef<HTMLDivElement | null>(null)

  const sortedCategories = useMemo(() => {
    const rank = (categoryId: string) => {
      const doc = docs.find((d) => d.categoryId === categoryId)
      if (doc && ['Rejected', 'Resubmission Required'].includes(doc.status)) return 0
      if (!doc || doc.status === 'Pending') return 1
      if (doc.status === 'Uploaded') return 2
      if (doc.status === 'Verified') return 3
      return 4
    }
    return [...categories].sort((a, b) => rank(a.id) - rank(b.id))
  }, [categories, docs])

  const declinedDocs = useMemo(() => {
    return docs
      .filter((d) => ['Rejected', 'Resubmission Required'].includes(d.status))
      .map((d) => ({
        doc: d,
        title: categories.find((c) => c.id === d.categoryId)?.title || d.fileName,
      }))
  }, [docs, categories])

  const totalPages = Math.max(1, Math.ceil(sortedCategories.length / PAGE_SIZE))
  const pageCategories = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return sortedCategories.slice(start, start + PAGE_SIZE)
  }, [sortedCategories, page])

  const reload = async () => {
    if (!user) return
    setLoading(true)
    const { categories: cats } = await refreshDocumentData(user.id)
    const clientDocs = await getClientDocuments(user.id)
    setCategories(cats)
    setDocs(clientDocs)
    setProgress(getDocumentUploadProgress(user.id))
    const hasDeclined = clientDocs.some((d) => ['Rejected', 'Resubmission Required'].includes(d.status))
    setPage((current) => {
      const pages = Math.max(1, Math.ceil(cats.length / PAGE_SIZE))
      if (hasDeclined) return 1
      return Math.min(current, pages)
    })

    const id = params.get('id')
    if (id) {
      const app = await getApplication(id)
      if (app && app.clientId === user.id) {
        setApplication(app)
        setLoading(false)
        return
      }
    }

    const apps = await getApplicationsForClient(user.id)
    const open = apps.find((a) => isDocumentPhase(a.status)) || null
    if (open) {
      setApplication(open)
      setLoading(false)
      return
    }

    try {
      const { application: started, next } = await startOrContinueApplication(user.id)
      if (next === 'form') {
        navigate(`/client/applications/form?id=${started.id}`, { replace: true })
        return
      }
      setApplication(started)
      navigate(`/client/applications/upload?id=${started.id}`, { replace: true })
    } catch {
      setMessage({ tone: 'error', text: 'Could not start the application. Please try again.' })
    }
    setLoading(false)
  }

  useEffect(() => {
    reload()
  }, [user, params])

  const goToPage = (nextPage: number) => {
    setPage(nextPage)
    listTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const onAttach = async (categoryId: string, file: File | null) => {
    if (!user || !file || !application) return
    const isPdf =
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      setMessage({
        tone: 'error',
        text: 'Documents must be PDF only. Please attach a .pdf file.',
      })
      return
    }
    setAttachingId(categoryId)
    const result = await uploadDocument({
      clientId: user.id,
      categoryId,
      file,
      applicationId: application.id,
    })
    setAttachingId(null)
    if (!result.ok) {
      setMessage({ tone: 'error', text: result.error })
      return
    }
    setMessage({
      tone: 'success',
      text: `${file.name} attached and saved. You can leave and continue later — your progress is kept.`,
    })
    reload()
  }

  const onRemove = async (docId: string) => {
    if (!user) return
    const result = await removeDocument(user.id, docId)
    if (!result.ok) {
      setMessage({ tone: 'error', text: result.error })
      return
    }
    setMessage({ tone: 'success', text: 'Attachment removed. Progress updated.' })
    reload()
  }

  const onSubmitForReview = async () => {
    if (!user || !application) {
      setMessage({ tone: 'error', text: 'Start a housing application first so documents can be linked for review.' })
      return
    }
    if (!progress.complete) {
      setMessage({
        tone: 'error',
        text: `Attach all mandatory documents before submitting (${progress.mandatoryAttached} of ${progress.mandatoryTotal} attached).`,
      })
      return
    }
    const result = await submitDocumentsForReview(user.id, application.id)
    if (!result.ok) {
      setMessage({ tone: 'error', text: result.error })
      return
    }
    setMessage({
      tone: 'success',
      text: 'Documents submitted for admin review. The application form will unlock once they are verified.',
    })
    reload()
  }

  const reviewing = application?.status === 'Documents Under Review'
  const formUnlocked = application?.status === 'In Progress'
  const needsCorrections = application?.status === 'Documents Required'
  const canEditUploads =
    Boolean(application) &&
    (application!.status === 'Awaiting Documents' || application!.status === 'Documents Required')

  const canReplaceDoc = (doc?: UploadedDocument) => {
    if (!canEditUploads) return false
    if (!doc) return true
    return doc.status !== 'Verified'
  }

  const rangeStart = sortedCategories.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, sortedCategories.length)

  if (loading && !application) {
    return (
      <div>
        <PageHeader
          title="Start Housing Application"
          subtitle="Step 1: attach required documents for administrator review."
        />
        <Card>
          <p className="text-sm text-slate-500">Preparing your application…</p>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Start Housing Application"
        subtitle="Step 1: attach every mandatory document as a PDF. Your attachments are saved automatically if you leave and come back later."
        actions={
          formUnlocked && application ? (
            <Link
              to={`/client/applications/form?id=${application.id}`}
              className="inline-flex rounded-xl bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-800"
            >
              Continue to application form
            </Link>
          ) : (
            <Link to="/client/documents" className="text-sm font-semibold text-navy-700 hover:text-accent">
              View document checklist
            </Link>
          )
        }
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-navy-900">Attachment progress</p>
            <p className="text-sm text-slate-500">
              {progress.mandatoryAttached} of {progress.mandatoryTotal} mandatory documents attached · PDF files only
            </p>
          </div>
          <Badge status={progress.complete ? 'Uploaded' : 'Pending'} />
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{
              width: `${progress.mandatoryTotal ? (progress.mandatoryAttached / progress.mandatoryTotal) * 100 : 0}%`,
            }}
          />
        </div>
      </Card>

      {application && (
        <div className="mb-4">
          <Alert tone={needsCorrections ? 'error' : 'info'}>
            Application <strong>{application.referenceNumber}</strong> — status: <Badge status={application.status} />
            {reviewing && ' Waiting for administrator verification.'}
            {needsCorrections &&
              ' Some documents were declined. Replace the declined PDF(s) below, then submit again for review.'}
            {formUnlocked && ' Documents verified. You may complete the application form.'}
          </Alert>
        </div>
      )}

      {declinedDocs.length > 0 && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 dark:border-red-800 dark:bg-red-950/40">
          <div className="flex items-start gap-3">
            <FontAwesomeIcon icon={faTriangleExclamation} className="mt-1 text-red-600" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-red-800 dark:text-red-200">
                {declinedDocs.length} document{declinedDocs.length === 1 ? '' : 's'} declined — please replace
              </p>
              <ul className="mt-2 space-y-2">
                {declinedDocs.map(({ doc, title }) => (
                  <li key={doc.id} className="rounded-xl border border-red-200/80 bg-white/70 px-3 py-2 dark:bg-red-950/30">
                    <p className="font-medium text-navy-900">{title}</p>
                    <p className="mt-0.5 text-sm text-red-700 dark:text-red-200">
                      Reason: {doc.reviewNote?.trim() || 'No reason provided.'}
                    </p>
                  </li>
                ))}
              </ul>
              {needsCorrections && (
                <p className="mt-2 text-xs text-red-700/90">
                  Declined documents are listed first below. Use <strong>Replace declined PDF</strong>, then submit for
                  review again.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {message && (
        <div className="mb-4">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}

      <div ref={listTopRef} />

      {sortedCategories.length === 0 ? (
        <EmptyState title="No document requirements" description="Ask an administrator to enable document categories." />
      ) : (
        <div className="space-y-4">
          {pageCategories.map((cat, index) => {
            const doc = docs.find((d) => d.categoryId === cat.id)
            const mandatory = cat.mandatory || !cat.optional
            const description = (cat.description || '').trim()
            const absoluteIndex = (page - 1) * PAGE_SIZE + index + 1
            const isVerified = doc?.status === 'Verified'
            const isDeclined = Boolean(doc && ['Rejected', 'Resubmission Required'].includes(doc.status))
            const allowReplace = canReplaceDoc(doc)
            return (
              <Card
                key={cat.id}
                className={
                  isDeclined
                    ? 'border-red-300 bg-red-50/70 dark:border-red-700 dark:bg-red-950/30'
                    : isVerified
                      ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-700 dark:bg-emerald-950/30'
                      : undefined
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        isVerified
                          ? 'bg-emerald-600 text-white'
                          : isDeclined
                            ? 'bg-red-600 text-white'
                            : doc
                              ? 'bg-sky-100 text-sky-700'
                              : 'bg-slate-100 text-slate-400'
                      }`}
                      aria-hidden
                    >
                      {isVerified ? (
                        <FontAwesomeIcon icon={faCheckCircle} />
                      ) : isDeclined ? (
                        <FontAwesomeIcon icon={faTriangleExclamation} />
                      ) : (
                        <span className="text-xs font-bold">{absoluteIndex}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Document {absoluteIndex} of {sortedCategories.length}
                      {isVerified ? ' · Verified' : ''}
                      {isDeclined ? ' · Declined — replace required' : ''}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-navy-900">{cat.title}</h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          mandatory ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {mandatory ? 'Mandatory' : 'Optional'}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          cat.certificationRequired
                            ? 'bg-amber-50 text-amber-800'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {cat.certificationRequired ? 'Must be certified' : 'Certification not required'}
                      </span>
                      {doc ? <Badge status={doc.status} /> : <Badge status="Pending" />}
                      {isVerified && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                          <FontAwesomeIcon icon={faCheckCircle} />
                          Verified
                        </span>
                      )}
                      {isDeclined && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                          <FontAwesomeIcon icon={faTriangleExclamation} />
                          Declined
                        </span>
                      )}
                    </div>
                    {description ? (
                      <p className="mt-2 text-sm leading-relaxed text-navy-800">{description}</p>
                    ) : (
                      <p className="mt-2 text-sm italic text-slate-400">No description provided for this requirement.</p>
                    )}
                    {doc ? (
                      <p className="mt-2 text-xs text-slate-500">
                        Attached: {doc.fileName} · {formatFileSize(doc.fileSize)} · {formatDate(doc.uploadedAt)}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-amber-700">No file attached yet.</p>
                    )}
                    {isDeclined && (
                      <div className="mt-2 rounded-xl border border-red-200 bg-white/80 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-100">
                        <p className="font-semibold">Why it was declined</p>
                        <p className="mt-0.5">{doc?.reviewNote?.trim() || 'No reason provided.'}</p>
                      </div>
                    )}
                    {!isDeclined && doc?.reviewNote && (
                      <p className="mt-1 text-xs text-amber-700">Note: {doc.reviewNote}</p>
                    )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {allowReplace && (
                      <>
                        <input
                          ref={(el) => {
                            fileInputs.current[cat.id] = el
                          }}
                          type="file"
                          accept=".pdf,application/pdf"
                          className="hidden"
                          onChange={(e) => {
                            onAttach(cat.id, e.target.files?.[0] || null)
                            e.target.value = ''
                          }}
                        />
                        <div className="flex flex-col items-stretch gap-1 sm:items-end">
                          <Button
                            type="button"
                            variant={isDeclined ? 'accent' : 'primary'}
                            disabled={attachingId === cat.id}
                            onClick={() => fileInputs.current[cat.id]?.click()}
                          >
                            <FontAwesomeIcon icon={faPaperclip} />
                            {attachingId === cat.id
                              ? 'Attaching…'
                              : isDeclined
                                ? 'Replace declined PDF'
                                : doc
                                  ? 'Replace PDF'
                                  : 'Attach PDF'}
                          </Button>
                          <p className="text-[11px] font-medium text-amber-700">PDF only</p>
                        </div>
                      </>
                    )}
                    {isVerified && needsCorrections && (
                      <p className="self-center text-xs font-medium text-emerald-700">Locked — verified</p>
                    )}
                    {doc?.previewUrl && (
                      <Button variant="secondary" onClick={() => setPreview(doc)}>
                        <FontAwesomeIcon icon={faEye} /> Preview
                      </Button>
                    )}
                    {allowReplace && doc && (
                      <Button variant="ghost" onClick={() => onRemove(doc.id)}>
                        <FontAwesomeIcon icon={faTrash} /> Remove
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
            <p className="text-sm text-slate-600">
              Showing <strong>{rangeStart}–{rangeEnd}</strong> of <strong>{sortedCategories.length}</strong>
              <span className="text-slate-400"> · Page {page} of {totalPages}</span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
                <FontAwesomeIcon icon={faChevronLeft} />
                Previous
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => goToPage(pageNumber)}
                  className={`flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-semibold transition ${
                    pageNumber === page
                      ? 'bg-navy-900 text-white'
                      : 'bg-slate-100 text-navy-800 hover:bg-slate-200'
                  }`}
                  aria-label={`Go to page ${pageNumber}`}
                  aria-current={pageNumber === page ? 'page' : undefined}
                >
                  {pageNumber}
                </button>
              ))}
              <Button variant="secondary" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>
                Next
                <FontAwesomeIcon icon={faChevronRight} />
              </Button>
            </div>
          </div>

          {canEditUploads && application && (
            <Card>
              <p className="mb-3 text-sm text-slate-600">
                {needsCorrections
                  ? `Replace every declined document, then submit again. Verified documents stay locked. Ready: ${progress.mandatoryAttached}/${progress.mandatoryTotal} mandatory files.`
                  : `Documents cannot be sent for review until every mandatory file is attached (${progress.mandatoryAttached}/${progress.mandatoryTotal}). Attachments are saved as you go.`}
              </p>
              <Button onClick={onSubmitForReview} disabled={!progress.complete || declinedDocs.length > 0}>
                {needsCorrections ? 'Resubmit documents for review' : 'Submit documents for review'}
              </Button>
              {declinedDocs.length > 0 && (
                <p className="mt-2 text-xs text-red-700">
                  Replace all declined documents before you can resubmit.
                </p>
              )}
              {!progress.complete && declinedDocs.length === 0 && (
                <p className="mt-2 text-xs text-amber-700">
                  Attach the remaining mandatory documents to enable submission.
                </p>
              )}
            </Card>
          )}
        </div>
      )}

      {preview?.previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold">{preview.fileName}</p>
              <Button variant="secondary" onClick={() => setPreview(null)}>
                Close
              </Button>
            </div>
            {preview.fileType.startsWith('image/') ? (
              <img src={preview.previewUrl} alt={preview.fileName} className="max-h-[70vh] w-full object-contain" />
            ) : (
              <iframe title={preview.fileName} src={preview.previewUrl} className="h-[70vh] w-full rounded-xl border" />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
