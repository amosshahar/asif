# ASIF — WooCommerce picking system requirements

**Source:** [אפיון מערכת ליקוט – Google Doc](https://docs.google.com/document/d/1Qlo63ztvIIZEoem1u9hS0pyqL5rp27_k89NqjAdNH1U/) (internal product spec, Hebrew).  
**Purpose:** Single requirements reference for engineering, aligned with the doc above.  
**Related:** `ASIF_Product_Definition.md` (original ASIF MVP), current code in `asif-app`, `asif-admin`, `asif-server`.

---

## 1. System goals

Develop a **picking system for WooCommerce orders** that supports:

- Picking **per order** (order picking, not batch-only).
- **Full flow** by one picker: pick + weigh + pack (single assignee per order for the core flow).
- **Shortage handling** and handoff toward **customer service**.
- **Measurement** of picking performance and workers.

---

## 2. Data source

| Requirement | Detail |
|-------------|--------|
| Integration | WooCommerce **REST API** (or agreed alternative: webhooks + polling). |
| Order pull | Import orders only in statuses equivalent to **Processing** / **waiting for picking** (exact WC status mapping to be defined per store). |
| Identity | Store orders must map to internal IDs while preserving **WC order id** for updates. |

---

## 3. Roles

| Role | Scope (from spec) |
|------|-------------------|
| **Admin** | Orders view, assignment, dashboard, shortage visibility. |
| **Picker** | Mobile app: login, picking, weighing, shortages. |
| **Customer service** | Later: view and treat shortages (phase 2 of product). |

---

## 4. Admin panel — orders

### 4.1 Order list

For each order, show at minimum:

- Order number (WC + internal if needed).
- Customer name.
- **Distribution area** (אזור חלוקה).
- **Delivery day and time** (יום ושעת חלוקה).
- **Order status** (internal workflow), including:
  - Waiting for picking  
  - In picking  
  - Waiting for customer service  
  - Ready / completed (terminology to align with WC)
- Assigned picker.
- **Pick duration** when finished (זמן ליקוט).

### 4.2 Assignment

- Filter orders by: **date**, **distribution area**, **time range**.
- Select multiple orders and **assign to a picker**.
- **Reassign** orders between pickers.

### 4.3 Daily dashboard (real-time)

- Counts: waiting for picking, in picking, waiting for CS, completed.
- **Cumulative pick time** (all workers).
- **Average time per order**.
- **Orders per picker** (distribution of load).

### 4.4 Shortages (admin)

- Detect / surface orders with shortages (automatic flagging per business rules).
- Status **waiting for customer service** when rules apply.
- Future: explicit CS workflow handoff (see §10).

---

## 5. Picker mobile app

### 5.1 Authentication

- Login with **username + password** (spec); today ASIF uses **employee id + PIN** — migration or coexistence required.
- On login: record **shift start time** (שעת התחלת משמרת).

### 5.2 Home

- Count of orders **assigned** to this picker.
- Per-order **status** visibility: waiting, in picking, completed.

### 5.3 Start picking an order

- On open/start: transition to **in picking**; record **order pick start time**.

### 5.4 Picking screen — line items

For each product:

- Product name, **image**, **location** (מאגר / warehouse or aisle — map from WC/catalog).
- **Quantity** in units; for weighed products: ordered units **and** **total ordered weight** / average weight from site (as provided by WC line item meta).
- **Customer notes** — spec calls for **Thai translation** of customer note for staff (תרגום לתאילנדית); implementation needs translation provider or manual field from WC.

### 5.5 Per-line actions

1. **Confirm pick**  
   - Manual quantity entry.  
   - Barcode scan **or** phone camera scan (already directionally aligned with current ASIF).

2. **Weighing**  
   - Button for weighing: enter **actual scale weight** and **override** average/expected from order (spec).  
   - For weighed products (§5.6): **auto-read from scale** (no typing) when hardware available.

3. **Skip**  
   - Missing product → advance to next line (shortage flow).

### 5.6 Weighed products (⚖️)

- **Pull weight automatically** from the scale (BLE/USB/WiFi per hardware — not specified in doc).
- System: capture weight, bind to **current line**, update **actual quantity/weight**.
- **Warning** if actual weight deviates more than **±20%** from **average weight** taken from the site; picker must still confirm.

### 5.7 Shortage or over-pick

- If shortage **or** over-pick: **popup** forcing explicit confirmation.
- Visual distinction (e.g. color) so **customer service** can see quantity/weight exceptions (less / more / weight vs average).
- **Rule:** if **at least one** line is missing → order auto-marked **waiting for customer service** (ממתין לשירות לקוחות).

---

## 6. Timing (automatic)

Record:

- **Order pick time**: start → completion.
- **Time between line items** (inter-item transitions).

---

## 7. Complete order

When all lines are handled:

- Record **completion time**.
- If **no shortages** → internal **ready**; update **WooCommerce** order to completed (or agreed status); **send customer invoice** with **updated weights and charged amount** (WC/billing integration).
- If **shortages** → status **waiting for customer service**; no premature “completed” billing without business rules.

---

## 8. Picker end-of-shift summary

After finishing the last order of the day (or on explicit end shift):

- Show **orders picked**, **total work time**, **average time per order**.

---

## 9. Core — measurement & control

Per picker, persist:

- Average time per order, average time per line.
- Orders per day.
- Total work time.

**Errors / complaints (via CS, later):**

- Link complaint to order; auto-link to picker.
- Types: wrong product, shortage, quality.
- Reports by picker.

---

## 10. Future (out of initial build)

- **WhatsApp automation** for substitutes (manager marks shortage → message → customer chooses alternative → order update).
- Partial **offline** and sync (doc lists as advantage under technical emphasis).

### Technical emphasis (from doc)

- Mobile first (tablet/phone).
- Fast UX; **realtime** where possible.
- **WooCommerce** as system of record for statuses and updates.
- Built-in **measurement** (not only an external plugin).

---

## 11. Gap analysis — current repo vs this spec

Below: **today’s implementation** (approx. April 2026) vs §§2–9.

| Area | Spec | Current implementation |
|------|------|------------------------|
| **Backend data** | WooCommerce API | **Firestore** `asif_orders` / `asif_users` + WC sync; see `docs/ASIF-FIRESTORE-ENTITIES.md`. |
| **Order statuses** | Waiting pick / in pick / waiting CS / ready + WC sync | **assigned**, **in_progress**, **completed** only; **no** “waiting for CS”, **no** WC push. |
| **Admin orders UI** | Full list, filters, bulk assign, reassign | **Dashboard** (live picker rows) + **Users**; **no** orders list, filters, or assignment UI. |
| **Picker auth** | Username + password, shift start | **Employee id + PIN**; **no** shift timestamp. |
| **Picker home** | Counts by status for assigned orders | Single **active** assigned order; **no** multi-order status summary. |
| **Line item model** | Distribution area, delivery slot, WC line meta, Thai note | Customer name, aisle label, **Hebrew** notes, `unit` piece/kg/g; **no** delivery area/slot, **no** Thai translation. |
| **Barcode / camera** | Scan or camera | **ML Kit** scan + manual collect; **aligned** partially. |
| **Weighing** | Auto from scale + manual override | **Manual numeric only** (`WeightModal`); **no** BLE/USB scale. |
| **±20% weight rule** | Warn from site average | **Not implemented**. |
| **Shortage / over-pick** | Modal + CS visual flag + auto CS order status | **Missing** with reason; **no** over-pick path; **no** auto CS status; **no** CS styling. |
| **Timing** | Order duration + inter-item | **startedAt** / **completedAt** at order level only; **no** per-line or inter-item metrics. |
| **Complete → WC** | Status + invoice with weights | **Local JSON complete** only; **no** invoice, **no** WC. |
| **Shift summary** | End-of-day picker stats | **Not implemented**. |
| **Analytics core** | Per-picker KPIs, complaints | **Not implemented** (dashboard is live snapshot only). |

**Conclusion:** The current codebase is a **functional prototype** for pick flow + barcode + manual weight + missing items + simple admin visibility. The **Google Doc spec** implies a **WooCommerce-centric order lifecycle**, richer **admin operations**, **scale integration**, **business rules** (±20%, CS routing), and **billing/status sync** — largely **not built yet**.

---

## 12. Implementation plan

Phased to reduce risk: **integrate data first**, then **workflow**, then **hardware and polish**.

### Phase A — Foundation & WooCommerce (backend)

1. **WC connection**  
   - Server: configurable `WC_URL`, consumer key/secret (or app password); env-based secrets.  
   - Read orders in target statuses; normalize to **internal order schema** (preserve `wcOrderId`).  
2. **Persistence**  
   - Move off JSON files to a **real store** (Firestore/SQLite/Postgres — team choice) or keep JSON temporarily **only** behind a repository interface.  
3. **Webhook + polling**  
   - Optional `POST /webhooks/woocommerce` for order updates; fallback poll for reliability.  
4. **Outbound updates**  
   - Service to **patch WC order** status, line item meta (actual weight/qty), and notes when picker completes (per §7).

**Exit:** Orders appear from WC; completing an order updates WC (minimal fields agreed with merchant).

### Phase B — Order model & statuses

1. Extend internal statuses: `waiting_pick`, `in_pick`, `waiting_cs`, `ready`, `cancelled` (names TBD).  
2. Map to/from WC statuses explicitly in code + config.  
3. **Assignment** fields: `assignedPickerId`, `assignedAt`, optional filters metadata (area, slot).  
4. **Triggers:** any line **missing** → set order `waiting_cs` (§5.7).

**Exit:** State machine documented; API returns new statuses; admin and app consume them.

### Phase C — Admin: orders & assignment

1. **Orders page:** table with §4.1 columns; link to detail.  
2. **Filters:** date, area, time range.  
3. **Bulk assign / reassign** pickers.  
4. **Dashboard:** extend current dashboard with §4.3 aggregates (counts + times); wire to new metrics APIs.

**Exit:** Manager can run daily operations without editing JSON.

### Phase D — Picker app: auth, shift, multi-order

1. **Auth:** add **username/password** (or OIDC) while optionally keeping PIN for kiosks — product decision.  
2. **Shift:** `POST /shifts/start` on login; `POST /shifts/end` optional.  
3. **Home:** list assigned orders with statuses; tap to open (not only single “current” order).  
4. **Timestamps:** order pick start on “start”; line-level `firstFocusedAt` / `completedAt` for inter-item timing (§6).

**Exit:** Pickers see queue; timing events stored.

### Phase E — Weighing & scale

1. **Manual path:** keep modal; ensure **expected weight** from WC line shown vs **actual**.  
2. **±20% rule:** compare actual vs **expected/average from order**; show warning + require confirm (§5.6).  
3. **BLE scale:** add `@capacitor-community/bluetooth-le` (iOS CocoaPods already in use); implement **one reference scale** (GATT profile per device doc from vendor); stream or poll stable weight into modal.  
4. **Over-pick / wrong qty:** explicit flow + flag for CS (§5.7).

**Exit:** At least one scale works end-to-end; manual fallback always available.

### Phase F — Shortages, CS visibility, completion rules

1. **Over-pick UI** and **exception flags** on line items.  
2. Admin/CS view: highlight orders/lines with exceptions (color/badge).  
3. **Completion:** branch **ready** vs **waiting_cs**; block WC “completed” when waiting_cs unless overridden.  
4. **Invoice / totals:** use WC REST or server-side recalculation per merchant setup (§7).

**Exit:** Business rules in §5.7–7 reflected in data and WC where applicable.

### Phase G — Analytics & picker summary

1. Nightly or on-demand aggregates: §9 + §8 screens in app.  
2. Admin reports: export or charts by picker.  
3. **Complaints** model placeholder for future CS module.

**Exit:** Measurable KPIs match spec minimum.

### Phase H — Product polish from spec

1. **Customer note Thai translation** — integrate translation API or admin-supplied `noteTh` on line from WC meta.  
2. **Offline queue** (optional): outbox for patches when network returns (§10).  
3. **WhatsApp** automation — separate project stream.

---

## 13. Open decisions (before coding Phase A)

1. Exact **WC statuses** (Hebrew store labels vs `processing`, custom statuses).  
2. **Persistence** choice (Firestore vs SQL vs hybrid with WC as source of truth only).  
3. **Picker auth:** username/password only vs PIN + SSO.  
4. **Scale vendor + protocol** (BLE UUIDs / serial).  
5. **Invoice:** WC core vs plugin (e.g. PDF invoices) for “send after pick”.  
6. **Delivery area / slot** fields: WC checkout fields vs meta keys.

---

## 14. Document control

| Version | Date | Notes |
|---------|------|--------|
| 1.0 | 2026-04-02 | Derived from Google Doc “אפיון מערכת ליקוט”; gap analysis vs repo. |
