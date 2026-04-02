import { Router, Request, Response } from 'express'
import { readOrders, saveOrder, findOrder, getAssignedOrder } from '../orders'

const router = Router()

// GET /orders/my?collectorId=001
router.get('/my', async (req: Request, res: Response) => {
  const { collectorId } = req.query
  if (!collectorId) {
    res.status(400).json({ error: 'collectorId required' })
    return
  }
  const order = await getAssignedOrder(collectorId as string)
  if (!order) {
    res.status(404).json({ error: 'No active order' })
    return
  }
  res.json(order)
})

// POST /orders/:id/start
router.post('/:id/start', async (req: Request, res: Response) => {
  const id = req.params['id'] as string
  const order = await findOrder(id)
  if (!order) {
    res.status(404).json({ error: 'Order not found' })
    return
  }
  order.status = 'in_progress'
  order.startedAt = new Date().toISOString()
  await saveOrder(order)
  res.json(order)
})

// PATCH /orders/:id/items/:itemId — update item status
router.patch('/:id/items/:itemId', async (req: Request, res: Response) => {
  const id = req.params['id'] as string
  const itemId = req.params['itemId'] as string
  const order = await findOrder(id)
  if (!order) {
    res.status(404).json({ error: 'Order not found' })
    return
  }
  const item = order.items.find(i => i.id === itemId)
  if (!item) {
    res.status(404).json({ error: 'Item not found' })
    return
  }

  const { status, collectedQuantity, collectedWeight, collectionMethod, missingReason } = req.body
  if (status) item.status = status
  if (collectedQuantity != null) item.collectedQuantity = collectedQuantity
  if (collectedWeight != null) item.collectedWeight = collectedWeight
  if (collectionMethod) item.collectionMethod = collectionMethod
  if (missingReason) item.missingReason = missingReason

  await saveOrder(order)
  res.json(item)
})

// POST /orders/:id/complete
router.post('/:id/complete', async (req: Request, res: Response) => {
  const id = req.params['id'] as string
  const order = await findOrder(id)
  if (!order) {
    res.status(404).json({ error: 'Order not found' })
    return
  }
  order.status = 'completed'
  order.completedAt = new Date().toISOString()
  await saveOrder(order)
  res.json(order)
})

// GET /orders — all orders (for manager dashboard)
router.get('/', async (_req: Request, res: Response) => {
  res.json(await readOrders())
})

// GET /orders/:id
router.get('/:id', async (req: Request, res: Response) => {
  const id = req.params['id'] as string
  const order = await findOrder(id)
  if (!order) {
    res.status(404).json({ error: 'Order not found' })
    return
  }
  res.json(order)
})

export default router
