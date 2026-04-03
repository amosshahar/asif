import { Router, Request, Response } from 'express'
import { readUsers, findUser, saveUser, deleteUserById } from '../users'
import { User, type Role } from '../types'
import { readOrders, findOrder, saveOrder } from '../orders'
import type { Order } from '../models/order'
import { computeCollectorStats, parseStatsRange } from '../collectorStats'
import type { AdminAuthedRequest } from '../middleware/adminAuth'
import { loadWooCommerceConfig } from '../integrations/woocommerce/config'
import { getWcOrderById, putWcOrder, WooCommerceHttpError } from '../integrations/woocommerce/client'
import { kickWooCommerceFullSyncInBackground } from '../wcFullSync'

const router = Router()

// GET /admin/me — session check for asif-admin (Firestore/env admin allowlist)
router.get('/me', (req: AdminAuthedRequest, res: Response) => {
  const u = req.adminUser
  if (!u?.uid) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  res.json({ uid: u.uid, email: u.email ?? null })
})

// GET /admin/orders — Firestore first (fast). Full WC sync runs in background unless ?sync=0
router.get('/orders', async (req: Request, res: Response) => {
  const raw = req.query['sync']
  const q = Array.isArray(raw) ? raw[0] : raw
  const firestoreOnly = q === '0' || q === 'false'

  const orders = await readOrders()

  let syncTag: 'ok' | 'skipped' | 'error' | 'pending' | 'cache' = 'skipped'
  if (firestoreOnly) {
    syncTag = 'cache'
  } else if (!loadWooCommerceConfig()) {
    syncTag = 'skipped'
  } else {
    kickWooCommerceFullSyncInBackground()
    syncTag = 'pending'
  }

  res.setHeader('X-ASIF-WC-Sync', syncTag)
  res.json(orders)
})

// POST /admin/orders/:id/assign — attach picker (collector id) to a queued/assigned order
router.post('/orders/:id/assign', async (req: Request, res: Response) => {
  const id = req.params['id'] as string
  const collectorId = typeof req.body?.collectorId === 'string' ? req.body.collectorId.trim() : ''
  if (!collectorId) {
    res.status(400).json({ error: 'collectorId is required' })
    return
  }
  const user = await findUser(collectorId)
  if (!user || user.role !== 'collector') {
    res.status(404).json({ error: 'Collector not found' })
    return
  }
  const order = await findOrder(id)
  if (!order) {
    res.status(404).json({ error: 'Order not found' })
    return
  }
  if (order.status === 'completed') {
    res.status(400).json({ error: 'Cannot assign a completed order' })
    return
  }
  order.assignedTo = collectorId
  if (order.status === 'queued') {
    order.status = 'assigned'
  }
  await saveOrder(order)
  res.json(order)
})

/** Apply latest WC `status` (+ syncedAt) to a Firestore order after a GET. */
async function refreshOrderWcStatusFromRemote(orderId: string): Promise<Order | undefined> {
  const config = loadWooCommerceConfig()
  if (!config) return undefined
  const order = await findOrder(orderId)
  if (!order?.wcOrderId) return undefined
  const wc = await getWcOrderById(config, order.wcOrderId)
  order.wcStatus = wc.status
  order.syncedAt = new Date().toISOString()
  await saveOrder(order)
  return order
}

// POST /admin/orders/:id/wc/refresh — GET order from WooCommerce; update wcStatus + syncedAt only
router.post('/orders/:id/wc/refresh', async (req: Request, res: Response) => {
  const id = req.params['id'] as string
  if (!loadWooCommerceConfig()) {
    res.status(503).json({ error: 'WooCommerce is not configured' })
    return
  }
  const order = await findOrder(id)
  if (!order) {
    res.status(404).json({ error: 'Order not found' })
    return
  }
  if (order.wcOrderId == null) {
    res.status(400).json({ error: 'Order has no wcOrderId' })
    return
  }
  try {
    const updated = await refreshOrderWcStatusFromRemote(id)
    if (!updated) {
      res.status(500).json({ error: 'Failed to refresh order' })
      return
    }
    res.json(updated)
  } catch (e) {
    const msg = e instanceof WooCommerceHttpError ? e.message : String(e)
    res.status(502).json({ error: `WooCommerce: ${msg}` })
  }
})

