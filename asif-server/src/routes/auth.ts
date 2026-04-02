import { Router, Request, Response } from 'express'
import { findUser } from '../users'

const router = Router()

// POST /auth/login
router.post('/login', (req: Request, res: Response) => {
  const { id, pin } = req.body

  if (!id || !pin) {
    res.status(400).json({ error: 'id and pin are required' })
    return
  }

  const user = findUser(id)

  if (!user || user.pin !== pin) {
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
