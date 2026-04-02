import type { OrderItem } from './models/order'

/** Max relative deviation vs ordered quantity for weighed lines (kg/g) when using scale. */
export const WEIGHT_DEVIATION_MAX = 0.2

export function isWeighedUnit(unit: OrderItem['unit']): boolean {
  return unit === 'kg' || unit === 'g'
}

/** Relative deviation |actual − target| / target, or null if rule does not apply. */
export function weightDeviationRatio(item: OrderItem, actualWeight: number): number | null {
  if (!isWeighedUnit(item.unit)) return null
  const target = item.quantity
  if (!(target > 0) || !(actualWeight > 0) || !Number.isFinite(actualWeight)) return null
  return Math.abs(actualWeight - target) / target
}

/** True if scale collection with weight exceeds ±20% vs ordered quantity. */
export function isWeightDeviationOverLimit(item: OrderItem, collectedWeight: number): boolean {
  const r = weightDeviationRatio(item, collectedWeight)
  if (r == null) return false
  return r > WEIGHT_DEVIATION_MAX
}
