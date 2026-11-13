import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { addAuditLog } from '../utils.js'

const router = Router()
router.use(requireAuth, requireRole('admin'))

router.get('/admins', async (_req, res) => {
  const admins = await prisma.admin.findMany({ orderBy: { createdAt: 'desc' } })
  return res.json({
    admins: admins.map((a) => ({
      id: a.id,
      username: a.username,
      fullName: a.fullName,
      email: a.email,
      mustChangePassword: a.mustChangePassword,
      active: a.active,
      createdAt: a.createdAt.toISOString(),
    })),
  })
})

router.post('/admins', async (req, res) => {
  const username = String(req.body?.username || '').trim()
  const fullName = String(req.body?.fullName || '').trim()
  const email = String(req.body?.email || '').trim()
  const password = String(req.body?.password || '')
  if (!username || !fullName || !email || password.length < 8) {
    return res.status(400).json({ error: 'Please provide username, name, email and a strong password.' })
  }
  const passwordHash = await bcrypt.hash(password, 12)
  const admin = await prisma.admin.create({
    data: {
      username,
      fullName,
      email,
      passwordHash,
      mustChangePassword: true,
    },
  })
  await addAuditLog(req.auth!.id, req.auth!.name, 'admin', 'ADMIN_CREATE', `Created admin ${username}`)
  return res.json({
    ok: true,
    admin: {
      id: admin.id,
      username: admin.username,
      fullName: admin.fullName,
      email: admin.email,
      mustChangePassword: admin.mustChangePassword,
      active: admin.active,
      createdAt: admin.createdAt.toISOString(),
    },
  })
})

router.get('/audit-logs', async (_req, res) => {
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 })
  return res.json({
    logs: logs.map((l) => ({
      id: l.id,
      actorId: l.actorId,
      actorName: l.actorName,
      actorRole: l.actorRole,
      action: l.action,
      details: l.details,
      createdAt: l.createdAt.toISOString(),
    })),
  })
})

router.get('/settings', async (_req, res) => {
  const settings = await prisma.systemSetting.findUnique({ where: { id: 1 } })
  return res.json({ settings })
})

router.put('/settings', async (req, res) => {
  const settings = await prisma.systemSetting.update({
    where: { id: 1 },
    data: {
      allowRegistration: Boolean(req.body?.allowRegistration),
      emailNotifications: Boolean(req.body?.emailNotifications),
      maxUploadMb: Number(req.body?.maxUploadMb || 5),
      maintenanceMode: Boolean(req.body?.maintenanceMode),
      privacyNotice: String(req.body?.privacyNotice || ''),
    },
  })
  await addAuditLog(req.auth!.id, req.auth!.name, 'admin', 'SETTINGS_UPDATE', 'System settings updated')
  return res.json({ ok: true, settings })
})

router.get('/actions', async (_req, res) => {
  const docsPending = await prisma.uploadedDocument.count({ where: { status: 'Uploaded' } })
  const appsDocReview = await prisma.housingApplication.count({ where: { status: 'Documents Under Review' } })
  const appsSubmitted = await prisma.housingApplication.count({ where: { status: 'Submitted' } })
  const appsUnderReview = await prisma.housingApplication.count({ where: { status: 'Under Review' } })
  return res.json({ docsPending, appsDocReview, appsSubmitted, appsUnderReview })
})

export default router
