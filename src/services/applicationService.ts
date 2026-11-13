import type { ApplicationStatus, HousingApplication, StatusHistoryEntry } from '../types'
import { api } from './api'

export function canFillApplicationForm(status: ApplicationStatus): boolean {
  return status === 'In Progress'
}

export function isDocumentPhase(status: ApplicationStatus): boolean {
  return ['Awaiting Documents', 'Documents Under Review', 'Documents Required'].includes(status)
}

export async function getApplicationsForClient(_clientId?: string): Promise<HousingApplication[]> {
  const data = await api<{ applications: HousingApplication[] }>('/applications')
  return data.applications
}

export async function getAllApplications(): Promise<HousingApplication[]> {
  const data = await api<{ applications: HousingApplication[] }>('/applications')
  return data.applications
}

export async function getApplication(id: string): Promise<HousingApplication | undefined> {
  try {
    const data = await api<{ application: HousingApplication }>(`/applications/${id}`)
    return data.application
  } catch {
    return undefined
  }
}

export async function startOrContinueApplication(
  _clientId: string,
): Promise<{ application: HousingApplication; next: 'documents' | 'form' }> {
  return api('/applications/start', { method: 'POST' })
}

export async function submitDocumentsForReview(
  _clientId: string,
  applicationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await api(`/applications/${applicationId}/submit-documents`, { method: 'POST' })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Submit failed.' }
  }
}

export async function saveApplicationProgress(
  _clientId: string,
  data: {
    id: string
    preferredProvince: string
    preferredMunicipality: string
    currentHousingSituation: string
    reason: string
    consentAccepted: boolean
  },
): Promise<{ ok: true; application: HousingApplication } | { ok: false; error: string }> {
  try {
    const res = await api<{ ok: true; application: HousingApplication }>(`/applications/${data.id}/progress`, {
      method: 'PUT',
      json: data,
    })
    return res
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Save failed.' }
  }
}

export async function saveApplicationDraft(
  clientId: string,
  data: {
    id?: string
    preferredProvince: string
    preferredMunicipality: string
    currentHousingSituation: string
    reason: string
    consentAccepted: boolean
  },
): Promise<{ ok: true; application: HousingApplication } | { ok: false; error: string }> {
  if (!data.id) {
    return { ok: false, error: 'Upload and get your documents verified before completing the application form.' }
  }
  return saveApplicationProgress(clientId, { ...data, id: data.id })
}

export async function submitApplication(
  _clientId: string,
  applicationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await api(`/applications/${applicationId}/submit`, { method: 'POST' })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Submit failed.' }
  }
}

export async function updateApplicationStatus(input: {
  applicationId: string
  status: ApplicationStatus
  adminId: string
  adminName: string
  note?: string
  rejectionReason?: string
}) {
  await api(`/applications/${input.applicationId}/status`, {
    method: 'PATCH',
    json: {
      status: input.status,
      note: input.note,
      rejectionReason: input.rejectionReason,
    },
  })
}

export async function assignApplication(applicationId: string, _adminId: string, _adminName: string) {
  await api(`/applications/${applicationId}/assign`, { method: 'POST' })
}

export async function addInternalNote(
  applicationId: string,
  _adminId: string,
  _adminName: string,
  note: string,
) {
  await api(`/applications/${applicationId}/notes`, { method: 'POST', json: { note } })
}

export async function getStatusHistory(applicationId: string): Promise<StatusHistoryEntry[]> {
  const data = await api<{ history: StatusHistoryEntry[] }>(`/applications/${applicationId}/history`)
  return data.history
}

/** Kept for compatibility — form unlock is handled by the API on document review. */
export function syncApplicationAfterDocumentReview(_clientId: string, _adminId: string, _adminName: string) {
  // no-op: server performs unlock during document review
}
