import { isFirebaseConfigured, getFirebaseAdmin } from './firebaseAdmin'

/** ASIF server uses Firestore only — no JSON file persistence. */
export function requireFirestoreOrExit(): void {
  if (!isFirebaseConfigured()) {
    console.error(
      '[asif-server] Missing FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY.\n' +
        'Firestore is required (JSON backup removed). Set env vars and restart.'
    )
    process.exit(1)
  }
  getFirebaseAdmin()
}
