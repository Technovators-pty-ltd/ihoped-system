/** Validate South African ID number.
 * Demo mode: accepts any 13-digit number so applicants can use test IDs.
 * Strict Luhn checksum can be re-enabled when moving to production. */
export function validateSouthAfricanId(id: string): { valid: boolean; message?: string } {
  const cleaned = id.replace(/\s/g, '')
  if (!/^\d{13}$/.test(cleaned)) {
    return { valid: false, message: 'ID number must be exactly 13 digits.' }
  }

  return { valid: true }
}

export function maskIdNumber(id: string): string {
  if (!id || id.length < 6) return '•••••••••••••'
  return `${id.slice(0, 6)}•••••••`
}
