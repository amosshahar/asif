import { getFirestoreDb } from './firebaseAdmin'
import { ASIF_ADMINS_COLLECTION } from './firestoreCollections'

const CACHE_MS = 60_000

let cachedEmails: Set<string> | null = null
let cachedAt = 0

/** Clears the in-memory cache (e.g. after you add/remove admins in Firestore). Next request refetches. */
export function invalidateAdminAllowlistCache(): void {
  cachedEmails = null
  cachedAt = 0
}

async function loadAdminEmailsFromFirestore(): Promise<Set<string>> {
  const db = getFirestoreDb()
  const snap = await db.collection(ASIF_ADMINS_COLLECTION).get()
  const set = new Set<string>()
  for (const d of snap.docs) {
    const id = d.id.trim().toLowerCase()
    if (id) set.add(id)
    const em = d.data()?.email
    if (typeof em === 'string' && em.trim()) {
      set.add(em.trim().toLowerCase())
    }
  }
  return set
}

/**
 * Returns lowercase emails allowed as web admins (document id and optional `email` field).
 * Cached ~60s. On first failure with no prior cache, returns empty set so env/claims still work.
 */
export async function getFirestoreAdminEmailSet(): Promise<Set<string>> {
  if (cachedEmails !== null && Date.now() - cachedAt < CACHE_MS) {
    return cachedEmails
  }
  try {
    const set = await loadAdminEmailsFromFirestore()
    cachedEmails = set
    cachedAt = Date.now()
    return set
  } catch (e) {
    console.error('[asif] failed to load asif_admins allowlist', e)
    if (cachedEmails !== null) return cachedEmails
    return new Set<string>()
  }
}

export async function isFirestoreAdminEmail(email: string | undefined): Promise<boolean> {
  const target = String(email || '').trim().toLowerCase()
  if (!target) return false
  const set = await getFirestoreAdminEmailSet()
  return set.has(target)
}
