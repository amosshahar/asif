import axios from 'axios'
import { Capacitor } from '@capacitor/core'
import { Device } from '@capacitor/device'

function trimBase(u: string): string {
  return u.replace(/\/$/, '')
}

/**
 * Production builds embed both URLs. On a real iPhone we use production; on iOS Simulator we use
 * the Mac loopback so `asif-server` on the host is reachable. Override: `VITE_FORCE_DEVICE_API=true`.
 */
async function resolveApiBaseUrl(): Promise<string> {
  if (import.meta.env.DEV) {
    return trimBase(import.meta.env.VITE_API_URL ?? 'http://localhost:3002')
  }

  const prod = trimBase(
    import.meta.env.VITE_API_URL_PRODUCTION || import.meta.env.VITE_API_URL || ''
  )
  const sim = trimBase(import.meta.env.VITE_API_URL_SIMULATOR || 'http://127.0.0.1:3002')

  if (import.meta.env.VITE_FORCE_DEVICE_API === 'true') {
    return prod || sim
  }

  if (Capacitor.isNativePlatform()) {
    try {
      const info = await Device.getInfo()
      if (info.isVirtual === true) {
        if (Capacitor.getPlatform() === 'ios') return sim
        if (Capacitor.getPlatform() === 'android') {
          return trimBase(
            import.meta.env.VITE_API_URL_ANDROID_EMULATOR || 'http://10.0.2.2:3002'
          )
        }
      }
    } catch {
      /* fall through to prod */
    }
  }

  return prod || sim
}

let cachedBase: string | null = null
let baseInflight: Promise<string> | null = null

export async function getApiBaseUrl(): Promise<string> {
  if (cachedBase) return cachedBase
  if (!baseInflight) {
    baseInflight = resolveApiBaseUrl().then((url) => {
      cachedBase = url
      return url
    })
  }
  return baseInflight
}

const api = axios.create()

api.interceptors.request.use(async (config) => {
  config.baseURL = await getApiBaseUrl()
  return config
})

export interface AuthUser {
  id: string
  name: string
  role: 'collector' | 'manager' | 'customer_service'
}

export interface OrderItem {
  id: string
  sku: string
  name: string
  brand: string
  quantity: number
  unit: 'piece' | 'kg' | 'g'
  barcode: string
  imageUrl: string
  location: { aisle: number; label: string }
  orderedPiecesCount?: number | null
  orderedTotalWeightKg?: number | null
  customerNote: string
  status: 'pending' | 'collected' | 'missing'
  collectedQuantity: number | null
  collectedWeight: number | null
  collectionMethod: 'scan' | 'manual' | 'scale' | null
  missingReason?: string
  weightDeviationAcknowledged?: boolean
  pickedAt?: string | null
}

export type UpdateItemPayload = Partial<
  Pick<
    OrderItem,
    | 'status'
    | 'collectedQuantity'
    | 'collectedWeight'
    | 'collectionMethod'
    | 'missingReason'
  >
> & {
  acknowledgeWeightDeviation?: boolean
}

export interface Order {
  id: string
  customerName: string
  status: 'queued' | 'assigned' | 'in_progress' | 'waiting_cs' | 'completed'
  assignedTo: string | null
  startedAt: string | null
  completedAt: string | null
  items: OrderItem[]
  wcOrderId?: number
  wcStatus?: string
  syncedAt?: string
  distributionArea?: string | null
  shippingCity?: string | null
  shippingStreet?: string | null
  deliveryDate?: string | null
  deliveryTimeFrom?: string | null
  deliveryTimeTo?: string | null
  wcDateCreated?: string | null
  /** הערת מלקט — העברה לשירות לקוחות גם בלי פריט חסר. */
  csHandoffReason?: string | null
  /** הערת לקוח על ההזמנה (מ־WooCommerce). */
  customerNote?: string | null
}

export const login = (id: string, pin: string) =>
  api.post<AuthUser>('/auth/login', { id, pin }).then(r => r.data)

export interface MyOrdersPayload {
  orders: Order[]
  activeOrderId: string | null
}

export const getMyOrders = (collectorId: string) =>
  api
    .get<unknown>(`/orders/my?collectorId=${encodeURIComponent(collectorId)}`)
    .then((r) => {
      const d = r.data as Record<string, unknown>
      if (d && Array.isArray(d.orders)) {
        return {
          orders: d.orders as Order[],
          activeOrderId: (d.activeOrderId as string | null) ?? null,
        }
      }
      // Legacy server: single Order JSON (no wrapper)
      if (d && typeof d.id === 'string' && Array.isArray((d as unknown as Order).items)) {
        const o = d as unknown as Order
        return { orders: [o], activeOrderId: o.id }
      }
      return { orders: [], activeOrderId: null }
    })

export const startOrder = (orderId: string) =>
  api.post<Order>(`/orders/${orderId}/start`).then(r => r.data)

export const updateItem = (orderId: string, itemId: string, payload: UpdateItemPayload) =>
  api.patch<OrderItem>(`/orders/${orderId}/items/${itemId}`, payload).then((r) => r.data)

export const completeOrder = (orderId: string) =>
  api.post<Order>(`/orders/${orderId}/complete`).then(r => r.data)

/** `reason` ריק מנקה הערה רק אם אין פריטים חסרים (אחרת ההזמנה נשארת ב־waiting_cs). */
export const setCustomerServiceHandoff = (orderId: string, reason: string) =>
  api.post<Order>(`/orders/${orderId}/customer-service-handoff`, { reason }).then((r) => r.data)

export interface Shift {
  id: string
  collectorId: string
  startedAt: string
  endedAt: string | null
  open: boolean
}

export interface ShiftEndSummary {
  ordersFinished: number
  totalShiftMinutes: number
  averageOrderMinutes: number | null
}

export const startCollectorShift = (collectorId: string) =>
  api.post<Shift>('/shifts/start', { collectorId }).then((r) => r.data)

export const endCollectorShift = (collectorId: string) =>
  api
    .post<{
      ok: boolean
      shift: Shift | null
      summary: ShiftEndSummary | null
    }>('/shifts/end', { collectorId })
    .then((r) => r.data)

export const getCurrentShift = (collectorId: string) =>
  api
    .get<Shift | null>(`/shifts/current?collectorId=${encodeURIComponent(collectorId)}`)
    .then((r) => r.data)

/** משמרת פעילה: סיכום עד עכשיו (לא סופי). בלי משמרת פעילה: משמרת אחרונה סגורה (סופי) אם קיימת. */
export interface ShiftStatsPayload {
  shiftOpen: boolean
  finalized: boolean
  shiftStartedAt: string | null
  shiftEndedAt: string | null
  summary: ShiftEndSummary | null
}

export const getShiftStats = (collectorId: string) =>
  api
    .get<ShiftStatsPayload>(`/shifts/stats?collectorId=${encodeURIComponent(collectorId)}`)
    .then((r) => r.data)
