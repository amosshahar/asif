const KEY = 'asif_admin_last_auth_debug'

export type LastAuthFailure = {
  /** Shown to the user (Hebrew). */
  userMessage: string
  status?: number
  apiPath: string
  serverError?: string
  axiosCode?: string
  apiBaseUrl: string
  at: string
}

const MAX_AGE_MS = 15 * 60 * 1000

export function saveLastAuthFailure(payload: Omit<LastAuthFailure, 'at'>): void {
  try {
    const full: LastAuthFailure = { ...payload, at: new Date().toISOString() }
    sessionStorage.setItem(KEY, JSON.stringify(full))
  } catch {
    /* private mode / quota */
  }
}

export function loadLastAuthFailure(): LastAuthFailure | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as LastAuthFailure
    if (!p?.at || !p.userMessage) return null
    if (Date.now() - new Date(p.at).getTime() > MAX_AGE_MS) {
      sessionStorage.removeItem(KEY)
      return null
    }
    return p
  } catch {
    return null
  }
}

export function clearLastAuthFailure(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* */
  }
}
