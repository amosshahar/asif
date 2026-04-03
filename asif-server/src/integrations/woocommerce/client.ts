import type { WcListOrdersParams, WcOrder } from './types'
import type { WooCommerceConfig } from './config'

export function buildWcV3Url(
  config: WooCommerceConfig,
  path: string,
  query: Record<string, string | undefined>,
): string {
  const base = `${config.storeUrl}/wp-json/wc/v3${path}`
  const u = new URL(base)
  u.searchParams.set('consumer_key', config.consumerKey)
  u.searchParams.set('consumer_secret', config.consumerSecret)
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== '') u.searchParams.set(k, v)
  }
  return u.toString()
}

const WC_LAB_BODY_MAX = 2_500_000

/** Raw GET to WooCommerce REST v3 — returns body text as returned by the store (no JSON parse). */
export async function fetchWcV3Raw(
  config: WooCommerceConfig,
  relativePath: string,
  query: Record<string, string | undefined>,
): Promise<{ status: number; contentType: string | null; text: string; truncated: boolean }> {
  const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`
  const url = buildWcV3Url(config, path, query)
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  const text = await res.text()
  const truncated = text.length > WC_LAB_BODY_MAX
  const body = truncated ? text.slice(0, WC_LAB_BODY_MAX) + '\n\n---\n[ASIF: WC body truncated]\n' : text
  return {
    status: res.status,
    contentType: res.headers.get('content-type'),
    text: body,
    truncated,
  }
}

export class WooCommerceHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string
  ) {
    super(message)
    this.name = 'WooCommerceHttpError'
  }
}

export async function listOrders(
  config: WooCommerceConfig,
  params: WcListOrdersParams = {}
): Promise<WcOrder[]> {
  const perPage = params.perPage ?? 20
  const page = params.page ?? 1
  const status = params.status
  const statusParam = Array.isArray(status) ? status.join(',') : status

  const url = buildWcV3Url(config, '/orders', {
    per_page: String(perPage),
    page: String(page),
    status: statusParam,
  })

  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })

  const text = await res.text()
  if (!res.ok) {
    throw new WooCommerceHttpError(
      `WooCommerce API ${res.status}`,
      res.status,
      text.slice(0, 2000)
    )
  }

  try {
    return JSON.parse(text) as WcOrder[]
  } catch {
    throw new WooCommerceHttpError('Invalid JSON from WooCommerce', res.status, text.slice(0, 500))
  }
}

export async function getWcOrderById(config: WooCommerceConfig, wcOrderId: number): Promise<WcOrder> {
  const url = buildWcV3Url(config, `/orders/${wcOrderId}`, {})
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  const text = await res.text()
  if (!res.ok) {
    throw new WooCommerceHttpError(
      `WooCommerce API ${res.status}`,
      res.status,
      text.slice(0, 2000)
    )
  }
  try {
    return JSON.parse(text) as WcOrder
  } catch {
    throw new WooCommerceHttpError('Invalid JSON from WooCommerce', res.status, text.slice(0, 500))
  }
}

/** PUT partial update (e.g. `{ status: 'completed' }`). See WC REST «Update an order». */
export async function putWcOrder(
  config: WooCommerceConfig,
  wcOrderId: number,
  body: Record<string, unknown>
): Promise<WcOrder> {
  const url = buildWcV3Url(config, `/orders/${wcOrderId}`, {})
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) {
    throw new WooCommerceHttpError(
      `WooCommerce API ${res.status}`,
      res.status,
      text.slice(0, 2000)
    )
  }
  try {
    return JSON.parse(text) as WcOrder
  } catch {
    throw new WooCommerceHttpError('Invalid JSON from WooCommerce', res.status, text.slice(0, 500))
  }
}
