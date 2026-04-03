/**
 * Comax Web Services smoke test — reads ONLY from asif-server/.env (via dotenv).
 * Uses Get_CustomerDetailsBySearch_Simple — regular customers (Customers_Service.asmx).
 * For club-only, use: npm run comax:curl:club
 *
 * Usage (from asif-server): npm run comax:test -- [mobile] [email]
 *
 * Required in .env: COMAX_LOGIN_ID, COMAX_LOGIN_PASSWORD.
 * Optional: COMAX_ORGANIZATION — combined as org\\user for WS LoginID (unless COMAX_LOGIN_ID already contains \\ or /).
 */
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

const pkgRoot = path.join(__dirname, '..')
const pkgEnv = path.join(pkgRoot, '.env')

dotenv.config({ path: pkgEnv, override: true })
const cwdAsifEnv = path.join(process.cwd(), 'asif-server', '.env')
if (fs.existsSync(cwdAsifEnv) && path.resolve(cwdAsifEnv) !== path.resolve(pkgEnv)) {
  dotenv.config({ path: cwdAsifEnv, override: true })
}

const ENV_HELP = `
Add these to asif-server/.env (then run: npm run comax:test -- [mobile] [email])

  COMAX_LOGIN_ID=your_username
  COMAX_LOGIN_PASSWORD=your_password
  # Optional if Comax web login has separate ארגון:
  # COMAX_ORGANIZATION=your_org_code
`

const CUSTOMER_SEARCH_URL =
  'https://ws.comax.co.il/Comax_WebServices/Customers_Service.asmx/Get_CustomerDetailsBySearch_Simple'

function reqEnv(name: string): string {
  const v = String(process.env[name] ?? '').trim()
  if (!v) {
    console.error(`Missing required env: ${name}`)
    console.error('')
    console.error(`Expected file: ${pkgEnv}`)
    console.error(`File exists: ${fs.existsSync(pkgEnv) ? 'yes' : 'no'}`)
    console.error(ENV_HELP)
    process.exit(1)
  }
  return v
}

function buildComaxWsLoginId(userOrFull: string, organization: string): string {
  const u = userOrFull.trim()
  const org = organization.trim()
  if (!u) return u
  if (/[/\\]/.test(u)) return u
  if (!org) return u
  return `${org}\\${u}`
}

async function main(): Promise<void> {
  console.log('Comax test — env source:', pkgEnv, fs.existsSync(pkgEnv) ? '(file exists)' : '(file missing — create it)')
  console.log('')

  const baseUser = reqEnv('COMAX_LOGIN_ID')
  const loginPassword = reqEnv('COMAX_LOGIN_PASSWORD')
  const loginId = buildComaxWsLoginId(baseUser, String(process.env.COMAX_ORGANIZATION ?? ''))
  const argv = process.argv.slice(2)
  const mobile = String(argv[0] ?? '').trim()
  const email = String(argv[1] ?? '').trim()

  console.log('Comax WS test — regular customer search (Get_CustomerDetailsBySearch_Simple)')
  console.log('  LoginID (sent to WS):', loginId)
  console.log('  Password:', '***')
  if (!mobile && !email) {
    console.log('')
    console.log('Note: no mobile/email args — response may be an empty customer list.')
    console.log('  npm run comax:test -- <mobile> <email>')
  }

  const params = new URLSearchParams({
    ID: '',
    Name: '',
    IDCard: '',
    City: '',
    Phone: '',
    Mobile: mobile,
    Email: email,
    GroupID: '',
    LoginID: loginId,
    LoginPassword: loginPassword,
  })

  const url = `${CUSTOMER_SEARCH_URL}?${params.toString()}`
  console.log('')
  console.log('GET', CUSTOMER_SEARCH_URL.split('/').pop())

  const res = await fetch(url, { method: 'GET' })
  const text = await res.text()
  const preview = text.length > 4000 ? `${text.slice(0, 4000)}\n… (${text.length} bytes total)` : text

  console.log('HTTP', res.status, res.statusText)
  console.log('Body preview:')
  console.log(preview)

  if (!res.ok) {
    process.exit(1)
  }

  const lower = text.toLowerCase()
  if (lower.includes('errormessage') && /errormessage[^>]*>[^<]+</i.test(text)) {
    const m = text.match(/<ErrorMessage[^>]*>([^<]*)</i)
    if (m?.[1]?.trim()) {
      console.error('')
      console.error('Comax ErrorMessage:', m[1].trim())
      process.exit(1)
    }
  }

  console.log('')
  console.log('Done — valid auth usually returns XML (ArrayOfClsCustomers may be empty).')
  console.log('By numeric customer code: npm run comax:curl:customer -- <customerId>')
  console.log('Club customers only: npm run comax:curl:club')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
