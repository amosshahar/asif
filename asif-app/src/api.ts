import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3002' })

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
  customerNote: string
  status: 'pending' | 'collected' | 'missing'
  collectedQuantity: number | null
  collectedWeight: number | null
  collectionMethod: 'scan' | 'manual' | 'scale' | null
  missingReason?: string
}

export interface Order {
  id: string
  customerName: string
  status: 'queued' | 'assigned' | 'in_progress' | 'completed'
  assignedTo: string | null
  startedAt: string | null
  completedAt: string | null
  items: OrderItem[]
  wcOrderId?: number
  wcStatus?: string
  syncedAt?: string
}

export const login = (id: string, pin: string) =>
  api.post<AuthUser>('/auth/login', { id, pin }).then(r => r.data)

export const getMyOrder = (collectorId: string) =>
  api.get<Order>(`/orders/my?collectorId=${collectorId}`).then(r => r.data)

export const startOrder = (orderId: string) =>
  api.post<Order>(`/orders/${orderId}/start`).then(r => r.data)

export const updateItem = (
  orderId: string,
  itemId: string,
  payload: Partial<Pick<OrderItem, 'status' | 'collectedQuantity' | 'collectedWeight' | 'collectionMethod' | 'missingReason'>>
) => api.patch<OrderItem>(`/orders/${orderId}/items/${itemId}`, payload).then(r => r.data)

export const completeOrder = (orderId: string) =>
  api.post<Order>(`/orders/${orderId}/complete`).then(r => r.data)
