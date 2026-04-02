import type { WcListOrdersParams, WcOrder } from './types'
import type { WooCommerceConfig } from './config'

function buildUrl(config: WooCommerceConfig, path: string, query: Record<string, string | undefined>): string {
  const base = `${config.storeUrl}/wp-json/wc/v3${path}`
  const u = new URL(base)
  u.searchParams.set('consumer_key', config.consumerKey)
  u.searchParams.set('consumer_secret', config.consumerSecret)
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== '') u.searchParams.set(k, v)
  }
  return u.toString()
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

  const url = buildUrl(config, '/orders', {
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
  const url = buildUrl(config, `/orders/${wcOrderId}`, {})
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
