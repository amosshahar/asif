import axios from 'axios'

const api = axios.create({ baseURL: 'http://localhost:3002' })

export interface AuthUser {
  id: string
  name: string
  role: 'collector' | 'manager'
}

export async function login(id: string, pin: string): Promise<AuthUser> {
  const res = await api.post<AuthUser>('/auth/login', { id, pin })
  return res.data
}
