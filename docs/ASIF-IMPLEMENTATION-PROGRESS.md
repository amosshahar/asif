# ASIF — implementation progress

**Requirements reference:** [ASIF-WOOCOMMERCE-PICKING-REQUIREMENTS.md](./ASIF-WOOCOMMERCE-PICKING-REQUIREMENTS.md)

## How we work

| Rule | Detail |
|------|--------|
| **Tech stack** | Any **new** dependency or service needs **your approval** before we add it. |
| **Auth** | Work pauses at the **auth redesign** milestone — **your decisions required** (not started). |
| **Database** | **Firestore only** — `asif_orders`, `asif_users`. **`FIREBASE_*` required**; no JSON persistence. See [ASIF-FIRESTORE-ENTITIES.md](./ASIF-FIRESTORE-ENTITIES.md). |
| **Doubts** | Open items under **Questions / blockers**; resolved → **Decision log**. |

---

## Decision log

| Date | Topic | Decision |
|------|--------|----------|
| 2026-04-02 | Database (orders) | **Firestore**; **new collection only:** `asif_orders`. No Tulidu / other app collections. |
| 2026-04-02 | WC pickable statuses | **`processing`** + slug for **ממתין לליקוט**; default placeholder slug **`waiting-for-pick`** — override with `WC_ORDER_STATUSES` to match your real WC custom status. |
| 2026-04-02 | Staging WC URL | None yet — use production URL in `WC_STORE_URL` when ready. |
| 2026-04-02 | HTTP client | Node built-in **`fetch`** for WooCommerce (no axios on server). |
| 2026-04-02 | Firebase Admin | **`firebase-admin`** added to `asif-server` for Firestore. |
| 2026-04-02 | Web admin auth | **Firebase Google** + **Firestore `asif_admins`** only (no env email list, no Tulidu `admin` claim). |
| 2026-04-02 | Users persistence | **Firestore `asif_users` only** (JSON removed). |
| 2026-04-02 | No JSON backup | `data/*.json` removed; server **exits** if `FIREBASE_*` missing. |

---

## Questions / blockers

| ID | Status | Question |
|----|--------|----------|
| Q3 | **Open** | What is the **exact WooCommerce slug** for "ממתין לליקוט" on your store? (Replace `waiting-for-pick` in `WC_ORDER_STATUSES` when known.) |

---

## Phase checklist

Legend: `—` not started · `~` in progress · `x` done · `!` blocked (needs you)

### Phase A — WooCommerce foundation (server)

| Step | Status | Notes |
|------|--------|--------|
| A.1 Progress + rules doc | `x` | This file |
| A.2 Env vars + example file | `x` | `asif-server/env.example` |
| A.3 WC REST client (read orders) | `x` | `src/integrations/woocommerce/` |
| A.4 Admin routes: preview + mapped order | `x` | See API reference |
| A.5 Persist synced orders | `x` | Firestore `asif_orders` only |

### Phase B — Order model & statuses

| Step | Status | Notes |
|------|--------|--------|
| B.1 Internal status enum + WC mapping | `x` | **`queued`**, **`assigned`**, **`in_progress`**, **`waiting_cs`**, **`completed`** |
| B.2 `waiting_cs` when any line missing | `x` | PATCH line → missing sets order **`waiting_cs`**; undo missing restores **`in_progress`** / **`assigned`**; complete → **`completed`** vs **`waiting_cs`** + **`completedAt`** |

### Phase C — Admin orders UI

| Step | Status | Notes |
|------|--------|--------|
| C.1 Orders table + filters | `x` | **`asif-admin` → הזמנות:** טבלה, סינון סטטוס, רענון, סנכרון WC |
| C.2 Assign / reassign pickers | `x` | מודל בחירת ליקוטן + `POST /admin/orders/:id/assign` |

### Phase D — Picker app (auth, shift, queue)

| Step | Status | Notes |
|------|--------|--------|
| D.1 Auth model | `!` | **Stop for your decisions** |
| D.2 Shift start/end | `x` | Firestore **`asif_shifts`**; **`POST /shifts/start|end`**, **`GET /shifts/current`**; app starts shift on login + session restore, ends on logout; home shows shift start time |
| D.3 End-of-shift summary | `x` | **`POST /shifts/end`** returns **`summary`**: orders finished in window, shift length, avg order time; modal on logout or on **«סיום משמרת והמשך»** then optional new shift |
| D.3 Multi-order home | `—` | |

### Phase E–H

See requirements doc.

---

## Current sprint (what we did last)

| When | Change |
|------|--------|
| 2026-04-02 | Firestore persistence for orders (`asif_orders`), WC→ASIF mapper, **POST `/admin/woocommerce/sync`**, merge rules for in-progress picks, **`GET .../orders/:wcId/mapped`**, **`GET/POST /admin/orders`**, **`POST /admin/orders/:id/assign`**. Client types include `queued` + optional `wc*` fields. |
| 2026-04-02 | **`asif-admin` Orders page:** nav הזמנות, טבלה, פילטר סטטוס, הקצאה/הקצאה מחדש לליקוטן; **GET `/admin/orders`** מריץ סנכרון WC→Firestore לפני הרשימה. |

---

## Next steps

1. **Firebase:** In GCP console, ensure the service account used by `FIREBASE_*` can **read/write** Firestore (Admin SDK bypasses security rules, but IAM must allow Firestore API).
2. **Env on server:** Set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, plus `WC_*`. Deploy script may need to pass these to EC2/PM2.
3. **Confirm WC slug** for ממתין לליקוט → update `WC_ORDER_STATUSES` (Q3).
4. **Sync:** opening **הזמנות** (or `GET /admin/orders`) runs WC→Firestore sync; optional `POST /admin/woocommerce/sync` still available.
5. **Assign picker:** `POST /admin/orders/wc-{id}/assign` with body `{ "collectorId": "001" }` (use real WC numeric id in document id `wc-12345`).

---

## API quick reference (dev)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/admin/woocommerce/status` | WC configured?, store origin, persistence `firestore`, `ordersCollection` |
| GET | `/admin/woocommerce/orders?...` | Slim list from WooCommerce (live) |
| GET | `/admin/woocommerce/orders/:wcId/mapped` | Full ASIF-shaped order from WC (not saved) |
| POST | `/admin/woocommerce/sync` | Pull WC → `asif_orders` |
| GET | `/admin/orders` | WC sync then all stored orders; response header `X-ASIF-WC-Sync`: `ok` \| `skipped` \| `error` |
| POST | `/admin/orders/:id/assign` | `{ "collectorId": "001" }` → `assigned` |

*Admin routes require **Firebase Bearer** + **`asif_admins` allowlist**.*
