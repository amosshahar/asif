# ASIF — Firestore collections & app entities

The ASIF server **only** uses Firestore for durable data (no `data/*.json`).  
Collection names are **prefixed with `asif_`** so they stay separate from Tulidu Sport and other apps in the same Firebase project.

---

## Firestore collections

| Collection | Document ID | Purpose |
|------------|-------------|---------|
| **`asif_orders`** | Order id (e.g. `wc-12345` for WooCommerce order `12345`) | Picking orders, line items, assignment, WC sync metadata. |
| **`asif_users`** | User id (e.g. `001`, `admin`) | Collectors, managers, and **customer service** (PIN login; CS shortage UI planned per requirements). |
| **`asif_admins`** | Lowercase Google email (e.g. `amos.shahar@gmail.com`) | **Web admin** (`asif-admin`): who may call `/admin/*` and `/dashboard` after Firebase Google sign-in. |
| **`asif_shifts`** | Auto id | **Picker shift** records: `collectorId`, `startedAt`, `open` (boolean), `endedAt` when closed. |

**Composite index:** query `collectorId` + `open` — Firebase may prompt to create **`asif_shifts`** index on first use.

Future docs (e.g. CS tickets) should use **`asif_*`** names only.

---

## Entity: **User** (`asif_users/{id}`)

| Field | Type | Notes |
|-------|------|--------|
| `id` | string | Document id; login identifier. |
| `name` | string | Display name. |
| `pin` | string | PIN for `/auth/login` (treat as secret; admin list strips it from JSON). |
| `role` | `"collector"` \| `"manager"` \| `"customer_service"` | **Collector** — mobile picking app. **Manager** — admin web (`asif-admin`). **Customer service** — same auth; requirements call for shortage/exception handling (web views **not built yet**; mobile shows a “use web when ready” message). Order status **`waiting_cs`** (not in schema yet) will queue work for CS. |

---

## Entity: **Web admin** (`asif_admins/{email}`)

| Field | Type | Notes |
|-------|------|--------|
| *(document id)* | string | Use the **lowercase** Google account email (must match the email on the Firebase ID token after sign-in). |
| `email` | string (optional) | Redundant copy for readability in the console; the server also indexes the document id. |
| `addedAt` | string (optional) | ISO timestamp — convention only, not read by the server today. |

**Bootstrap:** Create one document per admin in the Firebase console (or script). Example ids: `amos.shahar@gmail.com`, `avi@beaverglobal.com`, `avishin5@gmail.com`.  
The server loads this collection with a **~60s in-memory cache**; after adding/removing a doc, new access may take up to a minute unless the server process restarts. **Only** this collection grants web admin access (no env allowlist, no Firebase custom claims).

---

## Entity: **Order** (`asif_orders/{id}`)

| Field | Type | Notes |
|-------|------|--------|
| `id` | string | Stable id; WC-backed orders use `wc-{wcOrderId}`. |
| `customerName` | string | From WC billing or placeholder. |
| `status` | `"queued"` \| `"assigned"` \| `"in_progress"` \| `"completed"` | `queued` = synced, not assigned to a picker yet. |
| `assignedTo` | string \| null | Collector `id` when assigned. |
| `startedAt` | string \| null | ISO timestamp when pick started. |
| `completedAt` | string \| null | ISO when order completed. |
| `items` | **OrderItem**[] | Line items (see below). |
| `wcOrderId` | number (optional) | Source WooCommerce order id. |
| `wcStatus` | string (optional) | Last known WC status slug. |
| `syncedAt` | string (optional) | ISO of last WC sync. |

---

## Entity: **OrderItem** (embedded in `Order.items[]`)

| Field | Type | Notes |
|-------|------|--------|
| `id` | string | Stable line id (e.g. `wc-li-{lineItemId}`). |
| `sku` | string | |
| `name` | string | |
| `brand` | string | |
| `quantity` | number | Pieces or weight amount depending on `unit`. |
| `unit` | `"piece"` \| `"kg"` \| `"g"` | |
| `barcode` | string | |
| `imageUrl` | string | |
| `location` | `{ aisle: number, label: string }` | Aisle routing; default `0` / `"—"` until catalog mapping. |
| `customerNote` | string | |
| `status` | `"pending"` \| `"collected"` \| `"missing"` | |
| `collectedQuantity` | number \| null | |
| `collectedWeight` | number \| null | |
| `collectionMethod` | `"scan"` \| `"manual"` \| `"scale"` \| null | |
| `missingReason` | string (optional) | |

---

## Runtime entities (not stored as their own collections)

| Concept | Where it lives |
|---------|------------------|
| **WooCommerce API** | External; read via `WC_*` env, written to `asif_orders` on sync. |
| **Web admin session** | Firebase ID token + email must match Firestore `asif_admins`. |
| **Picker session** | PIN via `/auth/login` (`asif_users`); **shift** open/close via `/shifts/*` (`asif_shifts`). |
| **Dashboard row** | Derived in memory from `asif_users` + `asif_orders` for `/dashboard`. |
| **Customer service workload** | Requirements: orders with shortages → waiting for CS; needs `Order.status` (e.g. `waiting_cs`) + CS admin views — **not implemented yet**. |

---

## Related code

- Collection constants: `asif-server/src/firestoreCollections.ts`
- Order shape: `asif-server/src/models/order.ts`
- User shape: `asif-server/src/types.ts`
- Persistence: `asif-server/src/persistence/orderPersistence.ts`, `userPersistence.ts`
