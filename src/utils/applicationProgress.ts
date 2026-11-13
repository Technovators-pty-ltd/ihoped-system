import type { HousingApplication } from '../types'
import { formatDateTime } from './format'

export const APPLICATION_STATUS_FLOW = [
  'Application Started',
  'Documents Uploaded',
  'Documents Verified',
  'Application Form Completed',
  'Under Review',
  'Application completed',
] as const

export function buildApplicationStatusSteps(
  app: HousingApplication | undefined,
  options?: { documentsFullyVerified?: boolean },
) {
  const status = app?.status
  const documentsFullyVerified = Boolean(options?.documentsFullyVerified)

  const started = Boolean(app)
  // Uploaded & sent for review (or further) — keeps the tick even while waiting for verification
  const docsUploaded = [
    'Documents Under Review',
    'In Progress',
    'Submitted',
    'Under Review',
    'Approved',
    'Rejected',
  ].includes(status || '')
  // Tick from real verified files OR once the application has moved past document review
  const docsVerified =
    documentsFullyVerified ||
    ['In Progress', 'Submitted', 'Under Review', 'Approved', 'Rejected'].includes(status || '')
  const formDone = ['Submitted', 'Under Review', 'Approved', 'Rejected'].includes(status || '')
  const reviewed = ['Under Review', 'Approved', 'Rejected'].includes(status || '')
  const decided = ['Approved', 'Rejected'].includes(status || '')

  return [
    {
      label: APPLICATION_STATUS_FLOW[0],
      done: started,
      current: false,
      date: app ? formatDateTime(app.createdAt) : undefined,
    },
    {
      label: APPLICATION_STATUS_FLOW[1],
      // Tick once documents were submitted for review
      done: docsUploaded,
      current: status === 'Awaiting Documents' || status === 'Documents Required',
    },
    {
      label: APPLICATION_STATUS_FLOW[2],
      done: docsVerified,
      // Waiting for admin only while review is open and docs are not fully verified yet
      current: status === 'Documents Under Review' && !docsVerified,
    },
    {
      label: APPLICATION_STATUS_FLOW[3],
      done: formDone,
      current: status === 'In Progress' || (docsVerified && status === 'Documents Under Review'),
      date: formatDateTime(app?.submittedAt),
    },
    {
      label: APPLICATION_STATUS_FLOW[4],
      done: reviewed,
      current: status === 'Submitted' || status === 'Under Review',
    },
    {
      label: APPLICATION_STATUS_FLOW[5],
      done: decided,
      current: decided,
      date: decided ? formatDateTime(app?.updatedAt) : undefined,
    },
  ]
}
