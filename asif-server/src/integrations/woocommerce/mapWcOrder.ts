import type { Order, OrderItem } from '../../models/order'
import { loadWcOrderMetaKeyLists } from './config'
import type { WcLineItem, WcOrder } from './types'

export function wcOrderDocId(wcNumericId: number): string {
  return `wc-${wcNumericId}`
}

let metaKeysCache: ReturnType<typeof loadWcOrderMetaKeyLists> | null = null
function wcMetaKeys() {
  if (!metaKeysCache) metaKeysCache = loadWcOrderMetaKeyLists()
  return metaKeysCache
}

function metaEntryValue(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (typeof v === 'object' && v !== null) {
    const o = v as Record<string, unknown>
    if (typeof o.value === 'string') return o.value.trim()
  }
  return ''
}

function orderMetaByKeys(wc: WcOrder, keys: string[]): string {
  const md = wc.meta_data ?? []
  for (const key of keys) {
    const hit = md.find((m) => m.key === key)
    if (!hit) continue
    const s = metaEntryValue(hit.value)
    if (s) return s
  }
  return ''
}

function normalizeTimeString(raw: string): string | null {
  const t = raw.trim()
  const m = t.match(/^(\d{1,2})\s*:\s*(\d{2})/)
  if (!m) return null
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)))
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)))
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function normalizeDateYyyyMmDd(raw: string): string | null {
  const s = raw.trim()
  const isoLike = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoLike) return `${isoLike[1]}-${isoLike[2]}-${isoLike[3]}`
  const eu = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  if (eu) {
    const d = parseInt(eu[1], 10)
    const mo = parseInt(eu[2], 10)
    const y = eu[3]
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) {
      return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
  }
  return null
}

function dateFromWcCreated(dateCreated: string): string | null {
  if (!dateCreated || dateCreated.length < 10) return null
  return normalizeDateYyyyMmDd(dateCreated.slice(0, 10))
}

/**
 * One meta value like `06/04/2026 - 11:00 - 16:00` (DD/MM/YYYY — common in IL checkout UIs).
 */
function parseCombinedShippingSlotString(raw: string): {
  deliveryDate: string
  deliveryTimeFrom: string | null
  deliveryTimeTo: string | null
} | null {
  const t = raw.trim()
  const m = t.match(
    /^(\d{1,2}\/\d{1,2}\/\d{4})\s*-\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*$/u
  )
  if (!m) return null
  const deliveryDate = normalizeDateYyyyMmDd(m[1])
  if (!deliveryDate) return null
  return {
    deliveryDate,
    deliveryTimeFrom: normalizeTimeString(m[2]),
    deliveryTimeTo: normalizeTimeString(m[3]),
  }
}

function tryCombinedShippingSlotFromWc(wc: WcOrder): ReturnType<
  typeof parseCombinedShippingSlotString
> | null {
  const keys = wcMetaKeys()
  if (keys.shippingSlotCombined.length > 0) {
    const explicit = orderMetaByKeys(wc, keys.shippingSlotCombined).trim()
    if (explicit) {
      const p = parseCombinedShippingSlotString(explicit)
      if (p) return p
    }
  }
  const md = wc.meta_data ?? []
  for (const row of md) {
    const s = metaEntryValue(row.value).trim()
    if (s.length < 12) continue
    const p = parseCombinedShippingSlotString(s)
    if (p) return p
  }
  return null
}

function logisticsFromWc(wc: WcOrder): Pick<
  Order,
  'distributionArea' | 'deliveryDate' | 'deliveryTimeFrom' | 'deliveryTimeTo'
