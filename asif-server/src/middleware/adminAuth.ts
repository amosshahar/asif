import type { NextFunction, Request, Response } from 'express'
import { getFirebaseAdmin } from '../firebaseAdmin'
import { getFirestoreAdminEmailSet, isFirestoreAdminEmail } from '../adminAllowlistFirestore'
import {
  logAuthForbidden,
  logAuthInvalidToken,
  logAuthMisconfigured,
  logAuthNoToken,
  logAuthSessionOk,
} from '../authLog'

export type AdminAuthedRequest = Request & {
  adminUser?: { uid: string; email?: string }
}

/**
 * Verifies Firebase ID token and requires the user's email to appear in Firestore `asif_admins`
 * (document id and/or `email` field — see docs/ASIF-FIRESTORE-ENTITIES.md).
 */
export async function requireFirebaseAdmin(req: AdminAuthedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = String(req.headers.authorization || '')
    if (!authHeader.startsWith('Bearer ')) {
      logAuthNoToken(req)
      return res.status(401).json({ error: 'No token provided' })
    }
    const token = authHeader.slice('Bearer '.length).trim()
    if (!token) {
      logAuthNoToken(req)
      return res.status(401).json({ error: 'No token provided' })
    }

    const decoded = await getFirebaseAdmin().auth().verifyIdToken(token)
    const email = typeof decoded.email === 'string' ? decoded.email : undefined

    if (!(await isFirestoreAdminEmail(email))) {
      const norm = String(email || '').trim().toLowerCase()
      const set = await getFirestoreAdminEmailSet()
      logAuthForbidden(req, {
        uid: decoded.uid,
        email: email ?? '(missing on token)',
        firestoreAllowlisted: norm ? set.has(norm) : false,
        firestoreAdminDocCount: set.size,
      })
      return res.status(403).json({ error: 'Admin privileges required' })
    }

    req.adminUser = { uid: decoded.uid, email }
    if (req.baseUrl === '/admin' && req.path === '/me') {
      logAuthSessionOk(req, email, decoded.uid)
    }
    return next()
  } catch (e: unknown) {
    const msg = String((e as { message?: string })?.message || '')
    const code = String((e as { code?: string })?.code || '')
    if (msg.includes('PEM') || msg.includes('private key')) {
      logAuthMisconfigured(req, 'Firebase Admin private key / PEM')
      return res.status(500).json({ error: 'Server auth is not configured' })
    }
    logAuthInvalidToken(req, code, msg)
    return res.status(401).json({ error: 'Invalid token' })
  }
}
