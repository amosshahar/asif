import { Router, Request, Response } from 'express'
import { readOrders } from '../orders'
import { readUsers } from '../users'

const router = Router()

// GET /dashboard — live collector status for manager
router.get('/', (_req: Request, res: Response) => {
  const orders = readOrders()
  const users  = readUsers()

  const rows = users
    .filter(u => u.role === 'collector')
    .map(u => {
      const order = orders.find(
        o => o.assignedTo === u.id && o.status !== 'completed'
      )
      if (!order) {
        return { collectorId: u.id, collectorName: u.name, order: null }
      }
      const total     = order.items.length
      const collected = order.items.filter(i => i.status === 'collected').length
      const missing   = order.items.filter(i => i.status === 'missing').length
      return {
        collectorId:   u.id,
        collectorName: u.name,
        order: {
          id:         order.id,
          status:     order.status,
          startedAt:  order.startedAt,
          total,
          collected,
          missing,
        },
      }
    })

  res.json(rows)
})

export default router