> {
  const keys = wcMetaKeys()
  const fromMeta = orderMetaByKeys(wc, keys.distributionArea).trim()
  const fromShip = wc.shipping?.city?.trim() ?? ''
  const fromBill = wc.billing?.city?.trim() ?? ''
  let distributionArea: string | null = fromMeta || fromShip || fromBill || null
  if (distributionArea === '') distributionArea = null

  const combined = tryCombinedShippingSlotFromWc(wc)

  let deliveryDate: string | null = null
  let deliveryTimeFrom: string | null = null
  let deliveryTimeTo: string | null = null

  if (combined) {
    deliveryDate = combined.deliveryDate
    deliveryTimeFrom = combined.deliveryTimeFrom
    deliveryTimeTo = combined.deliveryTimeTo
  } else {
    const dateRaw = orderMetaByKeys(wc, keys.deliveryDate).trim()
    deliveryDate =
      (dateRaw ? normalizeDateYyyyMmDd(dateRaw) : null) ??
      dateFromWcCreated(wc.date_created) ??
      null

    const fromRaw = orderMetaByKeys(wc, keys.deliveryTimeFrom).trim()
    const toRaw = orderMetaByKeys(wc, keys.deliveryTimeTo).trim()

    deliveryTimeFrom = fromRaw ? normalizeTimeString(fromRaw) : null
    deliveryTimeTo = toRaw ? normalizeTimeString(toRaw) : null

    if (!deliveryTimeFrom && !deliveryTimeTo) {
      const span = fromRaw || toRaw
      const range = span.match(
        /^(\d{1,2}\s*:\s*\d{2})\s*[-–]\s*(\d{1,2}\s*:\s*\d{2})/
      )
      if (range) {
        deliveryTimeFrom = normalizeTimeString(range[1])
        deliveryTimeTo = normalizeTimeString(range[2])
      }
    }
  }

  return {
    distributionArea,
    deliveryDate,
    deliveryTimeFrom,
    deliveryTimeTo,
  }
}

function lineMeta(line: WcLineItem, key: string): string {
  const md = line.meta_data ?? []
  const hit = md.find(m => m.key === key)
  if (hit == null) return ''
  const v = hit.value
  if (v == null) return ''
  return typeof v === 'string' ? v : String(v)
}

