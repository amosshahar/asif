import { Router, Request, Response } from 'express'
import { readOrders, writeOrders, findOrder, getAssignedOrder } from '../orders'

const router = Router()

// GET /orders/my?collectorId=001
router.get('/my', (req: Request, res: Response) => {
  const { collectorId } = req.query
  if (!collectorId) { res.status(400).json({ error: 'collectorId required' }); return }
  const order = getAssignedOrder(collectorId as string)
  if (!order) { res.status(404).json({ error: 'No active order' }); return }
  res.json(order)
})

// POST /orders/:id/start
router.post('/:id/start', (req: Request, res: Response) => {
  const orders = readOrders()
  const idx = orders.findIndex(o => o.id === req.params.id)
  if (idx === -1) { res.status(404).json({ error: 'Order not found' }); return }
  orders[idx].status = 'in_progress'
  orders[idx].startedAt = new Date().toISOString()
  writeOrders(orders)
  res.json(orders[idx])
})

// PATCH /orders/:id/items/:itemId — update item status
router.patch('/:id/items/:itemId', (req: Request, res: Response) => {
  const orders = readOrders()
  const order = orders.find(o => o.id === req.params.id)
  if (!order) { res.status(404).json({ error: 'Order not found' }); return }
  const item = order.items.find(i => i.id === req.params.itemId)
  if (!item) { res.status(404).json({ error: 'Item not found' }); return }

  const { status, collectedQuantity, collectedWeight, collectionMethod, missingReason } = req.body
  if (status)            item.status           = status
  if (collectedQuantity != null) item.collectedQuantity = collectedQuantity
  if (collectedWeight   != null) item.collectedWeight   = collectedWeight
  if (collectionMethod)  item.collectionMethod = collectionMethod
  if (missingReason)     item.missingReason    = missingReason

  writeOrders(orders)
  res.json(item)
})

// POST /orders/:id/complete
router.post('/:id/complete', (req: Request, res: Response) => {
  const orders = readOrders()
  const idx = orders.findIndex(o => o.id === req.params.id)
  if (idx === -1) { res.status(404).json({ error: 'Order not found' }); return }
  orders[idx].status = 'completed'
  orders[idx].completedAt = new Date().toISOString()
  writeOrders(orders)
  res.json(orders[idx])
})

// GET /orders — all orders (for manager dashboard)
router.get('/', (_req: Request, res: Response) => {
  res.json(readOrders())
})

// GET /orders/:id
router.get('/:id', (req: Request, res: Response) => {
  const order = findOrder(req.params.id)
  if (!order) { res.status(404).json({ error: 'Order not found' }); return }
  res.json(order)
})

export default router
