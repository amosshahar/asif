#!/usr/bin/env node
/**
 * Product / item catalog for a warehouse (WSDL HTTP GET).
 * https://ws.comax.co.il/Comax_WebServices/Items_Service.asmx/GetAllItemsDetails
 *
 * Params: StoreID (מחסן), LoginID, LoginPassword → XML ArrayOfClsItems
 *
 * Usage: npm run comax:curl:items -- <storeId>
 */
'use strict'

const path = require('path')
const { spawn } = require('child_process')

require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
const { comaxWsLoginIdFromEnv } = require('./comax-ws-login.cjs')

const id = comaxWsLoginIdFromEnv()
const pw = String(process.env.COMAX_LOGIN_PASSWORD || '').trim()
const storeId = String(process.argv[2] || '').trim()

if (!id || !pw) {
  console.error('Set COMAX_LOGIN_ID and COMAX_LOGIN_PASSWORD in asif-server/.env')
  process.exit(1)
}
if (!storeId) {
  console.error('Usage: npm run comax:curl:items -- <storeId>  (warehouse code from Comax)')
  process.exit(1)
}

const base = 'https://ws.comax.co.il/Comax_WebServices/Items_Service.asmx/GetAllItemsDetails'

const params = {
  StoreID: storeId,
  LoginID: id,
  LoginPassword: pw,
}

const args = ['-sS', '-w', '\n\nhttp_code:%{http_code}\n', '-G', base]
for (const [k, v] of Object.entries(params)) {
  args.push('--data-urlencode', `${k}=${v}`)
}

console.error('curl -G … GetAllItemsDetails (StoreID + auth from .env). Large XML is normal.')
const curl = spawn('curl', args, { stdio: 'inherit' })
curl.on('exit', (code) => process.exit(code == null ? 1 : code))
