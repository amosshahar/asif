import { Router, Request, Response } from 'express'
import { loadWooCommerceConfig, publicStoreOrigin } from '../integrations/woocommerce/config'
import { getWcOrderById, listOrders, WooCommerceHttpError } from '../integrations/woocommerce/client'
import { mapWcOrderToOrder } from '../integrations/woocommerce/mapWcOrder'
import { syncAllWooCommerceOrders } from '../integrations/woocommerce/sync'
import { getOrderPersistence } from '../persistence/orderPersistence'
import { ASIF_ORDERS_COLLECTION, ASIF_USERS_COLLECTION } from '../firestoreCollections'

const router = Router()

let lastWcError: string | null = null

// GET /admin/woocommerce/status
router.get('/status', (_req: Request, res: Response) => {
  const config = loadWooCommerceConfig()
  if (!config) {
    return res.json({
      configured: false,
      storeUrl: null,
      lastError: lastWcError,
      persistence: 'firestore',
      ordersCollection: ASIF_ORDERS_COLLECTION,
      usersCollection: ASIF_USERS_COLLECTION,
    })
  }
  res.json({
    configured: true,
    storeUrl: publicStoreOrigin(config),
    defaultStatuses: config.orderStatuses,
    lastError: lastWcError,
    persistence: 'firestore',
    ordersCollection: ASIF_ORDERS_COLLECTION,
    usersCollection: ASIF_USERS_COLLECTION,
  })
})

// GET /admin/woocommerce/orders?status=processing&per_page=20&page=1
router.get('/orders', async (req: Request, res: Response) => {
  const config = loadWooCommerceConfig()
  if (!config) {
    res.status(503).json({ error: 'WooCommerce is not configured (set WC_* env vars)' })
    return
  }

  const perPage = Math.min(100, Math.max(1, parseInt(String(req.query.per_page ?? '20'), 10) || 20))
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1)
  const statusQ = req.query.status
  const status =
    typeof statusQ === 'string' && statusQ.trim()
      ? statusQ.includes(',')
        ? statusQ.split(',').map(s => s.trim()).filter(Boolean)
        : statusQ.trim()
      : config.orderStatuses

  try {
    const orders = await listOrders(config, { status, perPage, page })
    lastWcError = null
    const slim = orders.map(o => ({
      wcOrderId: o.id,
      number: o.number,
      status: o.status,
      dateCreated: o.date_created,
      currency: o.currency,
      customerName: [o.billing?.first_name, o.billing?.last_name].filter(Boolean).join(' ').trim() || '—',
      lineItemCount: o.line_items?.length ?? 0,
    }))
    res.json({ page, perPage, count: slim.length, orders: slim })
  } catch (e) {
    const msg = e instanceof WooCommerceHttpError ? `${e.message}: ${e.body}` : String(e)
    lastWcError = msg
    res.status(502).json({ error: 'WooCommerce request failed', detail: msg })
  }
})

// GET /admin/woocommerce/orders/:wcId/mapped — full ASIF order shape from WC (not saved)
router.get('/orders/:wcId/mapped', async (req: Request, res: Response) => {
  const config = loadWooCommerceConfig()
  if (!config) {
    res.status(503).json({ error: 'WooCommerce is not configured' })
    return
  }
  const rawId = req.params['wcId']
  const wcId = parseInt(Array.isArray(rawId) ? rawId[0] ?? '' : rawId ?? '', 10)
  if (!Number.isFinite(wcId)) {
    res.status(400).json({ error: 'Invalid wcId' })
    return
  }
  try {
    const wc = await getWcOrderById(config, wcId)
    lastWcError = null
    res.json(mapWcOrderToOrder(wc))
  } catch (e) {
    const msg = e instanceof WooCommerceHttpError ? `${e.message}: ${e.body}` : String(e)
    lastWcError = msg
    res.status(502).json({ error: 'WooCommerce request failed', detail: msg })
  }
})

// POST /admin/woocommerce/sync — pull WC orders into asif_orders (or JSON file if Firestore off)
router.post('/sync', async (_req: Request, res: Response) => {
  const config = loadWooCommerceConfig()
  if (!config) {
    res.status(503).json({ error: 'WooCommerce is not configured' })
    return
  }
  try {
    const persistence = getOrderPersistence()
    const result = await syncAllWooCommerceOrders(config, persistence)
    lastWcError = null
    res.json({
      ok: true,
      persistence: 'firestore',
      collection: ASIF_ORDERS_COLLECTION,
      ...result,
    })
  } catch (e) {
    const msg = e instanceof WooCommerceHttpError ? `${e.message}: ${e.body}` : String(e)
    lastWcError = msg
    res.status(502).json({ error: 'Sync failed', detail: msg })
  }
})

export default router
