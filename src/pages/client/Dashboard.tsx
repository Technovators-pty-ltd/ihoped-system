import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCheckCircle,
  faFolderOpen,
  faPaperPlane,
  faSpinner,
  faTimesCircle,
} from '@fortawesome/free-solid-svg-icons'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Card, PageHeader, StatCard } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { getApplicationsForClient } from '../../services/applicationService'
import {
  areAllUploadedDocumentsVerified,
  getClientDocuments,
  getRequiredDocumentsForClient,
  refreshDocumentData,
} from '../../services/documentService'
import { getNotificationsFor } from '../../services/notificationService'
import type { AppNotification, HousingApplication } from '../../types'
import { buildApplicationStatusSteps } from '../../utils/applicationProgress'
import { formatDateTime } from '../../utils/format'

export default function ClientDashboard() {
  const { user } = useAuth()
  const [apps, setApps] = useState<HousingApplication[]>([])
  const [notifs, setNotifs] = useState<AppNotification[]>([])
  const [outstanding, setOutstanding] = useState(0)
  const [documentsFullyVerified, setDocumentsFullyVerified] = useState(false)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      await refreshDocumentData(user.id)
      setDocumentsFullyVerified(areAllUploadedDocumentsVerified(user.id))
      const applications = await getApplicationsForClient(user.id)
      setApps(applications)
      setNotifs((await getNotificationsFor(user.id)).slice(0, 5))
      const required = getRequiredDocumentsForClient(user.id)
      const docs = await getClientDocuments(user.id)
      const missing = required.filter((r) => {
        const d = docs.find((x) => x.categoryId === r.id)
        return !d || !['Uploaded', 'Verified'].includes(d.status)
      }).length
      setOutstanding(missing)
    })()
  }, [user])

  const count = (status: string) => apps.filter((a) => a.status === status).length
  const approved = count('Approved')
  const declined = count('Rejected')
  const latestApp = apps[0]
  const statusSteps = useMemo(
    () => buildApplicationStatusSteps(latestApp, { documentsFullyVerified }),
    [latestApp, documentsFullyVerified],
  )

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user?.name}`}
        subtitle="Track your housing applications and outstanding documents."
        actions={
          <Link
            to="/client/applications/new"
            className="inline-flex items-center rounded-xl bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-800"
          >
            Start New Application
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Submitted Applications"
          value={count('Submitted')}
          icon={<FontAwesomeIcon icon={faPaperPlane} />}
          tone="teal"
        />
        <StatCard
          label="Form In Progress"
          value={count('In Progress')}
          icon={<FontAwesomeIcon icon={faSpinner} />}
          tone="slate"
        />

        {/* Decision card: green for approved, red for declined — inside the card only */}
        <div className="slide-up rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Application decisions</p>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 dark:border-emerald-700 dark:bg-emerald-950">
              <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-100">
                <FontAwesomeIcon icon={faCheckCircle} className="text-sm" />
                <span className="text-[11px] font-semibold uppercase tracking-wide">Approved</span>
              </div>
              <p className="mt-1.5 text-2xl font-bold text-emerald-800 dark:text-white">{approved}</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 dark:border-red-700 dark:bg-red-950">
              <div className="flex items-center gap-1.5 text-red-700 dark:text-red-100">
                <FontAwesomeIcon icon={faTimesCircle} className="text-sm" />
                <span className="text-[11px] font-semibold uppercase tracking-wide">Declined</span>
              </div>
              <p className="mt-1.5 text-2xl font-bold text-red-800 dark:text-white">{declined}</p>
            </div>
          </div>
        </div>

        <StatCard
          label="Outstanding Documents"
          value={outstanding}
          icon={<FontAwesomeIcon icon={faFolderOpen} />}
          tone="red"
        />
      </div>

      <div className="mt-6">
        <Card
          title="Application status"
          actions={
            latestApp ? (
              <Link to={`/client/status?id=${latestApp.id}`} className="text-sm font-medium text-accent">
                View full progress
              </Link>
            ) : undefined
          }
        >
          {!latestApp ? (
            <p className="text-sm text-slate-500">No applications yet. Start one to track status here.</p>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-900/40">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reference</p>
                  <p className="mt-0.5 font-semibold text-navy-900">{latestApp.referenceNumber}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge status={latestApp.status} />
                  <span className="text-xs text-slate-500">Updated {formatDateTime(latestApp.updatedAt)}</span>
                </div>
              </div>

              {/* Horizontal step layout (different from Status page vertical timeline) */}
              <div className="overflow-x-auto pb-1">
                <ol className="flex min-w-[640px] items-start gap-0">
                  {statusSteps.map((step, idx) => {
                    const complete = Boolean(step.done)
                    const prevDone = Boolean(statusSteps[idx - 1]?.done)
                    return (
                      <li key={step.label} className="flex flex-1 items-start">
                        <div className="flex w-full flex-col items-center text-center">
                          <div className="flex w-full items-center">
                            <div
                              className={`h-0.5 flex-1 ${idx === 0 ? 'bg-transparent' : prevDone ? 'bg-emerald-500' : 'bg-slate-200'}`}
                            />
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                step.current && !complete
                                  ? 'bg-accent text-navy-950 ring-4 ring-accent/25'
                                  : step.current && complete
                                    ? 'bg-emerald-600 text-white ring-4 ring-accent/30'
                                    : complete
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-slate-200 text-slate-500'
                              }`}
                            >
                              {complete ? (
                                <FontAwesomeIcon icon={faCheckCircle} className="text-sm" />
                              ) : (
                                idx + 1
                              )}
                            </div>
                            <div
                              className={`h-0.5 flex-1 ${idx === statusSteps.length - 1 ? 'bg-transparent' : step.done ? 'bg-emerald-500' : 'bg-slate-200'}`}
                            />
                          </div>
                          <p
                            className={`mt-2 max-w-[7.5rem] text-[11px] font-medium leading-snug ${
                              step.current && !complete
                                ? 'text-accent'
                                : complete
                                  ? 'text-emerald-700'
                                  : 'text-slate-500'
                            }`}
                          >
                            {step.label}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Recent application activity">
          {apps.length === 0 ? (
            <p className="text-sm text-slate-500">No applications yet.</p>
          ) : (
            <ul className="space-y-3">
              {apps.slice(0, 5).map((app) => (
                <li key={app.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3">
                  <div>
                    <p className="font-medium text-navy-900">{app.referenceNumber}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(app.updatedAt)}</p>
                  </div>
                  <Badge status={app.status === 'Rejected' ? 'Rejected' : app.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card
          title="Recent notifications"
          actions={
            <Link to="/client/notifications" className="text-sm font-medium text-accent">
              View all
            </Link>
          }
        >
          {notifs.length === 0 ? (
            <p className="text-sm text-slate-500">No notifications.</p>
          ) : (
            <ul className="space-y-3">
              {notifs.map((n) => (
                <li key={n.id} className="rounded-xl border border-slate-100 px-3 py-3">
                  <p className="font-medium text-navy-900">{n.title}</p>
                  <p className="text-sm text-slate-500">{n.message}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
