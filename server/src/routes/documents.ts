import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { prisma } from '../prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { addAuditLog, mapCategory, mapDocument, notifyUser } from '../utils.js'

const router = Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadRoot = path.join(__dirname, '../../uploads')
fs.mkdirSync(uploadRoot, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadRoot),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
    cb(null, `${Date.now()}_${safe}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase()
    const ok = file.mimetype === 'application/pdf' || name.endsWith('.pdf')
    cb(ok ? null : new Error('Only PDF documents are allowed.'), ok)
  },
})

function baseUrl(req: { protocol: string; get: (h: string) => string | undefined }) {
  return `${req.protocol}://${req.get('host')}`
}

router.use(requireAuth)

router.get('/categories', async (_req, res) => {
  const categories = await prisma.documentCategory.findMany({ orderBy: { title: 'asc' } })
  return res.json({ categories: categories.map(mapCategory) })
})

router.put('/categories', requireRole('admin'), async (req, res) => {
  const categories = Array.isArray(req.body?.categories) ? req.body.categories : []
  for (const cat of categories) {
    await prisma.documentCategory.upsert({
      where: { id: cat.id },
      update: {
        title: cat.title,
        description: cat.description,
        mandatory: Boolean(cat.mandatory),
        optional: Boolean(cat.optional),
        enabled: Boolean(cat.enabled),
        certificationRequired: Boolean(cat.certificationRequired),
        conditionJson: cat.condition ? JSON.stringify(cat.condition) : null,
      },
      create: {
        id: cat.id,
        title: cat.title,
        description: cat.description,
        mandatory: Boolean(cat.mandatory),
        optional: Boolean(cat.optional),
        enabled: Boolean(cat.enabled),
        certificationRequired: Boolean(cat.certificationRequired),
        conditionJson: cat.condition ? JSON.stringify(cat.condition) : null,
      },
    })
  }
  await addAuditLog(req.auth!.id, req.auth!.name, 'admin', 'DOC_REQUIREMENTS_UPDATE', 'Document requirements updated')
  const all = await prisma.documentCategory.findMany()
  return res.json({ categories: all.map(mapCategory) })
})

router.get('/', async (req, res) => {
  if (req.auth!.role === 'admin') {
    const docs = await prisma.uploadedDocument.findMany({ orderBy: { uploadedAt: 'desc' } })
    return res.json({ documents: docs.map((d) => mapDocument(d, baseUrl(req))) })
  }
  const docs = await prisma.uploadedDocument.findMany({
    where: { clientId: req.auth!.id },
    orderBy: { uploadedAt: 'desc' },
  })
  return res.json({ documents: docs.map((d) => mapDocument(d, baseUrl(req))) })
})

router.post('/upload', requireRole('client'), (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed.' })
    try {
      if (!req.file) return res.status(400).json({ error: 'No file attached.' })
      const categoryId = String(req.body?.categoryId || '')
      const applicationId = req.body?.applicationId ? String(req.body.applicationId) : undefined
      const category = await prisma.documentCategory.findUnique({ where: { id: categoryId } })
      if (!category || !category.enabled) return res.status(400).json({ error: 'Invalid document category.' })

      const existing = await prisma.uploadedDocument.findFirst({
        where: { clientId: req.auth!.id, categoryId },
      })

      let doc
      if (existing) {
        const oldPath = path.join(uploadRoot, existing.storagePath)
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath)
        doc = await prisma.uploadedDocument.update({
          where: { id: existing.id },
          data: {
            fileName: req.file.originalname,
            fileType: req.file.mimetype,
            fileSize: req.file.size,
            storagePath: req.file.filename,
            status: 'Uploaded',
            reviewNote: null,
            applicationId,
            uploadedAt: new Date(),
          },
        })
      } else {
        doc = await prisma.uploadedDocument.create({
          data: {
            clientId: req.auth!.id,
            categoryId,
            applicationId,
            fileName: req.file.originalname,
            fileType: req.file.mimetype,
            fileSize: req.file.size,
            storagePath: req.file.filename,
            status: 'Uploaded',
          },
        })
      }
      return res.json({ ok: true, document: mapDocument(doc, baseUrl(req)) })
    } catch (error) {
      console.error(error)
      return res.status(500).json({ error: 'Could not save document.' })
    }
  })
})

