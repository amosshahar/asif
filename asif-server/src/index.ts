import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

// Resolve `asif-server/.env` from this file (works for `ts-node src/index.ts` and `node dist/index.js`).
const pkgRoot = path.join(__dirname, '..')
const pkgEnv = path.join(pkgRoot, '.env')
dotenv.config({ path: pkgEnv, override: true })
// If the server is started from the monorepo root, also merge `asif-server/.env` when cwd differs.
const cwdAsifEnv = path.join(process.cwd(), 'asif-server', '.env')
if (fs.existsSync(cwdAsifEnv) && path.resolve(cwdAsifEnv) !== path.resolve(pkgEnv)) {
  dotenv.config({ path: cwdAsifEnv, override: true })
}

import express from 'express'
import cors from 'cors'
import { requireFirestoreOrExit } from './startupRequireFirestore'
import { requireFirebaseAdmin } from './middleware/adminAuth'
import authRouter from './routes/auth'
import adminRouter from './routes/admin'
import ordersRouter from './routes/orders'
import shiftsRouter from './routes/shifts'
import dashboardRouter from './routes/dashboard'
import woocommerceRouter from './routes/woocommerce'
import comaxLabRouter from './routes/comaxLab'

requireFirestoreOrExit()

const app = express()
const PORT = process.env.PORT || 3002

function httpPath(req: express.Request): string {
  return req.originalUrl.split('?')[0] || '/'
}

function shouldLogEveryHttp(): boolean {
  const v = String(process.env.ASIF_DEBUG_HTTP || '')
    .trim()
    .toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

app.use(cors())
app.use(express.json())

app.use((req, _res, next) => {
  const p = httpPath(req)
  if (
    shouldLogEveryHttp() ||
    p.startsWith('/admin') ||
    p.startsWith('/dashboard') ||
    p === '/health' ||
    p === '/debug/ping' ||
    p === '/' ||
    p.startsWith('/admin/comax')
  ) {
    console.info('[asif-http]', req.method, req.originalUrl)
  }
  next()
})

app.get('/debug/ping', (_req, res) => {
  res.json({ ok: true, service: 'asif-server', t: new Date().toISOString() })
})

app.get('/', (_req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>ASIF API</title></head>
<body style="font-family:system-ui;max-width:42rem;margin:2rem auto;padding:0 1rem">
  <h1>ASIF API is running</h1>
  <p>This port (<strong>${PORT}</strong>) is the <strong>JSON API only</strong>. The admin UI is a separate app.</p>
  <ol>
    <li>Open a <strong>second terminal</strong>.</li>
    <li><code>cd asif-admin && npm run dev</code></li>
    <li>Open <a href="http://127.0.0.1:5174">http://127.0.0.1:5174</a> (asif-admin is fixed to port 5174 so Tulidu Sport can use 5173).</li>
  </ol>
  <p>Health: <a href="/health">/health</a> · Ping: <a href="/debug/ping">/debug/ping</a></p>
</body></html>`)
})

app.use('/auth', authRouter)
app.use('/orders', ordersRouter)
app.use('/shifts', shiftsRouter)

// More specific path first — otherwise `/admin` would swallow `/admin/woocommerce/*`.
app.use('/admin/woocommerce', requireFirebaseAdmin, woocommerceRouter)
app.use('/admin/comax', requireFirebaseAdmin, comaxLabRouter)
app.use('/admin', requireFirebaseAdmin, adminRouter)
app.use('/dashboard', requireFirebaseAdmin, dashboardRouter)

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.listen(PORT, () => {
  console.log(`ASIF server running on http://localhost:${PORT}`)
  console.log('')
  console.log('── Admin UI is NOT this URL ──')
  console.log('  Run in another terminal:  cd asif-admin && npm run dev')
  console.log('  Then open http://127.0.0.1:5174 (asif-admin dev port). Requests use /asif-api → this server.')
  console.log('')
  console.log('── Smoke test (should print [asif-http] below) ──')
  console.log(`  curl -s http://127.0.0.1:${PORT}/debug/ping`)
  console.log('')
  console.log('Admin auth lines are prefixed [asif-auth]; HTTP [asif-http].')
})
