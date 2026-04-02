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
      const d = doc.data() as Order
      if (d && d.id) out.push(d)
    })
    return out
  }

  async get(id: string): Promise<Order | undefined> {
    const doc = await this.col().doc(id).get()
    if (!doc.exists) return undefined
    return doc.data() as Order
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
