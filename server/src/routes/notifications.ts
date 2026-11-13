import { Router } from 'express'
import { prisma } from '../prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { addAuditLog } from '../utils.js'

const router = Router()
router.use(requireAuth)

router.get('/', async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.auth!.id },
    orderBy: { createdAt: 'desc' },
  })
  return res.json({
    notifications: notifications.map((n) => ({
      id: n.id,
      userId: n.userId,
      userRole: n.userRole,
      title: n.title,
      message: n.message,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
      type: n.type,
    })),
  })
})

router.post('/:id/read', async (req, res) => {
  await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.auth!.id },
    data: { read: true },
  })
  return res.json({ ok: true })
})

router.post('/read-all', async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.auth!.id },
    data: { read: true },
  })
  return res.json({ ok: true })
})

router.post('/send', requireRole('admin'), async (req, res) => {
  const title = String(req.body?.title || '')
  const message = String(req.body?.message || '')
  const target = req.body?.target === 'single' ? 'single' : 'all'
  const clientId = req.body?.clientId ? String(req.body.clientId) : undefined

  const clients =
    target === 'all'
      ? await prisma.client.findMany({ where: { active: true } })
      : await prisma.client.findMany({ where: { id: clientId } })

  for (const c of clients) {
    await prisma.notification.create({
      data: {
        userId: c.id,
        userRole: 'client',
        title,
        message,
        type: 'info',
      },
    })
  }
  await addAuditLog(req.auth!.id, req.auth!.name, 'admin', 'NOTIFICATION_SEND', `${target} notification: ${title}`)
  return res.json({ ok: true, sent: clients.length })
})

export default router
