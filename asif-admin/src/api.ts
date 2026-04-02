import axios from 'axios'

/**
 * Dev default: `/asif-api` → Vite proxies to 127.0.0.1:3002 (see vite.config.ts).
 * Production: set `VITE_API_URL=https://your-api.example.com` at build time.
 */
const apiBase =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? '/asif-api' : 'http://localhost:3002')

export function getApiBaseUrl(): string {
  return apiBase
}

/** No auth. Use before Google sign-in to confirm asif-server + Vite proxy are wired. */
export async function pingAsifApi(): Promise<
  { ok: true; serverTime: string } | { ok: false; message: string }
> {
  try {
    const r = await fetch(`${apiBase.replace(/\/$/, '')}/debug/ping`, {
      method: 'GET',
      cache: 'no-store',
    })
    if (!r.ok) {
      return { ok: false, message: `HTTP ${r.status}` }
    }
    const data = (await r.json()) as { ok?: boolean; t?: string }
    if (!data.ok) {
      return { ok: false, message: 'Unexpected response' }
    }
    return { ok: true, serverTime: data.t || '' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error'
    return { ok: false, message: msg }
  }
}

const api = axios.create({ baseURL: apiBase })

let adminIdTokenGetter: (() => Promise<string | null>) | null = null

/** Called from AuthProvider so every request sends the current Firebase ID token. */
export function setAdminIdTokenGetter(fn: () => Promise<string | null>) {
  adminIdTokenGetter = fn
}

api.interceptors.request.use(async (config) => {
  if (adminIdTokenGetter) {
    const token = await adminIdTokenGetter()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

export interface User {
  id: string
  name: string
  role: 'collector' | 'manager' | 'customer_service'
}

export interface UserPayload {
  id: string
  name: string
  pin: string
  role: 'collector' | 'manager' | 'customer_service'
}

export type AdminSession = { uid: string; email: string | null }

/**
 * Confirms the Firebase ID token is an allowed web admin (Firestore / env / claim).
 * Pass `idToken` from the signed-in user so the request does not rely on interceptor timing.
 */
export const verifyAdminSession = (idToken: string) =>
  api
    .get<AdminSession>('/admin/me', {
      headers: { Authorization: `Bearer ${idToken}` },
    })
    .then((r) => r.data)

export const getUsers = () =>
  api.get<User[]>('/admin/users').then(r => r.data)

export const createUser = (payload: UserPayload) =>
  api.post<User>('/admin/users', payload).then(r => r.data)

export const updateUser = (id: string, payload: Partial<UserPayload>) =>
  api.put<User>(`/admin/users/${id}`, payload).then(r => r.data)

export const deleteUser = (id: string) =>
  api.delete(`/admin/users/${id}`)

export interface DashboardRow {
  collectorId: string
  collectorName: string
  order: {
    id: string
    status: 'queued' | 'assigned' | 'in_progress' | 'completed'
    startedAt: string | null
    total: number
    collected: number
    missing: number
  } | null
}

export const getDashboard = () =>
  api.get<DashboardRow[]>('/dashboard').then(r => r.data)
