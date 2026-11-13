import { randomBytes } from 'crypto'
import { prisma } from './prisma.js'

export function generateReference() {
  const year = new Date().getFullYear()
  const rand = Math.floor(100000 + Math.random() * 900000)
  return `IHOPED-${year}-${rand}`
}

export function generateAccountId() {
  return `CLT-${Date.now().toString().slice(-8)}`
}

export function generateResetToken() {
  return randomBytes(24).toString('hex')
}

export function validateSouthAfricanId(id: string): { valid: boolean; message?: string } {
  const cleaned = id.replace(/\s/g, '')
  if (!/^\d{13}$/.test(cleaned)) {
    return { valid: false, message: 'ID number must be exactly 13 digits.' }
  }
  return { valid: true }
}

export async function addAuditLog(
  actorId: string,
  actorName: string,
  actorRole: string,
  action: string,
  details: string,
) {
  await prisma.auditLog.create({
    data: { actorId, actorName, actorRole, action, details },
  })
}

export async function notifyUser(
  userId: string,
  userRole: string,
  title: string,
  message: string,
  type: string = 'info',
) {
  await prisma.notification.create({
    data: { userId, userRole, title, message, type },
  })
}

export function mapClient(client: {
  id: string
  accountId: string
  username: string
  firstName: string
  surname: string
  email: string
  idNumber: string
  phone: string | null
  address: string | null
  province: string | null
  municipality: string | null
  maritalStatus: string | null
  employmentStatus: string | null
  active: boolean
  notifyEmail: boolean
  notifyInApp: boolean
  registeredAt: Date
}) {
  return {
    id: client.id,
    accountId: client.accountId,
    username: client.username,
    firstName: client.firstName,
    surname: client.surname,
    email: client.email,
    idNumber: client.idNumber,
    phone: client.phone || undefined,
    address: client.address || undefined,
    province: client.province || undefined,
    municipality: client.municipality || undefined,
    maritalStatus: client.maritalStatus || undefined,
    employmentStatus: client.employmentStatus || undefined,
    active: client.active,
    registeredAt: client.registeredAt.toISOString(),
    notificationPrefs: {
      email: client.notifyEmail,
      inApp: client.notifyInApp,
    },
  }
}

export function mapApplication(app: {
  id: string
  referenceNumber: string
  clientId: string
  preferredProvince: string
  preferredMunicipality: string
  currentHousingSituation: string
  reason: string
  status: string
  assignedAdminId: string | null
  submittedAt: Date | null
  createdAt: Date
  updatedAt: Date
  consentAccepted: boolean
  rejectionReason: string | null
  internalNotesJson: string
}) {
  let internalNotes: unknown[] = []
  try {
    internalNotes = JSON.parse(app.internalNotesJson || '[]')
  } catch {
    internalNotes = []
  }
  return {
    id: app.id,
    referenceNumber: app.referenceNumber,
    clientId: app.clientId,
    preferredProvince: app.preferredProvince,
    preferredMunicipality: app.preferredMunicipality,
    currentHousingSituation: app.currentHousingSituation,
    reason: app.reason,
    status: app.status,
    assignedAdminId: app.assignedAdminId || undefined,
    submittedAt: app.submittedAt?.toISOString(),
    createdAt: app.createdAt.toISOString(),
    updatedAt: app.updatedAt.toISOString(),
    consentAccepted: app.consentAccepted,
    rejectionReason: app.rejectionReason || undefined,
    internalNotes,
  }
}

export function mapDocument(doc: {
  id: string
  clientId: string
  applicationId: string | null
  categoryId: string
  fileName: string
  fileType: string
  fileSize: number
  storagePath: string
  status: string
  uploadedAt: Date
  reviewNote: string | null
}, baseUrl: string) {
  return {
    id: doc.id,
    clientId: doc.clientId,
    applicationId: doc.applicationId || undefined,
    categoryId: doc.categoryId,
    fileName: doc.fileName,
    fileType: doc.fileType,
    fileSize: doc.fileSize,
    previewUrl: `${baseUrl}/uploads/${doc.storagePath}`,
    status: doc.status,
    uploadedAt: doc.uploadedAt.toISOString(),
    reviewNote: doc.reviewNote || undefined,
  }
}

export function mapCategory(cat: {
  id: string
  title: string
  description: string
  mandatory: boolean
  optional: boolean
  enabled: boolean
  certificationRequired: boolean
  conditionJson: string | null
}) {
  let condition: unknown
  if (cat.conditionJson) {
    try {
      condition = JSON.parse(cat.conditionJson)
    } catch {
      condition = undefined
    }
  }
  return {
    id: cat.id,
    title: cat.title,
    description: cat.description,
    mandatory: cat.mandatory,
    optional: cat.optional,
    enabled: cat.enabled,
    certificationRequired: cat.certificationRequired,
    condition,
  }
}
