import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const DOCUMENT_CATEGORIES = [
  {
    id: 'doc_sa_id',
    title: 'Certified copy of South African ID',
    description: 'Recently certified copy of your South African ID document.',
    mandatory: true,
    optional: false,
    certificationRequired: true,
  },
  {
    id: 'doc_birth_cert',
    title: 'Certified birth certificate of dependent child',
    description: 'Recently certified birth certificate for each dependent child.',
    mandatory: true,
    optional: false,
    certificationRequired: true,
  },
  {
    id: 'doc_marriage',
    title: 'Marriage certificate',
    description: 'Required if you are married.',
    mandatory: true,
    optional: false,
    certificationRequired: true,
  },
  {
    id: 'doc_divorce',
    title: 'Divorce decree letter',
    description: 'Required if you are divorced.',
    mandatory: true,
    optional: false,
    certificationRequired: false,
  },
  {
    id: 'doc_affidavit',
    title: 'Affidavit (non-biological / different surname)',
    description: 'Required if the child is not biological or surnames differ.',
    mandatory: false,
    optional: true,
    certificationRequired: false,
  },
  {
    id: 'doc_payslips',
    title: "Latest three months' payslips",
    description: 'Latest three months of payslips for employed applicants.',
    mandatory: true,
    optional: false,
    certificationRequired: false,
  },
  {
    id: 'doc_bank_3',
    title: "Latest three months' bank statements",
    description: 'Latest three months of bank statements for employed applicants.',
    mandatory: true,
    optional: false,
    certificationRequired: false,
  },
  {
    id: 'doc_bank_6',
    title: "Six months' bank statements",
    description: 'Six months of bank statements if self-employed.',
    mandatory: true,
    optional: false,
    certificationRequired: false,
  },
  {
    id: 'doc_bank_12',
    title: "Twelve months' bank statements",
    description: 'Twelve months of bank statements for applicants earning commission.',
    mandatory: true,
    optional: false,
    certificationRequired: false,
  },
]

async function main() {
  await prisma.systemSetting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      allowRegistration: true,
      emailNotifications: true,
      maxUploadMb: 5,
      maintenanceMode: false,
      privacyNotice:
        'iHOPED processes personal information in line with POPIA. Data is used solely to assess housing assistance applications and will not be shared without lawful basis.',
    },
  })

  for (const cat of DOCUMENT_CATEGORIES) {
    await prisma.documentCategory.upsert({
      where: { id: cat.id },
      update: {
        title: cat.title,
        description: cat.description,
        mandatory: cat.mandatory,
        optional: cat.optional,
        enabled: true,
        certificationRequired: cat.certificationRequired,
      },
      create: {
        ...cat,
        enabled: true,
      },
    })
  }

  const adminHash = await bcrypt.hash('T3ch', 12)
  await prisma.admin.upsert({
    where: { username: 'Tech' },
    update: { passwordHash: adminHash, mustChangePassword: false, active: true },
    create: {
      username: 'Tech',
      fullName: 'System Administrator',
      email: 'admin@ihoped.org',
      passwordHash: adminHash,
      mustChangePassword: false,
      active: true,
    },
  })

  const clientHash = await bcrypt.hash('Client@123', 12)
  await prisma.client.upsert({
    where: { email: 'thandi.ndlovu@example.com' },
    update: { username: 'thandi', passwordHash: clientHash, active: true },
    create: {
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
    },
  })

  await prisma.auditLog.create({
    data: {
      actorId: 'system',
      actorName: 'System',
      actorRole: 'admin',
      action: 'SEED',
      details: 'Database seeded with admin, demo client, and document categories',
    },
  })

  console.log('Database seeded successfully.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
