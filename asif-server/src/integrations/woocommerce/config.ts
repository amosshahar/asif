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

/** Comma-separated meta keys to try (first non-empty wins). Used when mapping WC → ASIF orders. */
export interface WcOrderMetaKeyLists {
  distributionArea: string[]
  deliveryDate: string[]
  deliveryTimeFrom: string[]
  deliveryTimeTo: string[]
  /** Meta keys whose value is one string like `06/04/2026 - 11:00 - 16:00` (optional; mapper also auto-detects this pattern in any meta value). */
  shippingSlotCombined: string[]
}

function splitEnvKeys(value: string | undefined, fallback: string): string[] {
  return (value ?? fallback)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Env vars (optional): `WC_META_KEYS_DISTRIBUTION_AREA`, `WC_META_KEYS_DELIVERY_DATE`,
 * `WC_META_KEYS_DELIVERY_TIME_FROM`, `WC_META_KEYS_DELIVERY_TIME_TO`,
 * `WC_META_KEYS_COMBINED_SHIPPING_SLOT` — comma-separated WC order meta keys.
 */
export function loadWcOrderMetaKeyLists(): WcOrderMetaKeyLists {
  return {
    distributionArea: splitEnvKeys(
      process.env.WC_META_KEYS_DISTRIBUTION_AREA,
      'אזור חלוקה,distribution_area,_distribution_area,shipping_area'
    ),
    deliveryDate: splitEnvKeys(
      process.env.WC_META_KEYS_DELIVERY_DATE,
      'תאריך חלוקה,delivery_date,_delivery_date,Delivery Date'
    ),
    deliveryTimeFrom: splitEnvKeys(
      process.env.WC_META_KEYS_DELIVERY_TIME_FROM,
      'שעת חלוקה מתי,delivery_time_from,_delivery_time_from,Delivery Time From'
    ),
    deliveryTimeTo: splitEnvKeys(
      process.env.WC_META_KEYS_DELIVERY_TIME_TO,
      'שעת חלוקה עד,delivery_time_to,_delivery_time_to,Delivery Time To'
    ),
    shippingSlotCombined: splitEnvKeys(
      process.env.WC_META_KEYS_COMBINED_SHIPPING_SLOT,
      ''
    ),
  }
}
