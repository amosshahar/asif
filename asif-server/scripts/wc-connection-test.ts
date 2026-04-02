/**
 * Quick WooCommerce REST check using asif-server/.env (no secrets printed).
 * Usage: npx ts-node scripts/wc-connection-test.ts
 */
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { loadWooCommerceConfig } from '../src/integrations/woocommerce/config'
import { listOrders, WooCommerceHttpError } from '../src/integrations/woocommerce/client'

const pkgRoot = path.join(__dirname, '..')
const pkgEnv = path.join(pkgRoot, '.env')
dotenv.config({ path: pkgEnv, override: true })
const cwdAsifEnv = path.join(process.cwd(), 'asif-server', '.env')
if (fs.existsSync(cwdAsifEnv) && path.resolve(cwdAsifEnv) !== path.resolve(pkgEnv)) {
  dotenv.config({ path: cwdAsifEnv, override: true })
}

async function main(): Promise<void> {
  const config = loadWooCommerceConfig()
  if (!config) {
    console.error('Not configured: set WC_STORE_URL, WC_CONSUMER_KEY, WC_CONSUMER_SECRET in asif-server/.env')
    process.exit(1)
  }

  console.log('Store URL:', config.storeUrl)
  console.log('WC_ORDER_STATUSES (used for sync):', config.orderStatuses.join(', '))

  try {
    const anyStatus = await listOrders(config, { perPage: 1, page: 1 })
    console.log('OK — REST reachable. Page 1 (any status):', anyStatus.length, 'order(s).')
    if (anyStatus[0]) {
      console.log('  Example: WC order id', anyStatus[0].id, 'status slug:', anyStatus[0].status)
    }
  } catch (e) {
    if (e instanceof WooCommerceHttpError) {
      console.error('FAIL —', e.message)
      console.error('Response (truncated):', e.body.slice(0, 600))
      process.exit(1)
    }
    throw e
  }

  const statusParam = config.orderStatuses.join(',')
  try {
    const filtered = await listOrders(config, {
      perPage: 20,
      page: 1,
      status: statusParam,
    })
    console.log('Orders matching WC_ORDER_STATUSES:', filtered.length)
  } catch (e) {
    if (e instanceof WooCommerceHttpError) {
      console.warn(
        'WARN — status filter rejected by WooCommerce (fix WC_ORDER_STATUSES in .env). Truncated response:'
      )
      console.warn(e.body.slice(0, 500))
      console.warn('Tip: try WC_ORDER_STATUSES=processing until you confirm your custom status slug.')
      process.exit(0)
    }
    throw e
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
