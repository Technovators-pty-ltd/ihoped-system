import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCertificate, faCircleCheck, faFileLines, faShieldHalved } from '@fortawesome/free-solid-svg-icons'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, PageHeader } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { refreshDocumentData } from '../../services/documentService'
import type { DocumentCategory } from '../../types'

export default function ClientDocuments() {
  const { user } = useAuth()
  const [categories, setCategories] = useState<DocumentCategory[]>([])

  useEffect(() => {
    if (!user) return
    refreshDocumentData(user.id).then(({ categories: cats }) => setCategories(cats))
  }, [user])

  const { mandatory, optional, certifiedCount } = useMemo(() => {
    const mandatoryList = categories.filter((c) => c.mandatory || !c.optional)
    const optionalList = categories.filter((c) => !(c.mandatory || !c.optional))
    return {
      mandatory: mandatoryList,
      optional: optionalList,
      certifiedCount: categories.filter((c) => c.certificationRequired).length,
    }
  }, [categories])

  return (
    <div>
      <PageHeader
        title="Required Documents"
        subtitle="A clear checklist of what you will need. Attach files only when you start a housing application."
        actions={
          <Link
            to="/client/applications/new"
            className="inline-flex rounded-xl bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-800"
          >
            Start New Housing Application
          </Link>
        }
      />

      {categories.length === 0 ? (
        <EmptyState title="No document requirements" description="Ask an administrator to enable document categories." />
      ) : (
        <div className="space-y-8">
          <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 p-6 text-white shadow-sm md:p-8">
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 12% 20%, rgba(33, 126, 180, 0.35) 0%, transparent 34%), radial-gradient(circle at 88% 10%, rgba(244, 162, 31, 0.28) 0%, transparent 32%)',
              }}
            />
            <div className="relative grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-light">Document checklist</p>
                <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">Prepare before you apply</h2>
                <p className="mt-2 max-w-xl text-sm text-white/80">
                  Review each requirement below. Items marked for certification must be recently certified copies.
                  When you attach files later, upload PDF documents only.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-4 text-center backdrop-blur">
                  <p className="text-2xl font-bold text-white">{categories.length}</p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-white/75">Total</p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-4 text-center backdrop-blur">
                  <p className="text-2xl font-bold text-white">{mandatory.length}</p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-white/75">Mandatory</p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-4 text-center backdrop-blur">
                  <p className="text-2xl font-bold text-white">{certifiedCount}</p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-white/75">Certified</p>
                </div>
              </div>
            </div>
          </section>

          <DocumentSection
            title="Mandatory documents"
            hint="These must be attached before your application can be reviewed."
            icon={faShieldHalved}
            items={mandatory}
            startIndex={1}
          />

          {optional.length > 0 && (
            <DocumentSection
              title="Optional / conditional documents"
              hint="Provide these when they apply to your situation (for example marriage, divorce, or dependents)."
              icon={faFileLines}
              items={optional}
              startIndex={mandatory.length + 1}
            />
          )}

          <section className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-6 dark:border-slate-600">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-navy-900">Ready to attach files?</p>
                <p className="mt-1 text-sm text-slate-500">
                  Uploads happen in Start New Housing Application (PDF only) — this page is for reference only.
                </p>
              </div>
              <Link
                to="/client/applications/new"
                className="inline-flex rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-light"
              >
                Start application & attach
              </Link>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function DocumentSection({
  title,
  hint,
  icon,
  items,
  startIndex,
}: {
  title: string
  hint: string
  icon: typeof faShieldHalved
  items: DocumentCategory[]
  startIndex: number
}) {
  if (items.length === 0) return null

  return (
    <section>
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-900 text-white">
          <FontAwesomeIcon icon={icon} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-navy-900">{title}</h3>
          <p className="text-sm text-slate-500">{hint}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        <ol className="divide-y divide-slate-100">
          {items.map((cat, index) => {
            const description = (cat.description || '').trim()
            const number = String(startIndex + index).padStart(2, '0')
            return (
              <li
                key={cat.id}
                className="grid gap-4 px-5 py-5 transition hover:bg-slate-50/80 md:grid-cols-[4.5rem_1fr_auto] md:items-start"
              >
                <div className="font-mono text-2xl font-bold tracking-tight text-accent/80">{number}</div>
                <div className="min-w-0">
                  <h4 className="font-semibold text-navy-900">{cat.title}</h4>
                  {description ? (
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{description}</p>
                  ) : (
                    <p className="mt-1.5 text-sm italic text-slate-400">No description provided.</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  {cat.certificationRequired ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-900">
                      <FontAwesomeIcon icon={faCertificate} />
                      Must be certified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800">
                      <FontAwesomeIcon icon={faCircleCheck} />
                      Certification not required
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
