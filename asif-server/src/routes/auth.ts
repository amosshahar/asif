import { Router, Request, Response } from 'express'
import { findUser } from '../users'

const router = Router()

// POST /auth/login
router.post('/login', async (req: Request, res: Response) => {
  const id = typeof req.body?.id === 'string' ? req.body.id.trim() : String(req.body?.id ?? '').trim()
  const pin = typeof req.body?.pin === 'string' ? req.body.pin.trim() : String(req.body?.pin ?? '').trim()

  if (!id || !pin) {
    res.status(400).json({ error: 'id and pin are required' })
    return
  }

  const user = await findUser(id)

  if (!user || String(user.pin) !== pin) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  res.json({
    id: user.id,
    name: user.name,
    role: user.role,
  })
})

export default router
