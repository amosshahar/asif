#!/usr/bin/env node
/**
 * Club customers only: Get_ClubCustomerDetailsBySearch_Simple
 * Usage: npm run comax:curl:club -- [mobile] [email]
 */
'use strict'

const path = require('path')
const { spawn } = require('child_process')

require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
const { comaxWsLoginIdFromEnv } = require('./comax-ws-login.cjs')

const id = comaxWsLoginIdFromEnv()
const pw = String(process.env.COMAX_LOGIN_PASSWORD || '').trim()
const mob = String(process.argv[2] || '').trim()
const em = String(process.argv[3] || '').trim()

if (!id || !pw) {
  console.error('Set COMAX_LOGIN_ID and COMAX_LOGIN_PASSWORD in asif-server/.env')
  process.exit(1)
}

const base =
  'https://ws.comax.co.il/Comax_WebServices/ClubCustomers_Service.asmx/Get_ClubCustomerDetailsBySearch_Simple'

const params = {
  ID: '',
  Name: '',
  IDCard: '',
  City: '',
  Phone: '',
  Mobile: mob,
  Email: em,
  GroupID: '',
  CameFrom: '',
  LoginID: id,
  LoginPassword: pw,
}

const args = ['-sS', '-w', '\n\nhttp_code:%{http_code}\n', '-G', base]
for (const [k, v] of Object.entries(params)) {
  args.push('--data-urlencode', `${k}=${v}`)
}

console.error('curl -G … Club: Get_ClubCustomerDetailsBySearch_Simple')
const curl = spawn('curl', args, { stdio: 'inherit' })
curl.on('exit', (code) => process.exit(code == null ? 1 : code))
