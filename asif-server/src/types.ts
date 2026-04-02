/** `customer_service` — requirements: shortage / exception handling (web UI planned); same PIN auth as others. */
export type Role = 'collector' | 'manager' | 'customer_service'

export interface User {
  id: string
  name: string
  pin: string
  role: Role
}
