import type { Order } from './models/order'
import { readOrders, sameCollectorAssigned } from './orders'

export interface ShiftEndSummary {
  /** Orders submitted by this collector during the shift window (completed or waiting_cs). */
  ordersFinished: number
  /** Wall-clock shift length in minutes (endedAt − startedAt). */
  totalShiftMinutes: number
  /** Average (completedAt − order.startedAt) in minutes; null if no order had startedAt. */
  averageOrderMinutes: number | null
}

export async function buildShiftEndSummary(
  collectorId: string,
  shiftStartedAt: string,
  shiftEndedAt: string
): Promise<ShiftEndSummary> {
  const startMs = Date.parse(shiftStartedAt)
  const endMs = Date.parse(shiftEndedAt)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return { ordersFinished: 0, totalShiftMinutes: 0, averageOrderMinutes: null }
  }

  const all = await readOrders()
  const picked = all.filter((o: Order) => {
    if (!o.completedAt || !sameCollectorAssigned(o.assignedTo, collectorId)) return false
    if (o.status !== 'completed' && o.status !== 'waiting_cs') return false
    const c = Date.parse(o.completedAt)
    return Number.isFinite(c) && c >= startMs && c <= endMs
  })

  const orderDurationsMin: number[] = []
  for (const o of picked) {
    if (!o.startedAt || !o.completedAt) continue
    const a = Date.parse(o.startedAt)
    const b = Date.parse(o.completedAt)
    const mins = (b - a) / 60000
    if (Number.isFinite(mins) && mins >= 0) orderDurationsMin.push(mins)
  }

  const totalShiftMinutes = Math.round(((endMs - startMs) / 60000) * 10) / 10
  const averageOrderMinutes =
    orderDurationsMin.length > 0
      ? Math.round((orderDurationsMin.reduce((x, y) => x + y, 0) / orderDurationsMin.length) * 10) /
        10
      : null

  return {
    ordersFinished: picked.length,
    totalShiftMinutes,
    averageOrderMinutes,
  }
}
