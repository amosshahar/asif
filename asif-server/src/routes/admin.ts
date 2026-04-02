import { Router, Request, Response } from 'express'
import { readUsers, findUser, saveUser, deleteUserById } from '../users'
import { User, type Role } from '../types'
import { readOrders, findOrder, saveOrder } from '../orders'
import type { AdminAuthedRequest } from '../middleware/adminAuth'

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

// GET /admin/orders — all picking orders (queued + assigned + …)
router.get('/orders', async (_req: Request, res: Response) => {
  res.json(await readOrders())
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
  order.status = 'assigned'
  await saveOrder(order)
  res.json(order)
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
