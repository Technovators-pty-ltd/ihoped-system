import type { ClientProfile } from '../types'
import { api } from './api'

export async function getAllClients(): Promise<ClientProfile[]> {
  const data = await api<{ clients: ClientProfile[] }>('/clients')
  return data.clients
}

export async function getClient(id: string): Promise<ClientProfile | undefined> {
  try {
    // Clients fetch their own profile via /me; admins can fetch any id
    try {
      const me = await api<{ client: ClientProfile }>('/clients/me')
      if (me.client.id === id) return me.client
    } catch {
      // not a client session
    }
    const data = await api<{ client: ClientProfile }>(`/clients/${id}`)
    return data.client
  } catch {
    return undefined
  }
}

export async function updateClientProfile(
  clientId: string,
  patch: Partial<
    Pick<
      ClientProfile,
      'phone' | 'address' | 'province' | 'municipality' | 'maritalStatus' | 'employmentStatus' | 'notificationPrefs'
    >
  >,
) {
  if (clientId) {
    await api('/clients/me', { method: 'PUT', json: patch })
  }
}

export async function setClientActive(clientId: string, active: boolean, _adminId: string, _adminName: string) {
  await api(`/clients/${clientId}/active`, { method: 'PATCH', json: { active } })
}

export async function adminUpdateClient(
  clientId: string,
  patch: Partial<Pick<ClientProfile, 'phone' | 'address' | 'province' | 'municipality'>>,
  _adminId: string,
  _adminName: string,
) {
  await api(`/clients/${clientId}`, { method: 'PATCH', json: patch })
}
