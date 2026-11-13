import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'

export type AuthPayload = {
  id: string
  role: 'client' | 'admin'
  name: string
  email?: string
  username?: string
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload
    }
  }
}

const secret = () => process.env.JWT_SECRET || 'ihoped-dev-secret'

export function signToken(payload: AuthPayload) {
  return jwt.sign(payload, secret(), { expiresIn: '7d' })
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' })
  }
  try {
    req.auth = jwt.verify(header.slice(7), secret()) as AuthPayload
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session.' })
  }
}

export function requireRole(role: 'client' | 'admin') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ error: 'Authentication required.' })
    if (req.auth.role !== role) return res.status(403).json({ error: 'Access denied.' })
    next()
  }
}
