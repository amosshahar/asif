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

/** ASIF order (admin list — matches server) */
export interface Order {
  id: string
  wcOrderId?: number
  customerName: string
  status: 'queued' | 'assigned' | 'in_progress' | 'completed' | 'waiting_cs'
  assignedTo: string | null
  startedAt: string | null
  completedAt: string | null
  syncedAt?: string
  items: Array<{ sku: string; name: string; quantity: number; status: string }>
  distributionArea?: string | null
  shippingCity?: string | null
  shippingStreet?: string | null
  deliveryDate?: string | null
  deliveryTimeFrom?: string | null
  deliveryTimeTo?: string | null
  /** WC `date_created` — when the order was submitted. */
  wcDateCreated?: string | null
  /** Last known WooCommerce order status slug (e.g. processing, completed). */
  wcStatus?: string
  csHandoffReason?: string | null
  customerNote?: string | null
}

export type WcSyncOnLoad = 'ok' | 'skipped' | 'error' | 'pending' | 'cache'

export async function getOrders(opts?: {
  firestoreOnly?: boolean
}): Promise<{ orders: Order[]; wcSync: WcSyncOnLoad }> {
  const q = opts?.firestoreOnly === true ? '?sync=0' : ''
  const r = await api.get<Order[]>(`/admin/orders${q}`)
  const h = String(
    r.headers['x-asif-wc-sync'] ?? r.headers['X-ASIF-WC-Sync'] ?? ''
  ).toLowerCase()
  const wcSync: WcSyncOnLoad =
    h === 'ok' || h === 'skipped' || h === 'error' || h === 'pending' || h === 'cache'
      ? h
      : 'skipped'
  return {
    orders: Array.isArray(r.data) ? r.data : [],
    wcSync,
  }
}

export interface WooCommerceAdminStatus {
  configured: boolean
  storeUrl: string | null
  lastError: string | null
  fullSyncRunning: boolean
  fullSyncLastError: string | null
  persistence: string
  ordersCollection: string
  usersCollection: string
  defaultStatuses?: string[]
}

export const getWooCommerceAdminStatus = () =>
  api.get<WooCommerceAdminStatus>('/admin/woocommerce/status').then((r) => r.data)

export const assignOrder = (orderId: string, collectorId: string) =>
  api.post<Order>(`/admin/orders/${orderId}/assign`, { collectorId }).then((r) => r.data)

/** GET WC order and update `wcStatus` + `syncedAt` on the ASIF document. */
export const refreshOrderWcStatus = (orderId: string) =>
  api.post<Order>(`/admin/orders/${orderId}/wc/refresh`, {}).then((r) => r.data)

/** After ASIF status is completed: set WC order to `completed`, then refresh `wcStatus` from WC. */
export const completeWooCommerceOrder = (orderId: string) =>
  api.post<Order>(`/admin/orders/${orderId}/wc/complete`, {}).then((r) => r.data)

/** CS / admin: ASIF `waiting_cs` → `completed` (does not call WooCommerce). */
export const resolveOrderCustomerService = (orderId: string) =>
  api.post<Order>(`/admin/orders/${orderId}/resolve-cs`, {}).then((r) => r.data)

export interface WooSyncResult {
  ok: boolean
  persistence?: string
  collection?: string
  pages: number
  fetched: number
  inserted: number
  replaced: number
  metaOnly: number
  errors: string[]
}

export const syncWooCommerceOrders = () =>
  api.post<WooSyncResult>('/admin/woocommerce/sync').then((r) => r.data)

export interface WcLabPreset {
  id: string
  path: string
  labelHe: string
}

export interface WcLabCatalogResponse {
  configured: boolean
  error?: string
  storeOrigin?: string
  presets?: WcLabPreset[]
  docs?: string
  wpIndexHint?: string
}

export interface WcV3ReadRouteQueryParam {
  name: string
  required: boolean
  type: string
  enum?: string[]
  default?: unknown
}

export interface WcV3ReadRouteEntry {
  id: string
  pattern: string
  displayPath: string
  pathParams: string[]
  queryParams: WcV3ReadRouteQueryParam[]
}