function parseLocalizedNumber(raw: string): number | null {
  const s = raw.trim().replace(/,/g, '.')
  const n = parseFloat(s)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** First positive number from line meta keys (store-specific extensions). */
function lineMetaNumber(line: WcLineItem, keys: string[]): number | null {
  for (const k of keys) {
    const s = lineMeta(line, k)
    if (!s) continue
    const n = parseLocalizedNumber(s)
    if (n != null && n > 0) return n
  }
  return null
}

function imageUrlFromLine(line: WcLineItem): string {
  const fromApi = (line.image?.src ?? '').trim()
  if (fromApi) return fromApi
  for (const k of ['_image_url', 'product_image_url', 'Product image', 'תמונה']) {
    const m = lineMeta(line, k).trim()
    if (m.startsWith('http://') || m.startsWith('https://')) return m
  }
  return ''
}

function locationFromLine(line: WcLineItem): { aisle: number; label: string } {
  const candidates = [
    lineMeta(line, 'מיקום'),
    lineMeta(line, 'location'),
    lineMeta(line, '_pick_location'),
    lineMeta(line, 'איזור'),
    lineMeta(line, 'aisle'),
    lineMeta(line, 'מדף'),
    lineMeta(line, 'shelf'),
    lineMeta(line, 'מיקום במחסן'),
  ]
  const raw = candidates.map(s => s.trim()).find(Boolean) ?? ''
  if (!raw) return { aisle: 0, label: '—' }
  const m = raw.match(/\d+/)
  const aisle = m ? parseInt(m[0], 10) : 0
  return { aisle: Number.isFinite(aisle) ? aisle : 0, label: raw }
}

function lineCustomerNote(line: WcLineItem): string {
  return (
    lineMeta(line, 'הערות') ||
    lineMeta(line, 'הערה') ||
    lineMeta(line, 'note') ||
    lineMeta(line, 'customer_note') ||
    lineMeta(line, '_customer_note') ||
    lineMeta(line, 'Customer note') ||
    lineMeta(line, 'הערות לפריט') ||
    ''
  ).trim()
}

/** Classify line as piece vs weight sale. Today: line item meta only (`_weight`, `weight`, `_unit`).
 * If pickers see wrong "שקול" / אסוף behavior, extend here (e.g. WC line `weight`, product sold-by-weight,
 * or store-specific meta keys) — client only reads resulting `unit`. */
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
  const quantity = unit === 'piece' ? Math.max(1, Math.round(qty)) : qty

  const piecesFromMeta = lineMetaNumber(line, [
    'יחידות',
    'pieces',
    '_pieces',
    'כמות_יחידות',
    'Units',
    'כמות יחידות',
    '_number_of_items',
  ])
  const totalKgFromMeta = lineMetaNumber(line, [
    'משקל_כולל',
    'total_weight_kg',
    '_total_weight_kg',
    'סהכ_משקל',
    'סה״כ משקל',
    'סה"כ משקל',
    'ordered_weight_kg',
  ])

  let orderedPiecesCount: number | null = null
  let orderedTotalWeightKg: number | null = null
  if (unit === 'piece') {
    orderedPiecesCount = quantity
  } else {
    if (piecesFromMeta != null) orderedPiecesCount = Math.round(piecesFromMeta)
    if (totalKgFromMeta != null) orderedTotalWeightKg = totalKgFromMeta
    else if (unit === 'kg') orderedTotalWeightKg = qty
    else orderedTotalWeightKg = qty > 0 ? qty / 1000 : null
  }

  return {
    id: `wc-li-${line.id}`,
    sku: line.sku ?? '',
    name: line.name ?? '',
    brand: lineMeta(line, 'brand'),
    quantity,
    unit,
    barcode:
      lineMeta(line, '_barcode') ||
      lineMeta(line, 'barcode') ||
      (line.sku != null ? String(line.sku).trim() : ''),
    imageUrl: imageUrlFromLine(line),
    location: locationFromLine(line),
    orderedPiecesCount,
    orderedTotalWeightKg,
    customerNote: lineCustomerNote(line),
    status: 'pending',
    collectedQuantity: null,
    collectedWeight: null,
    collectionMethod: null,
  }
}

function shippingCityStreetFromWc(wc: WcOrder): {
  shippingCity: string | null
  shippingStreet: string | null
} {
  const ship = wc.shipping
  const bill = wc.billing
  const city =
    (ship?.city ?? bill?.city ?? '').trim().replace(/\s+/g, ' ') || null
  const a1 = (ship?.address_1 ?? bill?.address_1 ?? '').trim()
  const a2 = (ship?.address_2 ?? bill?.address_2 ?? '').trim()
  const street =
    [a1, a2].filter(Boolean).join(', ').replace(/\s+/g, ' ').trim() || null
  return { shippingCity: city, shippingStreet: street }
}

export function mapWcOrderToOrder(wc: WcOrder): Order {
  const first = wc.billing?.first_name?.trim() ?? ''
  const last = wc.billing?.last_name?.trim() ?? ''
  const customerName = [first, last].filter(Boolean).join(' ').trim() || 'לקוח'
  const logistics = logisticsFromWc(wc)
  const addr = shippingCityStreetFromWc(wc)
  const orderCustomerNote = (wc.customer_note ?? '').trim() || null

  return {
    id: wcOrderDocId(wc.id),
    customerName,
    customerNote: orderCustomerNote,
    status: 'queued',
    assignedTo: null,
    startedAt: null,
    completedAt: null,
    items: (wc.line_items ?? []).map(mapLine),
    wcOrderId: wc.id,
    wcStatus: wc.status,
    syncedAt: new Date().toISOString(),
    wcDateCreated: (wc.date_created ?? '').trim() || null,
    shippingCity: addr.shippingCity,
    shippingStreet: addr.shippingStreet,
    ...logistics,
  }
}
