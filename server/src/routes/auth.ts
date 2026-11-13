import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../prisma.js'
import { requireAuth, signToken } from '../middleware/auth.js'
import {
  addAuditLog,
  generateAccountId,
  generateResetToken,
  notifyUser,
  validateSouthAfricanId,
} from '../utils.js'

const router = Router()
const MAX_ATTEMPTS = 5
const LOCK_MINUTES = 15

async function checkLock(key: string) {
  const entry = await prisma.loginAttempt.findUnique({ where: { attemptKey: key } })
  if (entry?.lockedUntil && entry.lockedUntil > new Date()) {
    const mins = Math.ceil((entry.lockedUntil.getTime() - Date.now()) / 60000)
    return `Account temporarily locked. Try again in ${mins} minute(s).`
  }
  return null
}

async function recordFailure(key: string) {
  const current = await prisma.loginAttempt.findUnique({ where: { attemptKey: key } })
  const count = (current?.count || 0) + 1
  if (count >= MAX_ATTEMPTS) {
    await prisma.loginAttempt.upsert({
      where: { attemptKey: key },
      update: { count: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60 * 1000) },
      create: { attemptKey: key, count: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60 * 1000) },
    })
  } else {
    await prisma.loginAttempt.upsert({
      where: { attemptKey: key },
      update: { count },
      create: { attemptKey: key, count },
    })
  }
}

async function clearFailures(key: string) {
  await prisma.loginAttempt.deleteMany({ where: { attemptKey: key } })
}

router.post('/register', async (req, res) => {
  try {
    const { firstName, surname, username, email, idNumber, password, confirmPassword, consent } = req.body || {}
    const settings = await prisma.systemSetting.findUnique({ where: { id: 1 } })
    if (settings && !settings.allowRegistration) {
      return res.status(403).json({
        error: 'Registration is currently disabled by an administrator.',
        field: 'form',
      })
    }
    if (!consent) {
      return res.status(400).json({
        error: 'Consent: you must accept the POPIA privacy notice to register.',
        field: 'consent',
      })
    }
    if (!firstName?.trim()) {
      return res.status(400).json({ error: 'Full Name: please enter your first name.', field: 'firstName' })
    }
    if (!surname?.trim()) {
      return res.status(400).json({ error: 'Surname: please enter your surname.', field: 'surname' })
    }
    const cleanUsername = String(username || '')
      .trim()
      .toLowerCase()
    if (!cleanUsername) {
      return res.status(400).json({ error: 'Username: please choose a username.', field: 'username' })
    }
    if (!/^[a-z0-9_]{3,30}$/.test(cleanUsername)) {
      return res.status(400).json({
        error: 'Username: must be 3–30 characters using only letters, numbers, or underscores.',
        field: 'username',
      })
    }
    if (!String(email || '').trim()) {
      return res.status(400).json({ error: 'Email: please enter your email address.', field: 'email' })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '')) {
      return res.status(400).json({
        error: 'Email: please enter a valid email address (example: name@email.com).',
        field: 'email',
      })
    }
    const idCheck = validateSouthAfricanId(String(idNumber || ''))
    if (!idCheck.valid) {
      return res.status(400).json({
        error: `South African ID Number: ${idCheck.message}`,
        field: 'idNumber',
      })
    }
    if (!password) {
      return res.status(400).json({ error: 'Password: please enter a password.', field: 'password' })
    }
    if (String(password).length < 8) {
      return res.status(400).json({
        error: 'Password: must be at least 8 characters long.',
        field: 'password',
      })
    }
    if (!confirmPassword) {
      return res.status(400).json({
        error: 'Confirm Password: please re-enter your password.',
        field: 'confirmPassword',
      })
    }
    if (password !== confirmPassword) {
      return res.status(400).json({
        error: 'Confirm Password: the passwords do not match.',
        field: 'confirmPassword',
      })
    }

    const existingUsername = await prisma.client.findFirst({
      where: { username: { equals: cleanUsername } },
    })
    const adminUsernameTaken = (await prisma.admin.findMany()).some(
      (a) => a.username.toLowerCase() === cleanUsername,
    )
    if (existingUsername || adminUsernameTaken) {
      return res.status(400).json({
        error: 'Username: that username is already taken. Please choose another.',
        field: 'username',
      })
    }
    const existingEmail = await prisma.client.findUnique({ where: { email: String(email).toLowerCase() } })
    if (existingEmail) {
      return res.status(400).json({
        error: 'Email: an account with this email already exists. Try signing in instead.',
        field: 'email',
      })
    }
    const existingId = await prisma.client.findUnique({ where: { idNumber: String(idNumber).replace(/\s/g, '') } })
    if (existingId) {
      return res.status(400).json({
        error: 'South African ID Number: an account with this ID number already exists.',
        field: 'idNumber',
      })
    }

    const passwordHash = await bcrypt.hash(String(password), 12)
    const client = await prisma.client.create({
      data: {
        accountId: generateAccountId(),
        username: cleanUsername,
        firstName: String(firstName).trim(),
        surname: String(surname).trim(),
        email: String(email).trim().toLowerCase(),
        idNumber: String(idNumber).replace(/\s/g, ''),
        passwordHash,
      },
    })

    await notifyUser(
      client.id,
      'client',
      'Welcome to iHOPED',
      `Your account has been registered successfully. Sign in with your email or username (${cleanUsername}) to start your housing application.`,
      'success',
    )
    await addAuditLog('system', 'System', 'admin', 'CLIENT_REGISTERED', `Client ${client.email} registered`)

    return res.json({ ok: true, username: cleanUsername })
  } catch (error) {
    console.error(error)
    const prismaError = error as { code?: string; meta?: { target?: string[] } }
    if (prismaError.code === 'P2002') {
      const target = prismaError.meta?.target?.join(' ') || ''
      if (target.includes('username')) {
        return res.status(400).json({
          error: 'Username: that username is already taken. Please choose another.',
          field: 'username',
        })
      }
      if (target.includes('email')) {
        return res.status(400).json({
          error: 'Email: an account with this email already exists.',
          field: 'email',
        })
      }
      if (target.includes('idNumber')) {
        return res.status(400).json({
          error: 'South African ID Number: an account with this ID number already exists.',
          field: 'idNumber',
        })
      }
    }
    return res.status(500).json({
      error: 'Registration failed because of a server error. Please try again.',
      field: 'form',
    })
  }
})