export interface WcLabReadRoutesResponse {
  configured: boolean
  error?: string
  generatedFrom?: string
  generatedAt?: string
  routeCount?: number
  routes?: WcV3ReadRouteEntry[]
}

export interface WcLabFetchResponse {
  configured: boolean
  error?: string
  wc?: {
    httpStatus: number
    contentType: string | null
    endpoint: string
    bodyText: string
    truncated: boolean
  }
  lab?: { note: string }
}

export const getWcLabCatalog = () =>
  api.get<WcLabCatalogResponse>('/admin/woocommerce/lab/catalog').then((r) => r.data)

export const getWcLabReadRoutes = () =>
  api.get<WcLabReadRoutesResponse>('/admin/woocommerce/lab/read-routes').then((r) => r.data)

export const getWcLabFetch = (path: string, query?: Record<string, string>) =>
  api
    .get<WcLabFetchResponse>('/admin/woocommerce/lab/fetch', {
      params: { path, ...query },
    })
    .then((r) => r.data)

export interface DashboardOrderEntry {
  id: string
  status: 'queued' | 'assigned' | 'in_progress' | 'waiting_cs' | 'completed'
  startedAt: string | null
  total: number
  collected: number
  missing: number
  actionable: boolean
}

export interface DashboardRow {
  collectorId: string
  collectorName: string
  orders: DashboardOrderEntry[]
}

export const getDashboard = () =>
  api.get<DashboardRow[]>('/dashboard').then(r => r.data)

export interface CollectorStatsOrderRow {
  orderId: string
  completedAt: string | null
  pickDurationSeconds: number | null
  avgGapBetweenItemsSeconds: number | null
  timeToFirstItemSeconds: number | null
  itemsResolved: number
}

export interface CollectorStatsPayload {
  collectorId: string
  collectorName: string
  from: string
  to: string
  orderCount: number
  ordersWithPickTiming: number
  avgPickDurationSeconds: number | null
  medianPickDurationSeconds: number | null
  avgGapBetweenItemsSeconds: number | null
  medianGapBetweenItemsSeconds: number | null
  avgTimeToFirstItemSeconds: number | null
  orders: CollectorStatsOrderRow[]
}

export const getCollectorStats = (collectorId: string, opts?: { days?: number }) => {
  const d = opts?.days != null ? `?days=${opts.days}` : ''
  return api
    .get<CollectorStatsPayload>(`/admin/collectors/${encodeURIComponent(collectorId)}/stats${d}`)
    .then((r) => r.data)
}

/** Temporary Comax WS tester (Firebase admin only). */
export interface ComaxLabBlock {
  title: string
  url: string
  ok: boolean
  status: number
  note: string
}

/** Verbatim Comax HTTP response (see `block` for ASIF hints only). */
export interface ComaxUpstream {
  httpStatus: number
  body: string
  endpoint: string
  method: 'GET' | 'POST'
  truncated: boolean
}

export type ComaxLabRunResponse =
  | { configured: true; comax: ComaxUpstream; block: ComaxLabBlock }
  | { configured: false; error: string }

export interface ComaxAuthPayload {
  loginId?: string
  loginPassword?: string
  /** Comax ארגון — server builds LoginID as org\\user when set (unless loginId already contains \\ or /). */
  organization?: string
}

export const postComaxCustomersSearch = (
  payload: ComaxAuthPayload & {
    mobile?: string
    email?: string
    phone?: string
    id?: string
    name?: string
    city?: string
    groupId?: string
  },
) => api.post<ComaxLabRunResponse>('/admin/comax/customers/search', payload).then((r) => r.data)

export const postComaxCustomerById = (payload: ComaxAuthPayload & { customerId: string }) =>
  api.post<ComaxLabRunResponse>('/admin/comax/customers/by-id', payload).then((r) => r.data)

export const postComaxOrders = (payload: ComaxAuthPayload & { fromDate: string; toDate: string }) =>
  api.post<ComaxLabRunResponse>('/admin/comax/orders', payload).then((r) => r.data)

export const postComaxItems = (payload: ComaxAuthPayload & { storeId: string }) =>
  api.post<ComaxLabRunResponse>('/admin/comax/items', payload).then((r) => r.data)
