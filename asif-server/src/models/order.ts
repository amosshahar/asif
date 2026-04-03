/**
 * Picking workflow. `queued` = imported from WC, not yet assigned.
 * `waiting_cs` = at least one line missing OR collector set `csHandoffReason`; picker may continue until submit.
 */
export type OrderStatus = 'queued' | 'assigned' | 'in_progress' | 'waiting_cs' | 'completed'

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
  /** יחידות שהוזמנו — בעיקר לשורות שקיל כשמגיעות ממטא WC (ליד משקל כולל). */
  orderedPiecesCount?: number | null
  /** משקל מצטבר שהוזמן (ק״ג) לתצוגת מלקט; יעד לשקילה נשאר `quantity` + `unit`. */
  orderedTotalWeightKg?: number | null
  customerNote: string
  status: 'pending' | 'collected' | 'missing'
  collectedQuantity: number | null
  collectedWeight: number | null
  collectionMethod: 'scan' | 'manual' | 'scale' | null
  missingReason?: string
  /** Set when collector confirms collected weight beyond ±20% of ordered qty (audit). */
  weightDeviationAcknowledged?: boolean
  /** ISO time when line was first marked collected/missing (inter-item timing). Cleared when back to pending. */
  pickedAt?: string | null
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
  /** WC order `date_created` (ISO) — when the customer submitted the order. */
  wcDateCreated?: string | null
  /** אזור חלוקה — from WC order meta (see WC_META_KEYS_*) or shipping/billing city fallback. */
  distributionArea?: string | null
  /** משלוח: עיר (WC shipping, גיבוי billing). */
  shippingCity?: string | null
  /** משלוח: רחוב (address_1 + address_2, shipping ואז billing). */
  shippingStreet?: string | null
  /** תאריך חלוקה YYYY-MM-DD — meta or WC date_created date. */
  deliveryDate?: string | null
  /** תחילת חלון שעות HH:mm — meta. */
  deliveryTimeFrom?: string | null
  /** סוף חלון שעות HH:mm — meta. */
  deliveryTimeTo?: string | null
  /** הערת מלקט: למה להעביר לשירות לקוחות (גם בלי שורות חסרות). */
  csHandoffReason?: string | null
  /** הערת לקוח מההזמנה ב־WooCommerce (`customer_note`). */
  customerNote?: string | null
}
