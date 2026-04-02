import type { Order } from '../../models/order'
import type { OrderPersistence } from '../../persistence/orderPersistence'
import { listOrders } from './client'
import type { WooCommerceConfig } from './config'
import { mapWcOrderToOrder } from './mapWcOrder'

function hasPickProgress(o: Order): boolean {
  if (o.status === 'in_progress' || o.status === 'waiting_cs') return true
  return o.items.some(i => i.status !== 'pending')
}

/**
 * Merge WC snapshot into Firestore/file without clobbering in-progress picks.
 */
export async function upsertWcOrderMapped(
  persistence: OrderPersistence,
  mapped: Order
): Promise<'inserted' | 'replaced' | 'meta-only'> {
  const existing = await persistence.get(mapped.id)

  if (!existing) {
    await persistence.put(mapped)
    return 'inserted'
  }

  if (existing.status === 'completed' || hasPickProgress(existing)) {
    await persistence.put({
      ...existing,
      wcStatus: mapped.wcStatus,
      customerName: mapped.customerName,
      syncedAt: mapped.syncedAt,
      distributionArea: mapped.distributionArea ?? existing.distributionArea,
      deliveryDate: mapped.deliveryDate ?? existing.deliveryDate,
      deliveryTimeFrom: mapped.deliveryTimeFrom ?? existing.deliveryTimeFrom,
      deliveryTimeTo: mapped.deliveryTimeTo ?? existing.deliveryTimeTo,
      customerNote: mapped.customerNote ?? existing.customerNote,
    })
    return 'meta-only'
  }

  await persistence.put({
    ...mapped,
    assignedTo: existing.assignedTo,
    status:
      existing.status === 'assigned' ||
      existing.status === 'in_progress' ||
      existing.status === 'waiting_cs'
        ? existing.status
        : mapped.status,
    startedAt: existing.startedAt,
    completedAt: existing.completedAt,
    csHandoffReason: existing.csHandoffReason,
    customerNote: mapped.customerNote ?? existing.customerNote,
  })
  return 'replaced'
}

export interface SyncResult {
  pages: number
  fetched: number
  inserted: number
  replaced: number
  metaOnly: number
  errors: string[]
}

export async function syncAllWooCommerceOrders(
  config: WooCommerceConfig,
  persistence: OrderPersistence
): Promise<SyncResult> {
  const result: SyncResult = {
    pages: 0,
    fetched: 0,
    inserted: 0,
    replaced: 0,
    metaOnly: 0,
    errors: [],
  }

  const statusParam = config.orderStatuses.join(',')
  let page = 1
  const perPage = 50

  for (;;) {
    const batch = await listOrders(config, { status: statusParam, perPage, page })
    result.pages += 1
    if (batch.length === 0) break

    result.fetched += batch.length

    for (const wc of batch) {
      try {
        const mapped = mapWcOrderToOrder(wc)
        const op = await upsertWcOrderMapped(persistence, mapped)
        if (op === 'inserted') result.inserted += 1
        else if (op === 'replaced') result.replaced += 1
        else result.metaOnly += 1
      } catch (e) {
        result.errors.push(`order ${wc.id}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    if (batch.length < perPage) break
    page += 1
  }

  return result
}
