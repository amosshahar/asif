import type { User } from '../types'
import { getFirestoreDb } from '../firebaseAdmin'
import { ASIF_USERS_COLLECTION } from '../firestoreCollections'

export interface UserPersistence {
  list(): Promise<User[]>
  get(id: string): Promise<User | undefined>
  put(user: User): Promise<void>
  delete(id: string): Promise<void>
}

export class FirestoreUserPersistence implements UserPersistence {
  private col() {
    return getFirestoreDb().collection(ASIF_USERS_COLLECTION)
  }

  async list(): Promise<User[]> {
    const snap = await this.col().get()
    const out: User[] = []
    snap.forEach(doc => {
      const d = doc.data() as User
      if (d?.id) out.push(d)
    })
    out.sort((a, b) => a.id.localeCompare(b.id))
    return out
  }

  async get(id: string): Promise<User | undefined> {
    const doc = await this.col().doc(id).get()
    if (!doc.exists) return undefined
    return doc.data() as User
  }

  async put(user: User): Promise<void> {
    await this.col().doc(user.id).set({
      id: user.id,
      name: user.name,
      pin: user.pin,
      role: user.role,
    })
  }

  async delete(id: string): Promise<void> {
    await this.col().doc(id).delete()
  }
}

let cached: UserPersistence | null = null

export function getUserPersistence(): UserPersistence {
  if (!cached) cached = new FirestoreUserPersistence()
  return cached
}
