import { Router, Request, Response } from 'express'

const router = Router()

const CUSTOMERS_SEARCH =
  'https://ws.comax.co.il/Comax_WebServices/Customers_Service.asmx/Get_CustomerDetailsBySearch_Simple'
const ORDERS_RANGE =
  'https://ws.comax.co.il/Comax_WebServices/CustomersOrders_Service.asmx/Get_CustomersOrdersDetails'
const ITEMS_STORE =
  'https://ws.comax.co.il/Comax_WebServices/Items_Service.asmx/GetAllItemsDetails'
const CUSTOMER_ONE =
  'https://ws.comax.co.il/Comax_WebServices/Customers_Service.asmx/Get_CustomerDetails_Simple'

/** ASIF-only hints; Comax’s real reply is in `comax`. */
export interface ComaxLabBlock {
  title: string
  url: string
  ok: boolean
  status: number
  note: string
}

/** Verbatim HTTP response from ws.comax.co.il (body may be capped — see `truncated`). */
export interface ComaxUpstream {
  httpStatus: number
  /** Response body exactly as returned by Comax (UTF-8 text). */
  body: string
  /** ASMX operation URL without query string (never includes credentials). */
  endpoint: string
  method: 'GET' | 'POST'
  truncated: boolean
}

const COMAX_BODY_MAX_CHARS = 2_500_000

function capComaxBody(text: string): { body: string; truncated: boolean } {
  if (text.length <= COMAX_BODY_MAX_CHARS) {
    return { body: text, truncated: false }
  }
  return {
    body:
      text.slice(0, COMAX_BODY_MAX_CHARS) +
      `\r\n\r\n---\r\n[ASIF: Comax body truncated at ${COMAX_BODY_MAX_CHARS} characters]\r\n`,
    truncated: true,
  }
}

function upstream(
  r: { status: number; text: string },
  endpoint: string,
  method: 'GET' | 'POST',
): ComaxUpstream {
  const { body, truncated } = capComaxBody(r.text)
  return {
    httpStatus: r.status,
    body,
    endpoint,
    method,
    truncated,
  }
}

export interface ComaxAuthBody {
  /** Web “משתמש” — without ארגון unless you paste the full WS login here. */
  loginId?: string
  loginPassword?: string
  /**
   * Comax web login “ארגון” / קוד ארגון (e.g. אסיף1). WSDL has no separate field; we send LoginID as org\\user.
   * Omit if COMAX_LOGIN_ID (or this field) already contains \\ or / (full combined login).
   */
  organization?: string
}

export type ComaxLabRunResponse =
  | { configured: true; comax: ComaxUpstream; block: ComaxLabBlock }
  | { configured: false; error: string }

async function fetchText(url: string): Promise<{ ok: boolean; status: number; text: string }> {
  const r = await fetch(url, { method: 'GET' })
  const text = await r.text()
  return { ok: r.ok, status: r.status, text }
}

/** ASMX HTTP POST — same fields as documented for application/x-www-form-urlencoded. */
async function fetchFormPost(
  url: string,
  fields: Record<string, string>,
): Promise<{ ok: boolean; status: number; text: string }> {
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body: new URLSearchParams(fields).toString(),
  })
  const text = await r.text()
  return { ok: r.ok, status: r.status, text }
}

/** Strip spaces, RTL marks, BOM — Comax expects a numeric customer key. */
function normalizeCustomerId(raw: string): string {
  return raw
    .replace(/^\uFEFF/, '')
    .replace(/[\u200e\u200f\u202a-\u202e]/g, '')
    .trim()
}

function readAuthFromBody(body: Record<string, unknown>): ComaxAuthBody {
  return {
    loginId: typeof body.loginId === 'string' ? body.loginId : '',
    loginPassword: typeof body.loginPassword === 'string' ? body.loginPassword : '',
    organization: typeof body.organization === 'string' ? body.organization : '',
  }
}

/** True if value already looks like combined org+user for Comax WS. */
function isCombinedComaxLogin(login: string): boolean {
  return /[/\\]/.test(login)
}

/**
 * Comax browser login = ארגון + משתמש + סיסמה. Public WS only has LoginID + LoginPassword.
 * Many tenants expect LoginID = `Organization\\User` (backslash). Some use `org/user`.
 */
export function buildComaxWsLoginId(userOrFullLogin: string, organization: string): string {
  const u = userOrFullLogin.trim()
  const org = organization.trim()
  if (!u) return u
  if (isCombinedComaxLogin(u)) return u
  if (!org) return u
  return `${org}\\${u}`
}

/**
 * Request body creds if both provided, else COMAX_LOGIN_ID / COMAX_LOGIN_PASSWORD from env.
 * Optional organization: body or COMAX_ORGANIZATION — merged into LoginID unless login already combined.
 */
