import { Router, Request, Response } from 'express'
import {
  allItemsResolved,
  applyOrderCompletion,
  syncOrderStatusForShortages,
} from '../orderLifecycle'
import type { OrderItem } from '../models/order'
import { readOrders, saveOrder, findOrder, listAssignedOrdersForCollector } from '../orders'
import { isWeightDeviationOverLimit } from '../weightDeviationPolicy'

const router = Router()

// GET /orders/my?collectorId=001 — all assigned/in-progress orders; `activeOrderId` is the one to pick first
router.get('/my', async (req: Request, res: Response) => {
  const raw = req.query['collectorId']
  const q = Array.isArray(raw) ? raw[0] : raw
  const collectorId = typeof q === 'string' ? q.trim() : String(q ?? '').trim()
  if (!collectorId) {
    res.status(400).json({ error: 'collectorId required' })
    return
  }
  const all = await readOrders()
  const orders = listAssignedOrdersForCollector(all, collectorId)
  const activeOrderId = orders[0]?.id ?? null
  res.json({ orders, activeOrderId })
})

// POST /orders/:id/start
router.post('/:id/start', async (req: Request, res: Response) => {
  const id = req.params['id'] as string
  const order = await findOrder(id)
  if (!order) {
    res.status(404).json({ error: 'Order not found' })
    return
  }
  if (!order.startedAt) {
    order.startedAt = new Date().toISOString()
  }
  if (order.status === 'assigned') {
    order.status = 'in_progress'
  }
  await saveOrder(order)
  res.json(order)
})

// POST /orders/:id/customer-service-handoff — מלקט מסמן העברה לשירות לקוחות עם הערה (או מנקה הערה אם reason ריק ואין חסרים)
router.post('/:id/customer-service-handoff', async (req: Request, res: Response) => {
  const id = req.params['id'] as string
  const order = await findOrder(id)
  if (!order) {
    res.status(404).json({ error: 'Order not found' })
    return
  }
  if (order.completedAt || order.status === 'completed') {
    res.status(400).json({ error: 'Order is already finished' })
    return
  }
  const raw = (req.body as Record<string, unknown>)?.['reason']
  const reason = typeof raw === 'string' ? raw.trim() : ''

  if (reason.length > 2000) {
    res.status(400).json({ error: 'Reason is too long (max 2000 characters)' })
    return
  }

  if (reason.length === 0) {
    order.csHandoffReason = null
  } else if (reason.length < 3) {
    res.status(400).json({ error: 'Reason must be at least 3 characters (or leave empty to clear)' })
    return
  } else {
    order.csHandoffReason = reason
  }

  syncOrderStatusForShortages(order)
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
  if (order.completedAt || order.status === 'completed') {
    res.status(400).json({ error: 'Order is already finished' })
    return
  }
  const item = order.items.find(i => i.id === itemId)
  if (!item) {
    res.status(404).json({ error: 'Item not found' })
    return
  }

  const prevStatus = item.status

  const {
    status,
    collectedQuantity,
    collectedWeight,
    collectionMethod,
    missingReason,
    acknowledgeWeightDeviation,
  } = req.body as Record<string, unknown>

  if (status) item.status = status as OrderItem['status']
  if (collectedQuantity != null) item.collectedQuantity = collectedQuantity as number | null
  if (collectedWeight != null) item.collectedWeight = collectedWeight as number | null
  if (collectionMethod) item.collectionMethod = collectionMethod as OrderItem['collectionMethod']
  if (missingReason !== undefined) {
    if (missingReason && String(missingReason).trim()) {
      item.missingReason = String(missingReason)
    } else {
      delete item.missingReason
    }
  }

  const ackDeviation =
    acknowledgeWeightDeviation === true || acknowledgeWeightDeviation === 'true'

  if (item.status === 'pending') {
    delete item.weightDeviationAcknowledged
  } else if (
    item.status === 'collected' &&
    item.collectionMethod === 'scale' &&
    item.collectedWeight != null &&
    typeof item.collectedWeight === 'number'
  ) {
    if (isWeightDeviationOverLimit(item, item.collectedWeight)) {
      if (!ackDeviation) {
        res.status(409).json({
          error: 'Weight differs by more than 20% from ordered quantity — confirm in the app',
          code: 'WEIGHT_DEVIATION_OVER_20',
        })
        return
      }
      item.weightDeviationAcknowledged = true
    } else {
      delete item.weightDeviationAcknowledged
    }
  } else {
    delete item.weightDeviationAcknowledged
  }

  if (item.status === 'pending') {
    item.pickedAt = null
  } else if (
    item.status === 'collected' ||
    item.status === 'missing'
  ) {
    if (prevStatus === 'pending') {
      item.pickedAt = new Date().toISOString()
    }
  }

  syncOrderStatusForShortages(order)
  await saveOrder(order)
  res.json(item)
})

// POST /orders/:id/complete — every line collected or missing; terminal: completed vs waiting_cs
router.post('/:id/complete', async (req: Request, res: Response) => {
  const id = req.params['id'] as string
  const order = await findOrder(id)
  if (!order) {
    res.status(404).json({ error: 'Order not found' })
    return
  }
  if (order.completedAt) {
    res.json(order)
    return
  }
  if (!allItemsResolved(order)) {
    res.status(400).json({ error: 'Every line must be collected or marked missing' })
    return
  }
  applyOrderCompletion(order)
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
