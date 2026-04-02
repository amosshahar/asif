/**
 * ASIF-only Firestore collections. Do not read/write Tulidu Sport or other app data.
 * All names are prefixed with `asif_`. See docs/ASIF-FIRESTORE-ENTITIES.md.
 */
export const ASIF_ORDERS_COLLECTION = 'asif_orders'
export const ASIF_USERS_COLLECTION = 'asif_users'
/** Web admin allowlist: one doc per admin; see docs/ASIF-FIRESTORE-ENTITIES.md */
export const ASIF_ADMINS_COLLECTION = 'asif_admins'
