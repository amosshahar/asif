/** Picking workflow. `queued` = imported from WC, not yet assigned to a picker. */
export type OrderStatus = 'queued' | 'assigned' | 'in_progress' | 'completed'

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
  status: OrderStatus
  assignedTo: string | null
  startedAt: string | null
  completedAt: string | null
  items: OrderItem[]
  /** WooCommerce source order id (when imported from WC). */
  wcOrderId?: number
  /** Last known WC status slug (e.g. processing). */
  wcStatus?: string
  /** When this document was last synced from WooCommerce. */
  syncedAt?: string
}
