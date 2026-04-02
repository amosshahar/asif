import { Router, Request, Response } from 'express'
import { readUsers, writeUsers, findUser } from '../users'
import { User } from '../types'

const router = Router()

// GET /admin/users — list all users
router.get('/users', (_req: Request, res: Response) => {
  const users = readUsers().map(({ pin: _pin, ...u }) => u) // never return pins
  res.json(users)
})

// POST /admin/users — create user
router.post('/users', (req: Request, res: Response) => {
  const { id, name, pin, role } = req.body

  if (!id || !name || !pin || !role) {
    res.status(400).json({ error: 'id, name, pin and role are required' })
    return
  }

  if (findUser(id)) {
    res.status(409).json({ error: 'User ID already exists' })
    return
  }

  const users = readUsers()
  const newUser: User = { id, name, pin, role }
  users.push(newUser)
  writeUsers(users)

  res.status(201).json({ id: newUser.id, name: newUser.name, role: newUser.role })
})

// PUT /admin/users/:id — update user
router.put('/users/:id', (req: Request, res: Response) => {
  const users = readUsers()
  const idx = users.findIndex(u => u.id === req.params.id)

  if (idx === -1) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  const { name, pin, role } = req.body
  if (name) users[idx].name = name
  if (pin)  users[idx].pin  = pin
  if (role) users[idx].role = role

  writeUsers(users)
  const { pin: _pin, ...updated } = users[idx]
  res.json(updated)
})

// DELETE /admin/users/:id — delete user
router.delete('/users/:id', (req: Request, res: Response) => {
  const users = readUsers()
  const filtered = users.filter(u => u.id !== req.params.id)

  if (filtered.length === users.length) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  writeUsers(filtered)
  res.status(204).send()
})

export default router