router.delete('/:id', requireRole('client'), async (req, res) => {
  const doc = await prisma.uploadedDocument.findUnique({ where: { id: req.params.id } })
  if (!doc || doc.clientId !== req.auth!.id) return res.status(404).json({ error: 'Document not found.' })
  if (doc.status === 'Verified') return res.status(400).json({ error: 'Verified documents cannot be removed.' })
  const filePath = path.join(uploadRoot, doc.storagePath)
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  await prisma.uploadedDocument.delete({ where: { id: doc.id } })
  return res.json({ ok: true })
})

router.post('/:id/review', requireRole('admin'), async (req, res) => {
  const status = String(req.body?.status || '')
  const note = req.body?.note ? String(req.body.note) : undefined
  const doc = await prisma.uploadedDocument.findUnique({ where: { id: req.params.id } })
  if (!doc) return res.status(404).json({ error: 'Document not found.' })

  const category = await prisma.documentCategory.findUnique({ where: { id: doc.categoryId } })
  const documentLabel = category?.title || doc.fileName

  const updated = await prisma.uploadedDocument.update({
    where: { id: doc.id },
    data: { status, reviewNote: note },
  })
  await addAuditLog(req.auth!.id, req.auth!.name, 'admin', 'DOCUMENT_REVIEW', `${doc.id} → ${status}`)

  // Unlock when every document the client uploaded is verified (none still pending / declined)
  const docs = await prisma.uploadedDocument.findMany({ where: { clientId: doc.clientId } })
  const verifiedCount = docs.filter((d) => d.status === 'Verified').length
  const hasPendingUpload = docs.some((d) => d.status === 'Uploaded' || d.status === 'Pending')
  const hasDeclinedDocs = docs.some((d) => ['Rejected', 'Resubmission Required'].includes(d.status))
  const allUploadedDocsVerified =
    docs.length > 0 && verifiedCount === docs.length && !hasPendingUpload && !hasDeclinedDocs
  const rejected = hasDeclinedDocs

  const apps = await prisma.housingApplication.findMany({
    where: {
      clientId: doc.clientId,
      status: { in: ['Documents Under Review', 'Documents Required', 'Awaiting Documents'] },
    },
    orderBy: { updatedAt: 'desc' },
  })
  const target = apps[0]

  if (status === 'Verified') {
    // One summary notification with the verified count (not one per document)
    await prisma.notification.deleteMany({
      where: { userId: doc.clientId, title: 'Documents verified' },
    })
    if (target && allUploadedDocsVerified) {
      await prisma.housingApplication.update({
        where: { id: target.id },
        data: { status: 'In Progress' },
      })
      await prisma.statusHistory.create({
        data: {
          applicationId: target.id,
          status: 'In Progress',
          note: 'All required documents verified — application form unlocked',
          changedBy: req.auth!.id,
          changedByRole: 'admin',
        },
      })
      await notifyUser(
        doc.clientId,
        'client',
        'Application form available',
        `${verifiedCount} document${verifiedCount === 1 ? '' : 's'} verified/approved for ${target.referenceNumber}. You can now open and complete the housing application form.`,
        'success',
      )
      await addAuditLog(
        req.auth!.id,
        req.auth!.name,
        'admin',
        'FORM_UNLOCKED',
        `${target.referenceNumber} form unlocked after document verification`,
      )
    } else {
      await notifyUser(
        doc.clientId,
        'client',
        'Documents verified',
        `${verifiedCount} document${verifiedCount === 1 ? ' has' : 's have'} been verified/approved.`,
        'success',
      )
    }
  } else if (status === 'Rejected' || status === 'Resubmission Required') {
    // Decline: tell which document and why
    const reason = note?.trim() || 'No reason provided.'
    await notifyUser(
      doc.clientId,
      'client',
      'Document declined',
      `"${documentLabel}" was declined. Reason: ${reason}`,
      'error',
    )

    // Let the client see the decline and replace the file
    if (target && rejected && target.status !== 'Documents Required') {
      await prisma.housingApplication.update({
        where: { id: target.id },
        data: { status: 'Documents Required' },
      })
      await prisma.statusHistory.create({
        data: {
          applicationId: target.id,
          status: 'Documents Required',
          note: `"${documentLabel}" declined — client must upload a corrected PDF. Reason: ${reason}`,
          changedBy: req.auth!.id,
          changedByRole: 'admin',
        },
      })
    } else if (target && rejected && target.status === 'Documents Required') {
      await prisma.statusHistory.create({
        data: {
          applicationId: target.id,
          status: 'Documents Required',
          note: `"${documentLabel}" declined — client must upload a corrected PDF. Reason: ${reason}`,
          changedBy: req.auth!.id,
          changedByRole: 'admin',
        },
      })
    }
  }

  return res.json({ ok: true, document: mapDocument(updated, baseUrl(req)) })
})

export default router
