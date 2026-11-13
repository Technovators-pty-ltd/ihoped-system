import { Router } from 'express'
import { prisma } from '../prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { addAuditLog, generateReference, mapApplication, notifyUser } from '../utils.js'

const router = Router()

router.use(requireAuth)

async function mandatoryCategories() {
  return prisma.documentCategory.findMany({
    where: {
      enabled: true,
      OR: [{ mandatory: true }, { optional: false }],
    },
  })
}

async function areDocsVerified(clientId: string) {
  const docs = await prisma.uploadedDocument.findMany({ where: { clientId } })
  if (docs.length === 0) return false
  // All files the client uploaded must be verified (matches admin unlock rules)
  if (docs.every((d) => d.status === 'Verified')) return true
  const cats = await mandatoryCategories()
  return cats.every((c) => docs.some((d) => d.categoryId === c.id && d.status === 'Verified'))
}

async function areDocsUploaded(clientId: string) {
  const cats = await mandatoryCategories()
  const docs = await prisma.uploadedDocument.findMany({ where: { clientId } })
  return cats.every((c) =>
    docs.some((d) => d.categoryId === c.id && ['Uploaded', 'Verified'].includes(d.status)),
  )
}

router.get('/', async (req, res) => {
  if (req.auth!.role === 'admin') {
    const apps = await prisma.housingApplication.findMany({ orderBy: { updatedAt: 'desc' } })
    return res.json({ applications: apps.map(mapApplication) })
  }
  const apps = await prisma.housingApplication.findMany({
    where: { clientId: req.auth!.id },
    orderBy: { updatedAt: 'desc' },
  })
  return res.json({ applications: apps.map(mapApplication) })
})

router.get('/:id', async (req, res) => {
  const app = await prisma.housingApplication.findUnique({ where: { id: req.params.id } })
  if (!app) return res.status(404).json({ error: 'Application not found.' })
  if (req.auth!.role === 'client' && app.clientId !== req.auth!.id) {
    return res.status(403).json({ error: 'Access denied.' })
  }
  return res.json({ application: mapApplication(app) })
})

router.get('/:id/history', async (req, res) => {
  const app = await prisma.housingApplication.findUnique({ where: { id: req.params.id } })
  if (!app) return res.status(404).json({ error: 'Application not found.' })
  if (req.auth!.role === 'client' && app.clientId !== req.auth!.id) {
    return res.status(403).json({ error: 'Access denied.' })
  }
  const history = await prisma.statusHistory.findMany({
    where: { applicationId: app.id },
    orderBy: { createdAt: 'asc' },
  })
  return res.json({
    history: history.map((h) => ({
      id: h.id,
      applicationId: h.applicationId,
      status: h.status,
      note: h.note || undefined,
      changedBy: h.changedBy,
      changedByRole: h.changedByRole,
      createdAt: h.createdAt.toISOString(),
    })),
  })
})

router.post('/start', requireRole('client'), async (req, res) => {
  const clientId = req.auth!.id
  const existing = await prisma.housingApplication.findMany({
    where: { clientId },
    orderBy: { updatedAt: 'desc' },
  })

  const openDoc = existing.find((a) =>
    ['Awaiting Documents', 'Documents Under Review', 'Documents Required'].includes(a.status),
  )
  if (openDoc) return res.json({ application: mapApplication(openDoc), next: 'documents' })

  const openForm = existing.find((a) => a.status === 'In Progress')
  if (openForm) return res.json({ application: mapApplication(openForm), next: 'form' })

  const app = await prisma.housingApplication.create({
    data: {
      referenceNumber: generateReference(),
      clientId,
      status: 'Awaiting Documents',
    },
  })
  await prisma.statusHistory.create({
    data: {
      applicationId: app.id,
      status: 'Awaiting Documents',
      note: 'Application started — upload required documents first',
      changedBy: clientId,
      changedByRole: 'client',
    },
  })
  await notifyUser(
    clientId,
    'client',
    'Application started',
    `Reference ${app.referenceNumber}: upload your required PDF documents first. The application form unlocks after they are verified.`,
    'info',
  )
  return res.json({ application: mapApplication(app), next: 'documents' })
})

router.post('/:id/submit-documents', requireRole('client'), async (req, res) => {
  const app = await prisma.housingApplication.findUnique({ where: { id: req.params.id } })
  if (!app || app.clientId !== req.auth!.id) return res.status(404).json({ error: 'Application not found.' })
  if (!['Awaiting Documents', 'Documents Required', 'Not Started'].includes(app.status)) {
    return res.status(400).json({ error: 'Documents for this application are not awaiting submission.' })
  }
  if (!(await areDocsUploaded(req.auth!.id))) {
    return res.status(400).json({ error: 'Upload all mandatory documents before submitting for review.' })
  }

  const updated = await prisma.housingApplication.update({
    where: { id: app.id },
    data: { status: 'Documents Under Review' },
  })
  await prisma.uploadedDocument.updateMany({
    where: { clientId: req.auth!.id, status: 'Uploaded' },
    data: { applicationId: app.id },
  })
  await prisma.statusHistory.create({
    data: {
      applicationId: app.id,
      status: 'Documents Under Review',
      note: 'Documents submitted for administrator review',
      changedBy: req.auth!.id,
      changedByRole: 'client',
    },
  })
  await notifyUser(
    req.auth!.id,
    'client',
    'Documents submitted',
    `Your required documents for ${app.referenceNumber} have been submitted and are awaiting administrator review.`,
    'success',
  )
  return res.json({ ok: true, application: mapApplication(updated) })
})

