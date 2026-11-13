import { api } from './api'
import type { AuditLog } from '../types'

export async function getAuditLogs(): Promise<AuditLog[]> {
  const data = await api<{ logs: AuditLog[] }>('/admin/audit-logs')
  return data.logs
}

export function addAuditLog(
  _actorId: string,
  _actorName: string,
  _actorRole: string,
  _action: string,
  _details: string,
) {
  // Audit logs are written by the API
}
