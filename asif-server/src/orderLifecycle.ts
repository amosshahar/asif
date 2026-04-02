import type { Order } from './models/order'

export function orderHasAnyMissing(order: Order): boolean {
  return order.items.some(i => i.status === 'missing')
}

/** True if the order should be treated as customer-service handoff (missing lines or collector note). */
export function orderNeedsCustomerServiceHandoff(order: Order): boolean {
  return orderHasAnyMissing(order) || Boolean((order.csHandoffReason ?? '').trim())
}

export function allItemsResolved(order: Order): boolean {
  return order.items.length > 0 && order.items.every(i => i.status === 'collected' || i.status === 'missing')
}

/** Picker-visible: assigned / in progress / shortage handling, and not yet submitted. */
export function isPickerActiveOrder(order: Order): boolean {
  if (order.completedAt) return false
  return (
    order.status === 'assigned' ||
    order.status === 'in_progress' ||
    order.status === 'waiting_cs'
  )
}

/**
 * When any line is missing or `csHandoffReason` is set → `waiting_cs`.
 * When neither applies → restore `assigned` / `in_progress` from `startedAt`.
 */
export function syncOrderStatusForShortages(order: Order): void {
  if (order.status === 'queued' || order.status === 'completed') return

  const needsCs = orderNeedsCustomerServiceHandoff(order)
  if (needsCs) {
    if (order.status === 'assigned' || order.status === 'in_progress') {
      order.status = 'waiting_cs'
    }
    return
  }

  if (order.status === 'waiting_cs' && !order.completedAt) {
    order.status = order.startedAt ? 'in_progress' : 'assigned'
  }
}

/** On submit: all lines must be collected or missing; terminal status completed vs waiting_cs. */
export function applyOrderCompletion(order: Order): 'completed' | 'waiting_cs' {
  order.completedAt = new Date().toISOString()
  order.status = orderNeedsCustomerServiceHandoff(order) ? 'waiting_cs' : 'completed'
  return order.status
}
