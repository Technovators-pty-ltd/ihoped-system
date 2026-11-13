import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { addAuditLog, mapClient } from '../utils.js'

const router = Router()
router.use(requireAuth)

router.get('/', requireRole('admin'), async (_req, res) => {
  const clients = await prisma.client.findMany({ orderBy: { registeredAt: 'desc' } })
  return res.json({ clients: clients.map(mapClient) })
})

router.get('/me', requireRole('client'), async (req, res) => {
  const client = await prisma.client.findUnique({ where: { id: req.auth!.id } })
  if (!client) return res.status(404).json({ error: 'Client not found.' })
  return res.json({ client: mapClient(client) })
})

router.get('/:id', requireRole('admin'), async (req, res) => {
  const client = await prisma.client.findUnique({ where: { id: req.params.id } })
  if (!client) return res.status(404).json({ error: 'Client not found.' })
  return res.json({ client: mapClient(client) })
})

router.put('/me', requireRole('client'), async (req, res) => {
  const client = await prisma.client.update({
    where: { id: req.auth!.id },
    data: {
      phone: req.body?.phone ?? undefined,
      address: req.body?.address ?? undefined,
      province: req.body?.province ?? undefined,
      municipality: req.body?.municipality ?? undefined,
      maritalStatus: req.body?.maritalStatus ?? undefined,
      employmentStatus: req.body?.employmentStatus ?? undefined,
      notifyEmail: req.body?.notificationPrefs?.email ?? undefined,
      notifyInApp: req.body?.notificationPrefs?.inApp ?? undefined,
    },
  })
  return res.json({ ok: true, client: mapClient(client) })
})

router.put('/me/password', requireRole('client'), async (req, res) => {
  const client = await prisma.client.findUnique({ where: { id: req.auth!.id } })
  if (!client) return res.status(404).json({ error: 'Client not found.' })
  const currentPassword = String(req.body?.currentPassword || '')
  const newPassword = String(req.body?.newPassword || '')
  if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' })
  if (!(await bcrypt.compare(currentPassword, client.passwordHash))) {
    return res.status(400).json({ error: 'Current password is incorrect.' })
  }
  await prisma.client.update({
    where: { id: client.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 12) },
  })
  return res.json({ ok: true })
})

router.patch('/:id/active', requireRole('admin'), async (req, res) => {
  const active = Boolean(req.body?.active)
  const client = await prisma.client.update({
    where: { id: req.params.id },
    data: { active },
  })
  await addAuditLog(
    req.auth!.id,
    req.auth!.name,
    'admin',
    active ? 'CLIENT_ACTIVATE' : 'CLIENT_DEACTIVATE',
    `Client ${client.id}`,
  )
  return res.json({ ok: true, client: mapClient(client) })
})

router.patch('/:id', requireRole('admin'), async (req, res) => {
  const client = await prisma.client.update({
    where: { id: req.params.id },
    data: {
      phone: req.body?.phone ?? undefined,
      address: req.body?.address ?? undefined,
      province: req.body?.province ?? undefined,
      municipality: req.body?.municipality ?? undefined,
    },
  })
  await addAuditLog(req.auth!.id, req.auth!.name, 'admin', 'CLIENT_UPDATE', `Updated client ${client.id}`)
  return res.json({ ok: true, client: mapClient(client) })
})

export default router