// POST /admin/orders/:id/wc/complete — ASIF must be completed; set WC status to completed, then refresh wcStatus from WC
router.post('/orders/:id/wc/complete', async (req: Request, res: Response) => {
  const id = req.params['id'] as string
  const config = loadWooCommerceConfig()
  if (!config) {
    res.status(503).json({ error: 'WooCommerce is not configured' })
    return
  }
  const order = await findOrder(id)
  if (!order) {
    res.status(404).json({ error: 'Order not found' })
    return
  }
  if (order.status !== 'completed') {
    res.status(400).json({ error: 'ASIF order must be in completed status first' })
    return
  }
  if (order.wcOrderId == null) {
    res.status(400).json({ error: 'Order has no wcOrderId' })
    return
  }
  try {
    await putWcOrder(config, order.wcOrderId, { status: 'completed' })
    const updated = await refreshOrderWcStatusFromRemote(id)
    if (!updated) {
      res.status(500).json({ error: 'WC updated but failed to reload order' })
      return
    }
    res.json(updated)
  } catch (e) {
    const msg = e instanceof WooCommerceHttpError ? e.message : String(e)
    res.status(502).json({ error: `WooCommerce: ${msg}` })
  }
})

// POST /admin/orders/:id/resolve-cs — waiting_cs → completed (admin / CS closure in ASIF; does not change WC)
router.post('/orders/:id/resolve-cs', async (req: Request, res: Response) => {
  const id = req.params['id'] as string
  const order = await findOrder(id)
  if (!order) {
    res.status(404).json({ error: 'Order not found' })
    return
  }
  if (order.status !== 'waiting_cs') {
    res.status(400).json({ error: 'Order is not in waiting_cs status' })
    return
  }
  order.status = 'completed'
  await saveOrder(order)
  res.json(order)
})

// GET /admin/collectors/:collectorId/stats?days=7 | &from=ISO&to=ISO — pick timing stats
router.get('/collectors/:collectorId/stats', async (req: Request, res: Response) => {
  const collectorId = (req.params['collectorId'] as string).trim()
  if (!collectorId) {
    res.status(400).json({ error: 'collectorId required' })
    return
  }
  const user = await findUser(collectorId)
  if (!user || user.role !== 'collector') {
    res.status(404).json({ error: 'Collector not found' })
    return
  }
  const q = req.query as { days?: string; from?: string; to?: string }
  const range = parseStatsRange(q)
  const orders = await readOrders()
  const stats = computeCollectorStats(orders, collectorId, range)
  res.json({
    collectorId,
    collectorName: user.name,
    ...stats,
  })
})

// GET /admin/users — list all users
router.get('/users', async (_req: Request, res: Response) => {
  const users = await readUsers()
  res.json(users.map(({ pin: _pin, ...u }) => u))
})

const ROLES: Role[] = ['collector', 'manager', 'customer_service']

// POST /admin/users — create user
router.post('/users', async (req: Request, res: Response) => {
  const { id, name, pin, role } = req.body

  if (!id || !name || !pin || !role) {
    res.status(400).json({ error: 'id, name, pin and role are required' })
    return
  }

  if (!ROLES.includes(role)) {
    res.status(400).json({ error: 'role must be collector, manager, or customer_service' })
    return
  }

  if (await findUser(id)) {
    res.status(409).json({ error: 'User ID already exists' })
    return
  }

  const newUser: User = { id, name, pin, role }
  await saveUser(newUser)

  res.status(201).json({ id: newUser.id, name: newUser.name, role: newUser.role })
})

// PUT /admin/users/:id — update user
router.put('/users/:id', async (req: Request, res: Response) => {
  const existing = await findUser(req.params.id as string)

  if (!existing) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  const { name, pin, role } = req.body
  if (name) existing.name = name
  if (pin) existing.pin = pin
  if (role) {
    if (!ROLES.includes(role)) {
      res.status(400).json({ error: 'role must be collector, manager, or customer_service' })
      return
    }
    existing.role = role
  }

  await saveUser(existing)
  const { pin: _pin, ...updated } = existing
  res.json(updated)
})

// DELETE /admin/users/:id — delete user
router.delete('/users/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string
  const existing = await findUser(id)
  if (!existing) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  await deleteUserById(id)
  res.status(204).send()
})

export default router
