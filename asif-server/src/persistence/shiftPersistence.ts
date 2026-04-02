import type { Shift } from '../models/shift'
import { getFirestoreDb } from '../firebaseAdmin'
import { ASIF_SHIFTS_COLLECTION } from '../firestoreCollections'

export interface ShiftPersistence {
  findOpenByCollector(collectorId: string): Promise<Shift | undefined>
  findLatestClosedByCollector(collectorId: string): Promise<Shift | undefined>
  createOpen(collectorId: string, startedAt: string): Promise<Shift>
  close(shiftId: string, endedAt: string): Promise<void>
}

function docToShift(id: string, d: Record<string, unknown>): Shift {
  return {
    id,
    collectorId: String(d.collectorId ?? ''),
    startedAt: String(d.startedAt ?? ''),
    endedAt: d.endedAt != null ? String(d.endedAt) : null,
    open: d.open === true,
  }
}

export class FirestoreShiftPersistence implements ShiftPersistence {
  private col() {
    return getFirestoreDb().collection(ASIF_SHIFTS_COLLECTION)
  }

  async findOpenByCollector(collectorId: string): Promise<Shift | undefined> {
    const snap = await this.col()
      .where('collectorId', '==', collectorId)
      .where('open', '==', true)
      .limit(1)
      .get()
    if (snap.empty) return undefined
    const doc = snap.docs[0]
    const data = doc.data() as Record<string, unknown>
    return docToShift(doc.id, data)
  }

  async findLatestClosedByCollector(collectorId: string): Promise<Shift | undefined> {
    const snap = await this.col()
      .where('collectorId', '==', collectorId)
      .where('open', '==', false)
      .get()
    let best: Shift | undefined
    let bestEndMs = -1
    for (const doc of snap.docs) {
      const data = doc.data() as Record<string, unknown>
      const endedRaw = data.endedAt
      if (endedRaw == null) continue
      const endMs = Date.parse(String(endedRaw))
      if (!Number.isFinite(endMs) || endMs < bestEndMs) continue
      bestEndMs = endMs
      best = docToShift(doc.id, data)
    }
    return best
  }

  async createOpen(collectorId: string, startedAt: string): Promise<Shift> {
    const ref = this.col().doc()
    const shift: Shift = {
      id: ref.id,
      collectorId,
      startedAt,
      endedAt: null,
      open: true,
    }
    await ref.set({
      id: shift.id,
      collectorId: shift.collectorId,
      startedAt: shift.startedAt,
      open: true,
    })
    return shift
  }

  async close(shiftId: string, endedAt: string): Promise<void> {
    await this.col().doc(shiftId).update({
      open: false,
      endedAt,
    })
  }
}

let cached: ShiftPersistence | null = null

export function getShiftPersistence(): ShiftPersistence {
  if (!cached) cached = new FirestoreShiftPersistence()
  return cached
}
