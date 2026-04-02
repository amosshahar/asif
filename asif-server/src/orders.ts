export type { Order, OrderItem, OrderStatus } from './models/order'
import type { Order } from './models/order'
import { getOrderPersistence } from './persistence/orderPersistence'

export async function readOrders(): Promise<Order[]> {
  return getOrderPersistence().list()
}

export async function findOrder(id: string): Promise<Order | undefined> {
  return getOrderPersistence().get(id)
}

export async function saveOrder(order: Order): Promise<void> {
  return getOrderPersistence().put(order)
}

export async function getAssignedOrder(collectorId: string): Promise<Order | undefined> {
  const orders = await readOrders()
  return orders.find(
    o =>
      o.assignedTo === collectorId &&
      (o.status === 'assigned' || o.status === 'in_progress')
  )
}
