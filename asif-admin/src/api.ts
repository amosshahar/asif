import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3002' })

export interface User {
  id: string
  name: string
  role: 'collector' | 'manager'
}

export interface UserPayload {
  id: string
  name: string
  pin: string
  role: 'collector' | 'manager'
}

export const getUsers = () =>
  api.get<User[]>('/admin/users').then(r => r.data)

export const createUser = (payload: UserPayload) =>
  api.post<User>('/admin/users', payload).then(r => r.data)

export const updateUser = (id: string, payload: Partial<UserPayload>) =>
  api.put<User>(`/admin/users/${id}`, payload).then(r => r.data)

export const deleteUser = (id: string) =>
  api.delete(`/admin/users/${id}`)

export interface DashboardRow {
  collectorId: string
  collectorName: string
  order: {
    id: string
    status: 'assigned' | 'in_progress' | 'completed'
    startedAt: string | null
    total: number
    collected: number
    missing: number
  } | null
}

export const getDashboard = () =>
  api.get<DashboardRow[]>('/dashboard').then(r => r.data)
