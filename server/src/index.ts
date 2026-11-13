import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth.js'
import applicationRoutes from './routes/applications.js'
import documentRoutes from './routes/documents.js'
import clientRoutes from './routes/clients.js'
import notificationRoutes from './routes/notifications.js'
import adminRoutes from './routes/admin.js'

const app = express()
const port = Number(process.env.PORT || 4000)
const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173'
const __dirname = path.dirname(fileURLToPath(import.meta.url))

app.use(cors({ origin, credentials: true }))
app.use(express.json({ limit: '2mb' }))
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'ihoped-api' })
})

app.use('/api/auth', authRoutes)
app.use('/api/applications', applicationRoutes)
app.use('/api/documents', documentRoutes)
app.use('/api/clients', clientRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/admin', adminRoutes)

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  res.status(500).json({ error: err.message || 'Server error' })
})

app.listen(port, () => {
  console.log(`iHOPED API running on http://localhost:${port}`)
})
