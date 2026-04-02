import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY || ''
if (!apiKey && import.meta.env.DEV) {
  console.error(
    '[asif-admin] Missing VITE_FIREBASE_API_KEY. Create asif-admin/.env from .env.example and paste Firebase Web config (Project settings → Your apps → Web). Restart `npm run dev`.',
  )
}

export const firebaseConfig = {
  apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)

/** All four required for Google web sign-in. */
export function isFirebaseWebReady(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId,
  )
}

export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })
