import type { Shift } from './models/shift'
import { getShiftPersistence } from './persistence/shiftPersistence'

/**
 * One open shift per collector. If already open, returns the existing record (idempotent).
 */
export async function startCollectorShift(collectorId: string): Promise<Shift> {
  const p = getShiftPersistence()
  const existing = await p.findOpenByCollector(collectorId)
  if (existing) return existing
  return p.createOpen(collectorId, new Date().toISOString())
}

/** Closes the collector's open shift, if any. */
export async function endCollectorShift(collectorId: string): Promise<Shift | null> {
  const p = getShiftPersistence()
  const open = await p.findOpenByCollector(collectorId)
  if (!open) return null
  const endedAt = new Date().toISOString()
  await p.close(open.id, endedAt)
  return { ...open, open: false, endedAt }
}

export async function getOpenShiftForCollector(collectorId: string): Promise<Shift | null> {
  const s = await getShiftPersistence().findOpenByCollector(collectorId)
  return s ?? null
}

export async function getLatestClosedShiftForCollector(collectorId: string): Promise<Shift | null> {
  const s = await getShiftPersistence().findLatestClosedByCollector(collectorId)
  return s ?? null
}