router.put('/:id/progress', requireRole('client'), async (req, res) => {
  const app = await prisma.housingApplication.findUnique({ where: { id: req.params.id } })
  if (!app || app.clientId !== req.auth!.id) return res.status(404).json({ error: 'Application not found.' })
  if (app.status !== 'In Progress') {
    return res.status(400).json({ error: 'Your documents must be verified before you can complete this form.' })
  }

  const updated = await prisma.housingApplication.update({
    where: { id: app.id },
    data: {
      preferredProvince: String(req.body?.preferredProvince || ''),
      preferredMunicipality: String(req.body?.preferredMunicipality || ''),
      currentHousingSituation: String(req.body?.currentHousingSituation || ''),
      reason: String(req.body?.reason || ''),
      consentAccepted: Boolean(req.body?.consentAccepted),
    },
  })
  return res.json({ ok: true, application: mapApplication(updated) })
})

router.post('/:id/submit', requireRole('client'), async (req, res) => {
  const app = await prisma.housingApplication.findUnique({ where: { id: req.params.id } })
  if (!app || app.clientId !== req.auth!.id) return res.status(404).json({ error: 'Application not found.' })
  if (app.status !== 'In Progress') {
    return res.status(400).json({ error: 'Your documents must be verified before you can submit the application form.' })
  }
  if (!app.consentAccepted) {
    return res.status(400).json({ error: 'You must accept the declaration and consent before submitting.' })
  }
  if (!app.preferredProvince || !app.preferredMunicipality || !app.currentHousingSituation || !app.reason) {
    return res.status(400).json({ error: 'Please complete all required fields before submitting.' })
  }
  if (!(await areDocsVerified(req.auth!.id))) {
    return res.status(400).json({ error: 'All mandatory documents must be verified before final submission.' })
  }

  const updated = await prisma.housingApplication.update({
    where: { id: app.id },
    data: { status: 'Submitted', submittedAt: new Date() },
  })
  await prisma.statusHistory.create({
    data: {
      applicationId: app.id,
      status: 'Submitted',
      note: 'Application form submitted',
      changedBy: req.auth!.id,
      changedByRole: 'client',
    },
  })
  await notifyUser(
    req.auth!.id,
    'client',
    'Application form submitted',
    `Your housing application form for ${app.referenceNumber} has been submitted and is with iHOPED for review.`,
    'success',
  )
  return res.json({ ok: true, application: mapApplication(updated) })
})

router.patch('/:id/status', requireRole('admin'), async (req, res) => {
  const app = await prisma.housingApplication.findUnique({ where: { id: req.params.id } })
  if (!app) return res.status(404).json({ error: 'Application not found.' })
  const status = String(req.body?.status || '')
  const note = req.body?.note ? String(req.body.note) : undefined
  const rejectionReason = req.body?.rejectionReason ? String(req.body.rejectionReason) : undefined

  const updated = await prisma.housingApplication.update({
    where: { id: app.id },
    data: {
      status,
      rejectionReason: rejectionReason || app.rejectionReason,
    },
  })
  await prisma.statusHistory.create({
    data: {
      applicationId: app.id,
      status,
      note: note || rejectionReason,
      changedBy: req.auth!.id,
      changedByRole: 'admin',
    },
  })
  if (status === 'Approved') {
    await notifyUser(
      app.clientId,
      'client',
      'Application approved',
      `Good news — your housing application ${app.referenceNumber} has been approved.${note ? ` Note: ${note}` : ''}`,
      'success',
    )
  } else if (status === 'Rejected') {
    await notifyUser(
      app.clientId,
      'client',
      'Application declined',
      `Your housing application ${app.referenceNumber} has been declined.${rejectionReason ? ` Reason: ${rejectionReason}` : note ? ` Note: ${note}` : ''}`,
      'error',
    )
  } else {
    await notifyUser(
      app.clientId,
      'client',
      'Application status updated',
      `Application ${app.referenceNumber} is now: ${status}.`,
      'info',
    )
  }
  await addAuditLog(req.auth!.id, req.auth!.name, 'admin', 'STATUS_CHANGE', `${app.referenceNumber} → ${status}`)
  return res.json({ ok: true, application: mapApplication(updated) })
})

router.post('/:id/assign', requireRole('admin'), async (req, res) => {
  const app = await prisma.housingApplication.update({
    where: { id: req.params.id },
    data: { assignedAdminId: req.auth!.id },
  })
  await addAuditLog(req.auth!.id, req.auth!.name, 'admin', 'ASSIGN', `Assigned application ${app.id}`)
  return res.json({ ok: true, application: mapApplication(app) })
})

router.post('/:id/notes', requireRole('admin'), async (req, res) => {
  const app = await prisma.housingApplication.findUnique({ where: { id: req.params.id } })
  if (!app) return res.status(404).json({ error: 'Application not found.' })
  const notes = JSON.parse(app.internalNotesJson || '[]') as unknown[]
  notes.unshift({
    id: `note_${Date.now()}`,
    adminId: req.auth!.id,
    adminName: req.auth!.name,
    note: String(req.body?.note || ''),
    createdAt: new Date().toISOString(),
  })
  const updated = await prisma.housingApplication.update({
    where: { id: app.id },
    data: { internalNotesJson: JSON.stringify(notes) },
  })
  await addAuditLog(req.auth!.id, req.auth!.name, 'admin', 'INTERNAL_NOTE', `Note added on ${app.id}`)
  return res.json({ ok: true, application: mapApplication(updated) })
})

export default router
