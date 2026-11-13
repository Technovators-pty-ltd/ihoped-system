/** Lightweight client-side hash for mock auth only — not for production. */
export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(`ihoped-mock:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const candidate = await hashPassword(password)
  return candidate === hash
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}

export function generateReference(): string {
  const year = new Date().getFullYear()
  const rand = Math.floor(100000 + Math.random() * 900000)
  return `IHOPED-${year}-${rand}`
}

export function generateAccountId(): string {
  return `CLT-${Date.now().toString().slice(-8)}`
}

export function generateResetToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
