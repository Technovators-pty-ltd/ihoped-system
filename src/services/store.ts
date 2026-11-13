import { createInitialStore } from '../mocks/seed'
import type { AppStore } from '../types'

const STORE_KEY = 'ihoped_app_store_v2'
const SESSION_KEY = 'ihoped_session'
const REMEMBER_KEY = 'ihoped_remember'

let memoryStore: AppStore | null = null
let initPromise: Promise<AppStore> | null = null

export async function ensureStore(): Promise<AppStore> {
  if (memoryStore) return memoryStore
  if (initPromise) return initPromise

  initPromise = (async () => {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) {
      try {
        memoryStore = JSON.parse(raw) as AppStore
        return memoryStore
      } catch {
        // fall through to seed
      }
    }
    memoryStore = await createInitialStore()
    persistStore()
    return memoryStore
  })()

  return initPromise
}

export function getStoreSync(): AppStore {
  if (!memoryStore) {
    throw new Error('Store not initialised. Call ensureStore() first.')
  }
  return memoryStore
}

export function persistStore(): void {
  if (!memoryStore) return
  localStorage.setItem(STORE_KEY, JSON.stringify(memoryStore))
}

export function updateStore(mutator: (store: AppStore) => void): AppStore {
  const store = getStoreSync()
  mutator(store)
  persistStore()
  return store
}

export function resetStore(): Promise<AppStore> {
  localStorage.removeItem(STORE_KEY)
  memoryStore = null
  initPromise = null
  return ensureStore()
}

export function saveSession(session: unknown, remember: boolean) {
  const payload = JSON.stringify(session)
  if (remember) {
    localStorage.setItem(REMEMBER_KEY, payload)
    sessionStorage.removeItem(SESSION_KEY)
  } else {
    sessionStorage.setItem(SESSION_KEY, payload)
    localStorage.removeItem(REMEMBER_KEY)
  }
}

export function loadSession<T>(): T | null {
  const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(REMEMBER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(REMEMBER_KEY)
}
