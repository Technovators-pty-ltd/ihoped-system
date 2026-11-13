export type UserRole = 'client' | 'admin'

export type ApplicationStatus =
  | 'Not Started'
  | 'Awaiting Documents'
  | 'Documents Under Review'
  | 'Documents Required'
  | 'In Progress'
  | 'Submitted'
  | 'Under Review'
  | 'Approved'
  | 'Rejected'

export type DocumentStatus =
  | 'Pending'
  | 'Uploaded'
  | 'Verified'
  | 'Rejected'
  | 'Resubmission Required'

export type EmploymentStatus =
  | 'Permanently Employed'
  | 'Temporarily Employed'
  | 'Self-Employed'
  | 'Unemployed'
  | 'Commission-Based Income'

export type MaritalStatus = 'Single' | 'Married' | 'Divorced' | 'Widowed'

export interface ClientProfile {
  id: string
  accountId: string
  username: string
  firstName: string
  surname: string
  email: string
  idNumber: string
  passwordHash: string
  phone?: string
  address?: string
  province?: string
  municipality?: string
  maritalStatus?: MaritalStatus
  employmentStatus?: EmploymentStatus
  active: boolean
  registeredAt: string
  notificationPrefs: {
    email: boolean
    inApp: boolean
  }
}

export interface AdminProfile {
  id: string
  username: string
  fullName: string
  email: string
  passwordHash: string
  mustChangePassword: boolean
  active: boolean
  createdAt: string
}

export interface SessionUser {
  id: string
  role: UserRole
  name: string
  email?: string
  username?: string
  mustChangePassword?: boolean
}

export interface HousingApplication {
  id: string
  referenceNumber: string
  clientId: string
  preferredProvince: string
  preferredMunicipality: string
  currentHousingSituation: string
  reason: string
  status: ApplicationStatus
  assignedAdminId?: string
  submittedAt?: string
  createdAt: string
  updatedAt: string
  consentAccepted: boolean
  internalNotes: InternalNote[]
  rejectionReason?: string
}

export interface InternalNote {
  id: string
  adminId: string
  adminName: string
  note: string
  createdAt: string
}

export interface StatusHistoryEntry {
  id: string
  applicationId: string
  status: ApplicationStatus
  note?: string
  changedBy: string
  changedByRole: UserRole
  createdAt: string
}

export interface DocumentCategory {
  id: string
  title: string
  description: string
  mandatory: boolean
  optional: boolean
  enabled: boolean
  certificationRequired: boolean
  condition?: {
    field: 'maritalStatus' | 'employmentStatus' | 'hasDependents'
    values: string[]
  }
}

export interface UploadedDocument {
  id: string
  clientId: string
  applicationId?: string
  categoryId: string
  fileName: string
  fileType: string
  fileSize: number
  previewUrl?: string
  status: DocumentStatus
  uploadedAt: string
  reviewNote?: string
}

export interface AppNotification {
  id: string
  userId: string
  userRole: UserRole
  title: string
  message: string
  read: boolean
  createdAt: string
  type: 'info' | 'success' | 'warning' | 'error'
}

export interface AuditLog {
  id: string
  actorId: string
  actorName: string
  actorRole: UserRole
  action: string
  details: string
  createdAt: string
}

export interface PasswordResetToken {
  email: string
  token: string
  expiresAt: string
}

export interface SystemSettings {
  allowRegistration: boolean
  emailNotifications: boolean
  maxUploadMb: number
  maintenanceMode: boolean
  privacyNotice: string
}

export interface AppStore {
  clients: ClientProfile[]
  admins: AdminProfile[]
  applications: HousingApplication[]
  statusHistory: StatusHistoryEntry[]
  documentCategories: DocumentCategory[]
  documents: UploadedDocument[]
  notifications: AppNotification[]
  auditLogs: AuditLog[]
  resetTokens: PasswordResetToken[]
  settings: SystemSettings
  loginAttempts: Record<string, { count: number; lockedUntil?: string }>
}
