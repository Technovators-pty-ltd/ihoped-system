import type { AppStore, DocumentCategory } from '../types'
import { hashPassword } from '../utils/crypto'

/** Document requirements managed by administrators and shown to clients. */
export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  {
    id: 'doc_sa_id',
    title: 'Certified copy of South African ID',
    description: 'Recently certified copy of your South African ID document.',
    mandatory: true,
    optional: false,
    enabled: true,
    certificationRequired: true,
  },
  {
    id: 'doc_birth_cert',
    title: 'Certified birth certificate of dependent child',
    description: 'Recently certified birth certificate for each dependent child.',
    mandatory: true,
    optional: false,
    enabled: true,
    certificationRequired: true,
  },
  {
    id: 'doc_marriage',
    title: 'Marriage certificate',
    description: 'Required if you are married.',
    mandatory: true,
    optional: false,
    enabled: true,
    certificationRequired: true,
  },
  {
    id: 'doc_divorce',
    title: 'Divorce decree letter',
    description: 'Required if you are divorced.',
    mandatory: true,
    optional: false,
    enabled: true,
    certificationRequired: false,
  },
  {
    id: 'doc_affidavit',
    title: 'Affidavit (non-biological / different surname)',
    description: 'Required if the child is not biological or if the child and applicant have different surnames.',
    mandatory: false,
    optional: true,
    enabled: true,
    certificationRequired: false,
  },
  {
    id: 'doc_payslips',
    title: "Latest three months' payslips",
    description: 'Latest three months of payslips for employed applicants.',
    mandatory: true,
    optional: false,
    enabled: true,
    certificationRequired: false,
  },
  {
    id: 'doc_bank_3',
    title: "Latest three months' bank statements",
    description: 'Latest three months of bank statements for employed applicants.',
    mandatory: true,
    optional: false,
    enabled: true,
    certificationRequired: false,
  },
  {
    id: 'doc_bank_6',
    title: "Six months' bank statements",
    description: 'Six months of bank statements if self-employed.',
    mandatory: true,
    optional: false,
    enabled: true,
    certificationRequired: false,
  },
  {
    id: 'doc_bank_12',
    title: "Twelve months' bank statements",
    description: 'Twelve months of bank statements for applicants earning commission.',
    mandatory: true,
    optional: false,
    enabled: true,
    certificationRequired: false,
  },
]

export async function createInitialStore(): Promise<AppStore> {
  const adminHash = await hashPassword('T3ch')
  const clientHash = await hashPassword('Client@123')
  const now = new Date().toISOString()

  return {
    clients: [
      {
        id: 'client_demo_1',
        accountId: 'CLT-10000001',
        username: 'thandi',
        firstName: 'Thandi',
        surname: 'Ndlovu',
        email: 'thandi.ndlovu@example.com',
        idNumber: '8001015009087',
        passwordHash: clientHash,
        phone: '0821234567',
        address: '12 Hope Street',
        province: 'Gauteng',
        municipality: 'City of Johannesburg',
        maritalStatus: 'Married',
        employmentStatus: 'Permanently Employed',
        active: true,
        registeredAt: now,
        notificationPrefs: { email: true, inApp: true },
      },
    ],
    admins: [
      {
        id: 'admin_seed_1',
        username: 'Tech',
        fullName: 'System Administrator',
        email: 'admin@ihoped.org',
        passwordHash: adminHash,
        mustChangePassword: false,
        active: true,
        createdAt: now,
      },
    ],
    applications: [],
    statusHistory: [],
    documentCategories: DOCUMENT_CATEGORIES,
    documents: [],
    notifications: [
      {
        id: 'notif_1',
        userId: 'client_demo_1',
        userRole: 'client',
        title: 'Welcome to iHOPED',
        message: 'Your client account is ready. You can start a housing application anytime.',
        read: false,
        createdAt: now,
        type: 'success',
      },
    ],
    auditLogs: [
      {
        id: 'audit_1',
        actorId: 'system',
        actorName: 'System',
        actorRole: 'admin',
        action: 'SEED',
        details: 'Initial mock data seeded',
        createdAt: now,
      },
    ],
    resetTokens: [],
    settings: {
      allowRegistration: true,
      emailNotifications: true,
      maxUploadMb: 5,
      maintenanceMode: false,
      privacyNotice:
        'iHOPED processes personal information in line with POPIA. Data is used solely to assess housing assistance applications and will not be shared without lawful basis.',
    },
    loginAttempts: {},
  }
}
