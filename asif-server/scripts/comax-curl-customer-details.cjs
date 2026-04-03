#!/usr/bin/env node
/**
 * Regular Comax customer by numeric code: Get_CustomerDetails_Simple (HTTP GET, WSDL)
 * https://ws.comax.co.il/Comax_WebServices/Customers_Service.asmx/Get_CustomerDetails_Simple
 *
 * Usage: npm run comax:curl:customer -- <customerId>
 */
'use strict'

const path = require('path')
const { spawn } = require('child_process')

require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
const { comaxWsLoginIdFromEnv } = require('./comax-ws-login.cjs')

const id = comaxWsLoginIdFromEnv()
const pw = String(process.env.COMAX_LOGIN_PASSWORD || '').trim()
const customerId = String(process.argv[2] || '').trim()

if (!id || !pw) {
  console.error('Set COMAX_LOGIN_ID and COMAX_LOGIN_PASSWORD in asif-server/.env')
  process.exit(1)
}
if (!customerId) {
  console.error('Usage: npm run comax:curl:customer -- <customerId>  (קוד לקוח)')
  process.exit(1)
}

const base =
  'https://ws.comax.co.il/Comax_WebServices/Customers_Service.asmx/Get_CustomerDetails_Simple'

const args = [
  '-sS',
  '-w',
  '\n\nhttp_code:%{http_code}\n',
  '-X',
  'POST',
  base,
  '-H',
  'Content-Type: application/x-www-form-urlencoded',
  '--data-urlencode',
  `CustomerID=${customerId}`,
  '--data-urlencode',
  `LoginID=${id}`,
  '--data-urlencode',
  `LoginPassword=${pw}`,
]

console.error('curl POST … Get_CustomerDetails_Simple (form body; CustomerID + auth from .env)')
const curl = spawn('curl', args, { stdio: 'inherit' })
curl.on('exit', (code) => process.exit(code == null ? 1 : code))
