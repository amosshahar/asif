import { Router, Request, Response } from 'express'
import { loadWooCommerceConfig, publicStoreOrigin } from '../integrations/woocommerce/config'
import { fetchWcV3Raw } from '../integrations/woocommerce/client'
import wcReadRoutesManifest from './wcV3ReadRoutes.generated.json'

const router = Router()

/**
 * Allowed relative paths under /wp-json/wc/v3/ (admin lab only).
 * See https://woocommerce.github.io/woocommerce-rest-api-docs/
 */
export const WC_LAB_KNOWN_PATHS: { id: string; path: string; labelHe: string }[] = [
  { id: 'customers', path: 'customers', labelHe: 'לקוחות (customers)' },
  { id: 'products', path: 'products', labelHe: 'מוצרים (products)' },
  { id: 'orders', path: 'orders', labelHe: 'הזמנות (orders) — גולמי מ־WC' },
  { id: 'coupons', path: 'coupons', labelHe: 'קופונים' },
  { id: 'refunds', path: 'refunds', labelHe: 'החזרים' },
  { id: 'product_attributes', path: 'products/attributes', labelHe: 'מאפייני מוצר' },
  { id: 'product_categories', path: 'products/categories', labelHe: 'קטגוריות מוצר' },
  { id: 'product_tags', path: 'products/tags', labelHe: 'תגיות מוצר' },
  { id: 'shipping_zones', path: 'shipping/zones', labelHe: 'אזורי משלוח' },
  { id: 'shipping_methods', path: 'shipping_methods', labelHe: 'שיטות משלוח' },
  { id: 'payment_gateways', path: 'payment_gateways', labelHe: 'שערי תשלום' },
  { id: 'tax_classes', path: 'taxes/classes', labelHe: 'מחלקות מס' },
  { id: 'system_status', path: 'system_status', labelHe: 'סטטוס מערכת' },
  { id: 'data_continents', path: 'data/continents', labelHe: 'נתוני יבשות (data)' },
  { id: 'settings', path: 'settings', labelHe: 'הגדרות (settings)' },
  { id: 'webhooks', path: 'webhooks', labelHe: 'Webhooks' },
  { id: 'reports_sales', path: 'reports/sales', labelHe: 'דוחות מכירות (ייתכן שדורש פרמטרים)' },
]

function assertSafeRelativePath(raw: string): string | null {
  const p = raw.replace(/^\/+/, '').trim()
  if (!p || p.length > 160) return null
  if (p.includes('..')) return null
  // WC v3 paths: letters, numbers, slashes, hyphens
  if (!/^[\w/-]+$/.test(p)) return null
  return p
}

function collectForwardQuery(req: Request): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(req.query)) {
    if (k === 'path') continue
    if (typeof v === 'string' && v !== '') out[k] = v
    else if (Array.isArray(v) && typeof v[0] === 'string') out[k] = v[0]
  }
  return out
}

/** GET /admin/woocommerce/lab/fetch?path=customers&per_page=10&page=1 */
router.get('/lab/fetch', async (req: Request, res: Response) => {
  const config = loadWooCommerceConfig()
  if (!config) {
    res.status(503).json({ configured: false, error: 'WooCommerce is not configured (WC_* env vars)' })
    return
  }

  const pathRaw = String(req.query.path ?? '').trim()
  const rel = assertSafeRelativePath(pathRaw)
  if (!rel) {
    res.status(400).json({
      configured: true,
      error: 'Invalid or missing path= (relative to /wp-json/wc/v3/). Use letters, numbers, / and - only.',
    })
    return
  }

  const q = collectForwardQuery(req)
  if (!q.per_page) q.per_page = '20'
  if (!q.page) q.page = '1'

  try {
    const r = await fetchWcV3Raw(config, `/${rel}`, q)
    const origin = publicStoreOrigin(config)
    res.json({
      configured: true,
      wc: {
        httpStatus: r.status,
        contentType: r.contentType,
        /** Path only — never includes consumer keys */
        endpoint: `${origin}/wp-json/wc/v3/${rel}`,
        bodyText: r.text,
        truncated: r.truncated,
      },
      lab: {
        note:
          '[ASIF lab] Raw response from your WooCommerce store. Keys are not exposed. Discover more routes: https://woocommerce.github.io/woocommerce-rest-api-docs/ — also try GET /wp-json/ on the site for all WP REST namespaces.',
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    res.status(502).json({ configured: true, error: `WC request failed: ${msg}` })
  }
})

/** GET /admin/woocommerce/lab/read-routes — static GET /wc/v3 route catalog + query arg metadata (regenerate: npm run generate:wc-read-routes) */
router.get('/lab/read-routes', (_req: Request, res: Response) => {
  const config = loadWooCommerceConfig()
  if (!config) {
    res.status(503).json({ configured: false, error: 'WooCommerce is not configured' })
    return
  }
  res.json({
    configured: true,
    generatedFrom: wcReadRoutesManifest.generatedFrom,
    generatedAt: wcReadRoutesManifest.generatedAt,
    routeCount: wcReadRoutesManifest.routeCount,
    routes: wcReadRoutesManifest.routes,
  })
})

/** GET /admin/woocommerce/lab/catalog — preset list for the admin UI */
router.get('/lab/catalog', (_req: Request, res: Response) => {
  const config = loadWooCommerceConfig()
  if (!config) {
    res.status(503).json({ configured: false, error: 'WooCommerce is not configured' })
    return
  }
  res.json({
    configured: true,
    storeOrigin: publicStoreOrigin(config),
    presets: WC_LAB_KNOWN_PATHS,
    docs: 'https://woocommerce.github.io/woocommerce-rest-api-docs/',
    wpIndexHint: `${publicStoreOrigin(config)}/wp-json/`,
  })
})

export default router
