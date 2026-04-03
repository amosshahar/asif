'use strict'

/**
 * Comax WS uses LoginID + LoginPassword only. Browser login often has ארגון + user —
 * set COMAX_ORGANIZATION + COMAX_LOGIN_ID (user only), or put full org\\user in COMAX_LOGIN_ID alone.
 */
function comaxWsLoginIdFromEnv() {
  const u = String(process.env.COMAX_LOGIN_ID || '').trim()
  const o = String(process.env.COMAX_ORGANIZATION || '').trim()
  if (!u || /[/\\]/.test(u)) return u
  return o ? `${o}\\${u}` : u
}

module.exports = { comaxWsLoginIdFromEnv }