export function resolveComaxCredentials(auth: ComaxAuthBody): { ok: true; loginId: string; loginPw: string } | { ok: false; error: string } {
  const fromBodyId = String(auth.loginId || '').trim()
  const fromBodyPw = String(auth.loginPassword || '').trim()
  const fromBodyOrg = String(auth.organization || '').trim()
  const baseUser =
    fromBodyId && fromBodyPw ? fromBodyId : String(process.env.COMAX_LOGIN_ID || '').trim()
  const loginPw =
    fromBodyId && fromBodyPw ? fromBodyPw : String(process.env.COMAX_LOGIN_PASSWORD || '').trim()
  const orgFromEnv = String(process.env.COMAX_ORGANIZATION || '').trim()
  const organization = fromBodyOrg || orgFromEnv

  if (!baseUser || !loginPw) {
    return {
      ok: false,
      error:
        'Missing Comax credentials: enter Login ID + password above, or set COMAX_LOGIN_ID / COMAX_LOGIN_PASSWORD on the server.',
    }
  }

  const loginId = buildComaxWsLoginId(baseUser, organization)
  return { ok: true, loginId, loginPw }
}

/** Get_CustomerDetailsBySearch_Simple — WSDL: ID, Name, IDCard, City, Phone, Mobile, Email, GroupID + auth. */
export async function runComaxCustomersSearch(
  auth: ComaxAuthBody,
  opts: {
    mobile: string
    email: string
    phone: string
    id: string
    name: string
    city: string
    groupId: string
  },
): Promise<ComaxLabRunResponse> {
  const creds = resolveComaxCredentials(auth)
  if (!creds.ok) return { configured: false, error: creds.error }
  const { loginId, loginPw } = creds

  const p = new URLSearchParams({
    ID: opts.id.trim(),
    Name: opts.name.trim(),
    IDCard: '',
    City: opts.city.trim(),
    Phone: opts.phone.trim(),
    Mobile: opts.mobile.trim(),
    Email: opts.email.trim(),
    GroupID: opts.groupId.trim(),
    LoginID: loginId,
    LoginPassword: loginPw,
  })
  const url = `${CUSTOMERS_SEARCH}?${p.toString()}`
  const r = await fetchText(url)
  const custErr = /<ErrorMessage[^>]*>([^<]+)</i.exec(r.text)
  const empty =
    r.ok && r.text.includes('ArrayOfClsCustomers') && r.text.includes('xsi:nil="true"')
  const block: ComaxLabBlock = {
    title: 'Get_CustomerDetailsBySearch_Simple',
    url: CUSTOMERS_SEARCH,
    ok: r.ok && !custErr,
    status: r.status,
    note:
      '[ASIF lab] ' +
      (custErr
        ? `Parsed ErrorMessage in XML: ${custErr[1].trim()}`
        : empty
          ? 'HTTP OK — empty list. Try Phone/Mobile exactly as on the card, or ID=לקוח / GroupID from the card; set ארגון for LoginID. Raw: `comax.body`.'
          : r.ok
            ? 'See raw Comax XML in `comax.body`.'
            : 'HTTP error from Comax.'),
  }
  return { configured: true, comax: upstream(r, CUSTOMERS_SEARCH, 'GET'), block }
}

/** Get_CustomerDetails_Simple — CustomerID required (WSDL: long). Uses POST form; GET can bind oddly on some hosts. */
export async function runComaxCustomerById(
  auth: ComaxAuthBody,
  customerId: string,
): Promise<ComaxLabRunResponse> {
  const id = normalizeCustomerId(customerId)
  if (!id) {
    return { configured: false, error: 'CustomerID (קוד לקוח) is required for this API.' }
  }
  if (!/^\d+$/.test(id)) {
    return {
      configured: false,
      error: 'CustomerID must be digits only (after trim). Check for hidden characters or paste from Comax again.',
    }
  }
  const creds = resolveComaxCredentials(auth)
  if (!creds.ok) return { configured: false, error: creds.error }
  const { loginId, loginPw } = creds

  const fields = {
    CustomerID: id,
    LoginID: loginId,
    LoginPassword: loginPw,
  }
  const r = await fetchFormPost(CUSTOMER_ONE, fields)

  const errEl = /<ErrorMessage[^>]*>([^<]*)</i.exec(r.text)
  const errText = errEl?.[1]?.trim() ?? ''
  const looksEmpty =
    /<ID>\s*0\s*<\/ID>/i.test(r.text) && /<InternalID>\s*0\s*<\/InternalID>/i.test(r.text)

  let note: string
  if (!r.ok) {
    note = 'HTTP error.'
  } else if (errText) {
    note = `Comax ErrorMessage: ${errText}`
  } else if (looksEmpty) {
    note =
      `CustomerID=${id} returned zeros for ID and InternalID in XML — Comax did respond, but did not bind this key to a row. ` +
      `On the Comax customer card, “לקוח” (e.g. 112060) and “קבוע” (permanent / internal, e.g. 2487) are different: try the other number as CustomerID. ` +
      `Also set ארגון in the lab if WS LoginID must be org\\user, and use חיפוש לקוחות with Phone/Mobile from the card if this call keeps failing.`
  } else {
    note = `POST body sent: CustomerID=${id}. See XML below.`
  }

  const block: ComaxLabBlock = {
    title: 'Get_CustomerDetails_Simple',
    url: CUSTOMER_ONE,
    ok: r.ok && !errText && !looksEmpty,
    status: r.status,
    note: '[ASIF lab] ' + note,
  }
  return { configured: true, comax: upstream(r, CUSTOMER_ONE, 'POST'), block }
}

