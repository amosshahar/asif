#!/usr/bin/env node
/**
 * Run list smoke calls (auth from .env only; all other params from argv).
 *
 * Usage: npm run comax:curl:all -- [mobile] [email] [fromDate] [toDate] [storeId]
 * Example: npm run comax:curl:all -- '' '' 01/01/2025 31/12/2025 1
 */
'use strict'

const { spawnSync } = require('child_process')
const path = require('path')

require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
const { comaxWsLoginIdFromEnv } = require('./comax-ws-login.cjs')

const node = process.execPath
const scriptsDir = __dirname
const a = process.argv.slice(2)
const mobile = String(a[0] ?? '').trim()
const email = String(a[1] ?? '').trim()
const fromDate = String(a[2] ?? '').trim()
const toDate = String(a[3] ?? '').trim()
const storeId = String(a[4] ?? '').trim()

function run(name, scriptFile, extraArgs) {
  console.log('\n========', name, '========\n')
  const r = spawnSync(node, [path.join(scriptsDir, scriptFile), ...extraArgs], {
    stdio: 'inherit',
    env: process.env,
  })
  if (r.status !== 0) {
    console.error(`\n${name} exited with ${r.status} (fix .env or run that script alone).`)
    process.exit(r.status ?? 1)
  }
}

const hasLogin =
  comaxWsLoginIdFromEnv() && String(process.env.COMAX_LOGIN_PASSWORD || '').trim()

if (!hasLogin) {
  console.error('Set COMAX_LOGIN_ID and COMAX_LOGIN_PASSWORD first.')
  process.exit(1)
}

run('Customers (search)', 'comax-curl-customers.cjs', [mobile, email])

if (fromDate && toDate) {
  run('Orders (date range)', 'comax-curl-orders.cjs', [fromDate, toDate])
} else {
  console.log('\n======== Orders — skipped (pass fromDate toDate as argv 3–4) ========\n')
}

if (storeId) {
  run('Products / items (by store)', 'comax-curl-items.cjs', [storeId])
} else {
  console.log('\n======== Items — skipped (pass storeId as argv 5) ========\n')
}

console.log('\n======== done ========\n')
