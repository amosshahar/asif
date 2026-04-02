import type { Order } from '../models/order'
import { getFirestoreDb } from '../firebaseAdmin'
import { ASIF_ORDERS_COLLECTION } from '../firestoreCollections'

export interface OrderPersistence {
  list(): Promise<Order[]>
  get(id: string): Promise<Order | undefined>
  put(order: Order): Promise<void>
}

export class FirestoreOrderPersistence implements OrderPersistence {
  private col() {
    return getFirestoreDb().collection(ASIF_ORDERS_COLLECTION)
  }

  async list(): Promise<Order[]> {
    const snap = await this.col().get()
    const out: Order[] = []
    snap.forEach(doc => {
      const d = doc.data() as Order | undefined
      if (!d) return
      // Prefer `id` on the document; fall back to Firestore doc id (some writes omit `id` in payload).
      const id = (d.id && String(d.id)) || doc.id
      if (!id) return
      const assignedTo =
        d.assignedTo == null || d.assignedTo === ''
          ? null
          : String(d.assignedTo).trim()
      out.push({ ...d, id, assignedTo })
    })
    return out
  }

  async get(orderId: string): Promise<Order | undefined> {
    const doc = await this.col().doc(orderId).get()
    if (!doc.exists) return undefined
    const d = doc.data() as Order | undefined
    if (!d) return undefined
    const id = (d.id && String(d.id)) || doc.id
    const assignedTo =
      d.assignedTo == null || d.assignedTo === ''
        ? null
        : String(d.assignedTo).trim()
    return { ...d, id, assignedTo }
  }

  async put(order: Order): Promise<void> {
    await this.col().doc(order.id).set(order)
  }
}

let cached: OrderPersistence | null = null

export function getOrderPersistence(): OrderPersistence {
  if (!cached) cached = new FirestoreOrderPersistence()
  return cached
}