/** Get_CustomersOrdersDetails — FromDate, ToDate (e.g. dd/MM/yyyy). */
export async function runComaxOrders(
  auth: ComaxAuthBody,
  fromDate: string,
  toDate: string,
): Promise<ComaxLabRunResponse> {
  const fromD = fromDate.trim()
  const toD = toDate.trim()
  if (!fromD || !toD) {
    return { configured: false, error: 'FromDate and ToDate are both required (try dd/MM/yyyy).' }
  }
  const creds = resolveComaxCredentials(auth)
  if (!creds.ok) return { configured: false, error: creds.error }
  const { loginId, loginPw } = creds

  const p = new URLSearchParams({
    FromDate: fromD,
    ToDate: toD,
    LoginID: loginId,
    LoginPassword: loginPw,
  })
  const url = `${ORDERS_RANGE}?${p.toString()}`
  const r = await fetchText(url)
  const block: ComaxLabBlock = {
    title: 'Get_CustomersOrdersDetails',
    url: ORDERS_RANGE,
    ok: r.ok,
    status: r.status,
    note:
      '[ASIF lab] ' +
      (r.ok
        ? 'nil in XML often means no rows or date format mismatch. Raw XML: `comax.body`.'
        : 'HTTP error — check date format. Raw body: `comax.body`.'),
  }
  return { configured: true, comax: upstream(r, ORDERS_RANGE, 'GET'), block }
}

/** GetAllItemsDetails — StoreID (מחסן). */
export async function runComaxItems(auth: ComaxAuthBody, storeId: string): Promise<ComaxLabRunResponse> {
  const sid = storeId.trim()
  if (!sid) {
    return { configured: false, error: 'StoreID (מחסן) is required for this API.' }
  }
  const creds = resolveComaxCredentials(auth)
  if (!creds.ok) return { configured: false, error: creds.error }
  const { loginId, loginPw } = creds

  const p = new URLSearchParams({
    StoreID: sid,
    LoginID: loginId,
    LoginPassword: loginPw,
  })
  const url = `${ITEMS_STORE}?${p.toString()}`
  const r = await fetchText(url)
  const block: ComaxLabBlock = {
    title: 'GetAllItemsDetails',
    url: ITEMS_STORE,
    ok: r.ok,
    status: r.status,
    note:
      '[ASIF lab] ' +
      (r.ok ? 'Large XML is normal. Full payload in `comax.body` (may be truncated if huge).' : 'HTTP error — check StoreID. Raw: `comax.body`.'),
  }
  return { configured: true, comax: upstream(r, ITEMS_STORE, 'GET'), block }
}

function json(res: Response, out: ComaxLabRunResponse) {
  res.json(out)
}

router.post('/customers/search', async (req: Request, res: Response) => {
  const body = (req.body || {}) as Record<string, unknown>
  const auth = readAuthFromBody(body)
  const opts = {
    mobile: typeof body.mobile === 'string' ? body.mobile : '',
    email: typeof body.email === 'string' ? body.email : '',
    phone: typeof body.phone === 'string' ? body.phone : '',
    id: typeof body.id === 'string' ? body.id : '',
    name: typeof body.name === 'string' ? body.name : '',
    city: typeof body.city === 'string' ? body.city : '',
    groupId: typeof body.groupId === 'string' ? body.groupId : '',
  }
  json(res, await runComaxCustomersSearch(auth, opts))
})

router.post('/customers/by-id', async (req: Request, res: Response) => {
  const body = (req.body || {}) as Record<string, unknown>
  const auth = readAuthFromBody(body)
  const customerId = typeof body.customerId === 'string' ? body.customerId : ''
  json(res, await runComaxCustomerById(auth, customerId))
})

router.post('/orders', async (req: Request, res: Response) => {
  const body = (req.body || {}) as Record<string, unknown>
  const auth = readAuthFromBody(body)
  const fromDate = typeof body.fromDate === 'string' ? body.fromDate : ''
  const toDate = typeof body.toDate === 'string' ? body.toDate : ''
  json(res, await runComaxOrders(auth, fromDate, toDate))
})

router.post('/items', async (req: Request, res: Response) => {
  const body = (req.body || {}) as Record<string, unknown>
  const auth = readAuthFromBody(body)
  const storeId = typeof body.storeId === 'string' ? body.storeId : ''
  json(res, await runComaxItems(auth, storeId))
})

export default router
