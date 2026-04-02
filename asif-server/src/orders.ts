import fs from 'fs'
import path from 'path'

const FILE = path.join(__dirname, '../data/orders.json')

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
  status: 'assigned' | 'in_progress' | 'completed'
  assignedTo: string | null
  startedAt: string | null
  completedAt: string | null
  items: OrderItem[]
}

export function readOrders(): Order[] {
  return JSON.parse(fs.readFileSync(FILE, 'utf-8'))
}

export function writeOrders(orders: Order[]): void {
  fs.writeFileSync(FILE, JSON.stringify(orders, null, 2), 'utf-8')
}

export function findOrder(id: string): Order | undefined {
  return readOrders().find(o => o.id === id)
}

export function getAssignedOrder(collectorId: string): Order | undefined {
  return readOrders().find(
    o => o.assignedTo === collectorId && o.status !== 'completed'
  )
}