router.post('/login', async (req, res) => {
  try {
    const identifier = String(req.body?.identifier || '').trim()
    const password = String(req.body?.password || '')
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Please enter your email or username and password.' })
    }

    const admin = await prisma.admin.findFirst({
      where: { username: { equals: identifier } },
    })
    // SQLite case sensitivity: also try lowercase compare
    const adminMatch =
      admin ||
      (await prisma.admin.findMany()).find((a) => a.username.toLowerCase() === identifier.toLowerCase())

    if (adminMatch) {
      const key = `admin:${adminMatch.username.toLowerCase()}`
      const locked = await checkLock(key)
      if (locked) return res.status(429).json({ error: locked })
      if (!(await bcrypt.compare(password, adminMatch.passwordHash))) {
        await recordFailure(key)
        return res.status(401).json({ error: 'Incorrect email/username or password.' })
      }
      if (!adminMatch.active) return res.status(403).json({ error: 'Administrator account is inactive.' })
      await clearFailures(key)
      const user = {
        id: adminMatch.id,
        role: 'admin' as const,
        name: adminMatch.fullName,
        username: adminMatch.username,
        email: adminMatch.email,
        mustChangePassword: adminMatch.mustChangePassword,
      }
      await addAuditLog(adminMatch.id, adminMatch.fullName, 'admin', 'ADMIN_LOGIN', 'Administrator signed in')
      return res.json({ ok: true, user, token: signToken(user) })
    }

    const identifierLower = identifier.toLowerCase()
    let client = await prisma.client.findFirst({
      where: {
        OR: [{ email: identifierLower }, { username: identifierLower }],
      },
    })
    if (!client) {
      client =
        (await prisma.client.findMany()).find(
          (c) => c.username.toLowerCase() === identifierLower || c.email.toLowerCase() === identifierLower,
        ) || null
    }
    const key = `client:${identifierLower}`
    const locked = await checkLock(key)
    if (locked) return res.status(429).json({ error: locked })

    if (!client || !(await bcrypt.compare(password, client.passwordHash))) {
      await recordFailure(key)
      return res.status(401).json({ error: 'Incorrect email/username or password.' })
    }
    if (!client.active) {
      return res.status(403).json({ error: 'Your account has been deactivated. Contact support.' })
    }
    await clearFailures(key)
    const user = {
      id: client.id,
      role: 'client' as const,
      name: `${client.firstName} ${client.surname}`,
      email: client.email,
      username: client.username,
    }
    return res.json({ ok: true, user, token: signToken(user) })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'Login failed.' })
  }
})

router.get('/me', requireAuth, async (req, res) => {
  return res.json({ user: req.auth })
})

router.post('/forgot-password', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase()
    const client = await prisma.client.findUnique({ where: { email } })
    if (!client) return res.json({ ok: true })

    const token = generateResetToken()
    await prisma.passwordResetToken.deleteMany({ where: { email } })
    await prisma.passwordResetToken.create({
      data: {
        email,
        token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    })
    await notifyUser(
      client.id,
      'client',
      'Password reset requested',
      'A password reset token was generated (demo — use the on-screen reset link).',
      'info',
    )
    return res.json({ ok: true, demoToken: token })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'Could not process password reset.' })
  }
})

router.post('/reset-password', async (req, res) => {
  try {
    const token = String(req.body?.token || '')
    const password = String(req.body?.password || '')
    const confirmPassword = String(req.body?.confirmPassword || '')
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' })
    if (password !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match.' })

    const entry = await prisma.passwordResetToken.findUnique({ where: { token } })
    if (!entry || entry.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Reset link is invalid or has expired.' })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    await prisma.client.update({
      where: { email: entry.email },
      data: { passwordHash },
    })
    await prisma.passwordResetToken.delete({ where: { token } })
    return res.json({ ok: true })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'Could not reset password.' })
  }
})

router.get('/settings', async (_req, res) => {
  const settings = await prisma.systemSetting.findUnique({ where: { id: 1 } })
  return res.json({
    settings: settings || {
      allowRegistration: true,
      emailNotifications: true,
      maxUploadMb: 5,
      maintenanceMode: false,
      privacyNotice: '',
    },
  })
})

export default router
