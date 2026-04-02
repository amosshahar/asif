export type Role = 'collector' | 'manager'

export interface User {
  id: string
  name: string
  pin: string
  role: Role
}
