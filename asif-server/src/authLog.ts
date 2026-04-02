import type { Request } from 'express'

const P = '[asif-auth]'

/** Stable route label for logs, e.g. `/admin/me`, `/dashboard`. */
export function authRouteKey(req: Request): string {
  const base = req.baseUrl || ''
  const p = req.path === '/' ? '' : req.path
  return `${base}${p}` || req.originalUrl.split('?')[0] || req.url
}

export function logAuthSessionOk(req: Request, email: string | undefined, uid: string): void {
  console.info(P, 'session OK', authRouteKey(req), { email: email ?? '(none)', uid })
}

export function logAuthNoToken(req: Request): void {
  console.warn(P, '401 no Bearer token', authRouteKey(req))
}

export function logAuthInvalidToken(req: Request, code: string, message: string): void {
  console.warn(P, '401 invalid token', authRouteKey(req), { code: code || null, message: message.slice(0, 200) })
}

export function logAuthForbidden(
  req: Request,
  detail: Record<string, unknown>,
): void {
  console.warn(P, '403 admin denied', authRouteKey(req), detail)
}

export function logAuthMisconfigured(req: Request, hint: string): void {
  console.error(P, '500 auth config', authRouteKey(req), hint)
}
