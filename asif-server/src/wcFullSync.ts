import { loadWooCommerceConfig } from './integrations/woocommerce/config'
import { WooCommerceHttpError } from './integrations/woocommerce/client'
import { syncAllWooCommerceOrders, type SyncResult } from './integrations/woocommerce/sync'
import { getOrderPersistence } from './persistence/orderPersistence'

let inFlight: Promise<SyncResult> | null = null
let running = false
let lastEndedAt: number | null = null
let lastError: string | null = null

export function isWooCommerceFullSyncRunning(): boolean {
  return running
}

export function getWooCommerceFullSyncLastError(): string | null {
  return lastError
}

/**
 * Single in-flight full sync (WC → Firestore). Concurrent callers share the same promise.
 * Rejects if WooCommerce is not configured.
 */
export function runWooCommerceFullSync(): Promise<SyncResult> {
  if (inFlight) return inFlight
  const config = loadWooCommerceConfig()
  if (!config) {
    return Promise.reject(new Error('WooCommerce not configured'))
  }
  running = true
  inFlight = (async () => {
    try {
      const result = await syncAllWooCommerceOrders(config, getOrderPersistence())
      lastError = null
      return result
    } catch (e) {
      const msg =
        e instanceof WooCommerceHttpError ? `${e.message}: ${e.body}` : String(e)
      lastError = msg
      throw e
    } finally {
      running = false
      inFlight = null
      lastEndedAt = Date.now()
    }
  })()
  return inFlight
}

/** Fire-and-forget; logs failures. No-op if WC not configured. */
export function kickWooCommerceFullSyncInBackground(): void {
  if (!loadWooCommerceConfig()) return
  void runWooCommerceFullSync().catch((e) => {
    console.warn('[asif] background WC full sync failed:', e)
  })
}
