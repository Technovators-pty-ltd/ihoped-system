import type { SessionUser } from '../types'
import { ApiError, api, clearToken, getToken, setToken } from './api'

const SESSION_KEY = 'ihoped_session_user'

function saveUser(user: SessionUser, remember: boolean) {
  const raw = JSON.stringify(user)
  if (remember) {
    localStorage.setItem(SESSION_KEY, raw)
    sessionStorage.removeItem(SESSION_KEY)
  } else {
    sessionStorage.setItem(SESSION_KEY, raw)
    localStorage.removeItem(SESSION_KEY)
  }
}

function loadUser(): SessionUser | null {
  const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SessionUser
  } catch {
    return null
  }
}

function clearUser() {
  sessionStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(SESSION_KEY)
}

export async function getCurrentSession(): Promise<SessionUser | null> {
  const token = getToken()
  const cached = loadUser()
  if (!token || !cached) return null
  try {
    const data = await api<{ user: SessionUser }>('/auth/me')
    saveUser(data.user, Boolean(localStorage.getItem('ihoped_api_token')))
    return data.user
  } catch {
    clearToken()
    clearUser()
    return null
  }
}

export async function registerClient(input: {
  firstName: string
  surname: string
  username: string
  email: string
  idNumber: string
  password: string
  confirmPassword: string
  consent: boolean
}): Promise<{ ok: true } | { ok: false; error: string; field?: string }> {
  try {
    await api('/auth/register', { method: 'POST', json: input })
    return { ok: true }
  } catch (e) {
    if (e instanceof ApiError) {
      return { ok: false, error: e.message, field: e.field }
    }
    return { ok: false, error: e instanceof Error ? e.message : 'Registration failed.' }
  }
}

export async function login(
  identifier: string,
  password: string,
  remember: boolean,
): Promise<{ ok: true; user: SessionUser } | { ok: false; error: string }> {
  try {
    const data = await api<{ ok: true; user: SessionUser; token: string }>('/auth/login', {
      method: 'POST',
      json: { identifier, password },
    })
    setToken(data.token, remember)
    saveUser(data.user, remember)
    return { ok: true, user: data.user }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Login failed.' }
  }
}

export function logout() {
  clearToken()
  clearUser()
}

export async function clearLoginLocks() {
  // Lockouts are stored in the database; waiting out or successful login clears them.
}

export async function requestPasswordReset(
  email: string,
): Promise<{ ok: true; demoToken?: string } | { ok: false; error: string }> {
  try {
    return await api('/auth/forgot-password', { method: 'POST', json: { email } })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Request failed.' }
  }
}

export async function resetPassword(
  token: string,
  password: string,
  confirmPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await api('/auth/reset-password', {
      method: 'POST',
      json: { token, password, confirmPassword },
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Reset failed.' }
  }
}

export async function changeClientPassword(
  _clientId: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await api('/clients/me/password', {
      method: 'PUT',
      json: { currentPassword, newPassword },
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not change password.' }
  }
}

export async function changeAdminPassword(
  _adminId: string,
  _currentPassword: string,
  _newPassword: string,
): Promise<{ ok: true; user: SessionUser } | { ok: false; error: string }> {
  return { ok: false, error: 'Admin password change via API can be added in settings later.' }
}

export async function getPrivacyNotice(): Promise<string> {
  try {
    const data = await api<{ settings: { privacyNotice: string } }>('/auth/settings')
    return data.settings.privacyNotice
  } catch {
    return ''
  }
}
