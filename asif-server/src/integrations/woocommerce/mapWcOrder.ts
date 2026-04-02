import type { Order, OrderItem } from '../../models/order'
import type { WcLineItem, WcOrder } from './types'

export function wcOrderDocId(wcNumericId: number): string {
  return `wc-${wcNumericId}`
}

function lineMeta(line: WcLineItem, key: string): string {
  const md = line.meta_data ?? []
  const hit = md.find(m => m.key === key)
  if (hit == null) return ''
  const v = hit.value
  if (v == null) return ''
  return typeof v === 'string' ? v : String(v)
}

function inferUnit(line: WcLineItem): 'piece' | 'kg' | 'g' {
  const w = lineMeta(line, '_weight') || lineMeta(line, 'weight')
  if (w && parseFloat(w) > 0) return 'kg'
  const u = lineMeta(line, '_unit').toLowerCase()
  if (u === 'g' || u === 'gram' || u === 'grams') return 'g'
  if (u === 'kg' || u === 'kilogram') return 'kg'
  return 'piece'
}

function mapLine(line: WcLineItem): OrderItem {
  const unit = inferUnit(line)
  const qty = Number(line.quantity) || 0
  return {
    id: `wc-li-${line.id}`,
    sku: line.sku ?? '',
    name: line.name ?? '',
    brand: lineMeta(line, 'brand'),
    quantity: unit === 'piece' ? Math.max(1, Math.round(qty)) : qty,
    unit,
    barcode: lineMeta(line, '_barcode') || lineMeta(line, 'barcode'),
    imageUrl: line.image?.src ?? '',
    location: { aisle: 0, label: '—' },
    customerNote:
      lineMeta(line, 'הערות') ||
      lineMeta(line, 'note') ||
      lineMeta(line, 'customer_note') ||
      lineMeta(line, '_customer_note'),
    status: 'pending',
    collectedQuantity: null,
    collectedWeight: null,
    collectionMethod: null,
  }
}

export function mapWcOrderToOrder(wc: WcOrder): Order {
  const first = wc.billing?.first_name?.trim() ?? ''
  const last = wc.billing?.last_name?.trim() ?? ''
  const customerName = [first, last].filter(Boolean).join(' ').trim() || 'לקוח'

  return {
    id: wcOrderDocId(wc.id),
    customerName,
    status: 'queued',
    assignedTo: null,
    startedAt: null,
    completedAt: null,
    items: (wc.line_items ?? []).map(mapLine),
    wcOrderId: wc.id,
    wcStatus: wc.status,
    syncedAt: new Date().toISOString(),
  }
}
