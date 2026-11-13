import type { DocumentCategory, DocumentStatus, UploadedDocument } from '../types'
import { api } from './api'

let categoryCache: DocumentCategory[] = []
let documentCache: UploadedDocument[] = []

export async function refreshDocumentData(clientId?: string) {
  const [cats, docs] = await Promise.all([
    api<{ categories: DocumentCategory[] }>('/documents/categories'),
    api<{ documents: UploadedDocument[] }>('/documents'),
  ])
  categoryCache = cats.categories.filter((c) => c.enabled)
  documentCache = clientId ? docs.documents.filter((d) => d.clientId === clientId) : docs.documents
  return { categories: categoryCache, documents: docs.documents }
}

export function getRequiredDocumentsForClient(_clientId?: string): DocumentCategory[] {
  return categoryCache
}

export function getMandatoryCategoriesForClient(_clientId?: string): DocumentCategory[] {
  return categoryCache.filter((c) => c.mandatory || !c.optional)
}

export function hasAllMandatoryDocumentsUploaded(_clientId?: string): boolean {
  const mandatory = getMandatoryCategoriesForClient()
  return mandatory.every((c) => {
    const doc = documentCache.find((d) => d.categoryId === c.id)
    return doc && ['Uploaded', 'Verified'].includes(doc.status)
  })
}

export function areAllMandatoryDocumentsVerified(_clientId?: string): boolean {
  const mandatory = getMandatoryCategoriesForClient()
  return mandatory.every((c) => documentCache.find((d) => d.categoryId === c.id)?.status === 'Verified')
}

/** True when the client has uploads and every uploaded file is Verified (none pending/declined). */
export function areAllUploadedDocumentsVerified(_clientId?: string): boolean {
  if (documentCache.length === 0) return false
  return documentCache.every((d) => d.status === 'Verified')
}

export function hasMandatoryDocumentRejections(_clientId?: string): boolean {
  const mandatory = getMandatoryCategoriesForClient()
  return mandatory.some((c) => {
    const doc = documentCache.find((d) => d.categoryId === c.id)
    return doc && ['Rejected', 'Resubmission Required'].includes(doc.status)
  })
}

export function getDocumentUploadProgress(_clientId?: string) {
  const mandatory = getMandatoryCategoriesForClient()
  const mandatoryAttached = mandatory.filter((c) => {
    const doc = documentCache.find((d) => d.categoryId === c.id)
    return doc && ['Uploaded', 'Verified'].includes(doc.status)
  }).length
  return {
    mandatoryTotal: mandatory.length,
    mandatoryAttached,
    complete: mandatory.length > 0 && mandatoryAttached === mandatory.length,
  }
}

export async function getClientDocuments(clientId: string): Promise<UploadedDocument[]> {
  await refreshDocumentData(clientId)
  return documentCache
}

export async function getAllDocuments(): Promise<UploadedDocument[]> {
  const data = await api<{ documents: UploadedDocument[] }>('/documents')
  documentCache = data.documents
  return data.documents
}

export async function getDocumentCategories(): Promise<DocumentCategory[]> {
  const data = await api<{ categories: DocumentCategory[] }>('/documents/categories')
  categoryCache = data.categories
  return data.categories
}

export async function uploadDocument(input: {
  clientId: string
  categoryId: string
  file: File
  applicationId?: string
}): Promise<{ ok: true; document: UploadedDocument } | { ok: false; error: string }> {
  try {
    const formData = new FormData()
    formData.append('file', input.file)
    formData.append('categoryId', input.categoryId)
    if (input.applicationId) formData.append('applicationId', input.applicationId)
    const data = await api<{ ok: true; document: UploadedDocument }>('/documents/upload', {
      method: 'POST',
      formData,
    })
    await refreshDocumentData(input.clientId)
    return data
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Upload failed.' }
  }
}

export async function removeDocument(
  clientId: string,
  documentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await api(`/documents/${documentId}`, { method: 'DELETE' })
    await refreshDocumentData(clientId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Remove failed.' }
  }
}

export async function reviewDocument(input: {
  documentId: string
  status: DocumentStatus
  note?: string
  adminId: string
  adminName: string
}): Promise<string> {
  const data = await api<{ ok: true; document: UploadedDocument }>(`/documents/${input.documentId}/review`, {
    method: 'POST',
    json: { status: input.status, note: input.note },
  })
  return data.document.clientId
}

export async function updateDocumentCategories(
  categories: DocumentCategory[],
  _adminId: string,
  _adminName: string,
) {
  await api('/documents/categories', { method: 'PUT', json: { categories } })
  categoryCache = categories
}
