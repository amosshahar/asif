#!/usr/bin/env node
/**
 * List customer orders in a date range (WSDL HTTP GET).
 * https://ws.comax.co.il/Comax_WebServices/CustomersOrders_Service.asmx/Get_CustomersOrdersDetails
 *
 * Params (from WSDL): FromDate, ToDate, LoginID, LoginPassword
 * Date format is often dd/MM/yyyy in Comax — confirm in your tenant if empty/errors.
 *
 * Usage: npm run comax:curl:orders -- <fromDate> <toDate>
 * Example: npm run comax:curl:orders -- 01/01/2025 31/12/2025
 */
'use strict'

const path = require('path')
const { spawn } = require('child_process')

require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
const { comaxWsLoginIdFromEnv } = require('./comax-ws-login.cjs')

const id = comaxWsLoginIdFromEnv()
const pw = String(process.env.COMAX_LOGIN_PASSWORD || '').trim()
const fromDate = String(process.argv[2] || '').trim()
const toDate = String(process.argv[3] || '').trim()

if (!id || !pw) {
  console.error('Set COMAX_LOGIN_ID and COMAX_LOGIN_PASSWORD in asif-server/.env')
  process.exit(1)
}
if (!fromDate || !toDate) {
  console.error('Usage: npm run comax:curl:orders -- <fromDate> <toDate>  (e.g. 01/01/2025 31/12/2025)')
  process.exit(1)
}

const base =
  'https://ws.comax.co.il/Comax_WebServices/CustomersOrders_Service.asmx/Get_CustomersOrdersDetails'

const params = {
  FromDate: fromDate,
  ToDate: toDate,
  LoginID: id,
  LoginPassword: pw,
}

const args = ['-sS', '-w', '\n\nhttp_code:%{http_code}\n', '-G', base]
for (const [k, v] of Object.entries(params)) {
  args.push('--data-urlencode', `${k}=${v}`)
}

console.error('curl -G … Get_CustomersOrdersDetails (date range + auth from .env)')
const curl = spawn('curl', args, { stdio: 'inherit' })
curl.on('exit', (code) => process.exit(code == null ? 1 : code))
