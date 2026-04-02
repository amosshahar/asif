/** Subset of WooCommerce REST API order (v3) — expand as needed. */
export interface WcLineItem {
  id: number
  name: string
  sku: string
  quantity: number
  meta_data?: { id: number; key: string; value: string | number | unknown }[]
  /** Often present on WC v3 order line_items when linked to a product. */
  image?: { id?: number; src?: string }
}

export interface WcBilling {
  first_name?: string
  last_name?: string
  city?: string
  state?: string
}

export interface WcShipping {
  city?: string
  state?: string
}

export interface WcOrder {
  id: number
  number: string
  status: string
  currency: string
  date_created: string
  /** Order-level note from checkout (WC REST `customer_note`). */
  customer_note?: string
  billing?: WcBilling
  shipping?: WcShipping
  line_items: WcLineItem[]
  meta_data?: { id: number; key: string; value: string | number | unknown }[]
}

export interface WcListOrdersParams {
  status?: string | string[]
  perPage?: number
  page?: number
}
