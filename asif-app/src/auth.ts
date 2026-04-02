import { Preferences } from '@capacitor/preferences'
import type { AuthUser } from './api'

const KEY = 'asif_user'

export async function saveUser(user: AuthUser) {
  await Preferences.set({ key: KEY, value: JSON.stringify(user) })
}

export async function loadUser(): Promise<AuthUser | null> {
  const { value } = await Preferences.get({ key: KEY })
  return value ? JSON.parse(value) : null
}

export async function clearUser() {
  await Preferences.remove({ key: KEY })
}
