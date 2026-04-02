import admin from 'firebase-admin'
import type { Firestore } from 'firebase-admin/firestore'

export function isFirebaseConfigured(): boolean {
  return !!(
    process.env.FIREBASE_PROJECT_ID?.trim() &&
    process.env.FIREBASE_CLIENT_EMAIL?.trim() &&
    process.env.FIREBASE_PRIVATE_KEY?.trim()
  )
}

function requiredEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is required`)
  return v
}

export function getFirebaseAdmin(): typeof admin {
  if (admin.apps.length) return admin

  const projectId = requiredEnv('FIREBASE_PROJECT_ID')
  const clientEmail = requiredEnv('FIREBASE_CLIENT_EMAIL')
  const privateKeyRaw = requiredEnv('FIREBASE_PRIVATE_KEY')
  const privateKey = privateKeyRaw.replace(/\\n/g, '\n')

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  })

  return admin
}

export function getFirestoreDb(): Firestore {
  return getFirebaseAdmin().firestore()
}
