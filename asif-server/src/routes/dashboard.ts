import { Router, Request, Response } from 'express'
import { readOrders, listAssignedOrdersForCollector } from '../orders'
import { readUsers } from '../users'

const router = Router()

// GET /dashboard — live collector status for manager
router.get('/', async (_req: Request, res: Response) => {
  const orders = await readOrders()
  const users = await readUsers()

  const rows = users
    .filter(u => u.role === 'collector')
    .map(u => {
      const mine = listAssignedOrdersForCollector(orders, u.id)
      const activeId = mine[0]?.id ?? null
      const orderSummaries = mine.map(o => {
        const total = o.items.length
        const collected = o.items.filter(i => i.status === 'collected').length
        const missing = o.items.filter(i => i.status === 'missing').length
        return {
          id: o.id,
          status: o.status,
          startedAt: o.startedAt,
          total,
          collected,
          missing,
          actionable: o.id === activeId,
        }
      })
      return {
        collectorId: u.id,
        collectorName: u.name,
        orders: orderSummaries,
      }
    })

  res.json(rows)
})

export default router
