import type { User } from './types'
import { getUserPersistence } from './persistence/userPersistence'

export async function readUsers(): Promise<User[]> {
  return getUserPersistence().list()
}

export async function findUser(id: string): Promise<User | undefined> {
  return getUserPersistence().get(id)
}

export async function saveUser(user: User): Promise<void> {
  return getUserPersistence().put(user)
}

export async function deleteUserById(id: string): Promise<void> {
  return getUserPersistence().delete(id)
}
