export interface WooCommerceConfig {
  storeUrl: string
  consumerKey: string
  consumerSecret: string
  /** Default statuses for “pickable” orders */
  orderStatuses: string[]
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

export function loadWooCommerceConfig(): WooCommerceConfig | null {
  const storeUrl = (process.env.WC_STORE_URL ?? '').trim()
  const consumerKey = (process.env.WC_CONSUMER_KEY ?? '').trim()
  const consumerSecret = (process.env.WC_CONSUMER_SECRET ?? '').trim()

  if (!storeUrl || !consumerKey || !consumerSecret) {
    return null
  }

  /** Processing + custom slug for Hebrew "ממתין לליקוט" — set `WC_ORDER_STATUSES` if your slug differs. */
  const rawStatuses = (process.env.WC_ORDER_STATUSES ?? 'processing,waiting-for-pick')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  return {
    storeUrl: trimSlash(storeUrl),
    consumerKey,
    consumerSecret,
    orderStatuses: rawStatuses.length > 0 ? rawStatuses : ['processing', 'waiting-for-pick'],
  }
}

/** Safe for logs / API: origin only, no keys */
export function publicStoreOrigin(config: WooCommerceConfig): string {
  try {
    return new URL(config.storeUrl).origin
  } catch {
    return '(invalid WC_STORE_URL)'
  }
}
