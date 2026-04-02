export type { Order, OrderItem, OrderStatus } from './models/order'
import type { Order } from './models/order'
import { isPickerActiveOrder } from './orderLifecycle'
import { getOrderPersistence } from './persistence/orderPersistence'

/** Match picker id from Firestore to login id (handles 1 vs "1" vs "001"). */
export function sameCollectorAssigned(assignedTo: unknown, collectorId: string): boolean {
  const a = assignedTo == null ? '' : String(assignedTo).trim()
  const b = String(collectorId ?? '').trim()
  if (!a || !b) return false
  if (a === b) return true
  const da = a.replace(/^0+/, '') || '0'
  const db = b.replace(/^0+/, '') || '0'
  if (/^\d+$/.test(da) && /^\d+$/.test(db) && da === db) return true
  return false
}

export async function readOrders(): Promise<Order[]> {
  return getOrderPersistence().list()
}

export async function findOrder(id: string): Promise<Order | undefined> {
  return getOrderPersistence().get(id)
}

export async function saveOrder(order: Order): Promise<void> {
  return getOrderPersistence().put(order)
}

/**
 * All orders assigned to this collector (`assigned` or `in_progress`), sorted so index 0 is the one
 * they should work on first. Same priority as before: in_progress, then syncedAt, startedAt, wcOrderId.
 */
export function listAssignedOrdersForCollector(
  orders: Order[],
  collectorId: string
): Order[] {
  const mine = orders.filter(
    o => sameCollectorAssigned(o.assignedTo, collectorId) && isPickerActiveOrder(o)
  )
  if (mine.length <= 1) return mine

  const t = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : 0)

  return [...mine].sort((a, b) => {
    const aLive = a.status === 'in_progress' || a.status === 'waiting_cs' ? 1 : 0
    const bLive = b.status === 'in_progress' || b.status === 'waiting_cs' ? 1 : 0
    if (aLive !== bLive) return bLive - aLive
    const bySynced = t(b.syncedAt) - t(a.syncedAt)
    if (bySynced !== 0) return bySynced
    const byStarted = t(b.startedAt) - t(a.startedAt)
    if (byStarted !== 0) return byStarted
    return (b.wcOrderId ?? 0) - (a.wcOrderId ?? 0)
  })
}

export function selectAssignedOrderForCollector(
  orders: Order[],
  collectorId: string
): Order | undefined {
  const list = listAssignedOrdersForCollector(orders, collectorId)
  return list[0]
}

export async function getAssignedOrder(collectorId: string): Promise<Order | undefined> {
  const orders = await readOrders()
  return selectAssignedOrderForCollector(orders, collectorId)
}
