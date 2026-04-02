# ASIF — Supermarket Order Collection App
### Product Definition Document
**Version:** 1.1 | **Date:** April 2026

---

## 1. Overview

**ASIF** is a mobile-first (iPhone) order collection app for in-store pickers/collectors working on online grocery orders. It connects to the supermarket's orders database, guides collectors through the store in the most efficient path, supports barcode scanning, scale weighing, and manual collection, and transmits completed orders to the ERP system.

The app is designed to be simple, minimal, and learnable in under 5 minutes.

---

## 2. The Problem

Online grocery fulfillment in supermarkets faces a set of operational challenges:

| Problem | Impact |
|---|---|
| Inefficient walking routes through the store | Wasted time, lower orders/hour |
| Missing items with no clear resolution path | Order errors, customer frustration |
| Produce/bulk items require weighing — no integrated workflow | Manual errors in weight/price |
| Collectors don't know order context or customer notes | Wrong item selection |
| No real-time feedback to back-office / ERP | Inventory inaccuracies, billing errors |

---

## 3. Target Users

### Primary: In-Store Collector
- Supermarket employee picking items from shelves for online orders
- Uses a company-issued iPhone
- May work full-time or part-time — app must be learnable in < 5 minutes

### Secondary: Store Manager
- Monitors all active collectors and their order progress from a dashboard

### Tertiary: ERP / Back-Office System
- Receives completed order data including final weights, missing items

---

## 4. Core User Journey

```
Login → Receive Order → Navigate by Optimized Pick List →
Scan / Weigh / Mark Collected → Mark Missing Items →
Complete Order → Submit to ERP
```

---

## 5. Feature Specification

### 5.1 Authentication

- **Login screen**: Employee ID + PIN (fast, no password typing)
- **Session**: Stay logged in for the shift; auto-logout after configurable idle time
- Single store — no store selection needed

---

### 5.2 Order Assignment & Home Screen

The home screen shows:
- Current assigned order (item count, customer first name, order ID)
- Button: **Start Collecting**
- Shift summary: orders completed today, items collected, accuracy rate

**Order assignment**: Manager or system assigns an order to a collector. Collector sees it appear on their home screen. One active order at a time in Phase 1.

---

### 5.3 Optimized Pick List

The list is sorted by the most efficient walking route through the store (route logic to be defined based on store layout — details to be provided).

**List layout:**
- Items grouped by aisle / section with a section header (e.g., "Dairy — 4 items")
- Overall progress bar: e.g., "7 / 23 collected"
- Each item card shows:
  - Product image
  - Product name + brand
  - Quantity needed
  - Location (aisle + shelf, if available)
  - Badge: **WEIGH** for weighted items
  - **Customer note** — if the customer left a note for this specific item (e.g., "please pick the least ripe", "avoid bruised ones"), it is shown prominently on the card, always visible without requiring a tap. Notes are per-item, not per-order.

**Actions per item:**
- Tap item → expand for detail + action buttons
- Scan barcode → auto-mark as collected
- Manual collect button (for items without barcode or when scan not needed)
- Mark as missing

---

### 5.4 Item Collection Methods

#### A. Barcode Scan (Primary)
- iPhone camera-based scanning (no external hardware needed)
- Supports: EAN-13, EAN-8, QR, Code 128, Code 39
- Haptic + audio feedback on successful scan
- If scanned barcode doesn't match expected but collector confirms correct item: **force-confirm** (collector takes a photo for audit trail)
- Multi-unit: scan same item multiple times, or enter quantity

#### B. Scale Integration (Weighted Items)
- For produce, bulk, and deli items sold by weight
- **Connection options** (decision TBD based on hardware procurement):
  - **Bluetooth Low Energy (BLE)** — most portable, no cable, minor pairing overhead
  - **Wired (USB-C or Lightning)** — most reliable, zero pairing, tethers phone to scale
  - **WiFi** — works if store WiFi is reliable; useful for fixed weighing stations
- Flow:
  1. Item card shows target weight range (e.g., "~500g")
  2. Collector places item on scale
  3. Weight populates automatically (or entered manually if needed)
  4. Collector confirms
  5. App calculates price = weight × unit price and records it
- Manual weight entry always available as fallback
- Scale connection status shown in header

#### C. Manual Collection (No Scan / No Scale)
- Collector taps **"Collect Manually"** and confirms quantity
- Flagged in order summary as manually confirmed (visible to manager)

---

### 5.5 Missing Item Workflow

When an item is not available:

1. Collector taps **"Missing"** on the item card
2. Selects a reason:
   - Out of stock
   - Cannot locate
   - Item damaged / not sellable
3. Item is marked missing in the order and skipped
4. Missing items are listed in the order summary and included in the ERP submission

> **Substitution is Phase 2** — no suggestions, no customer notifications in MVP.

---

### 5.6 Order Completion & ERP Submission

When all items are actioned (collected or missing):

1. **Summary screen** shows:
   - Collected items with quantities / weights
   - Missing items with reasons
   - Items flagged as manually confirmed
2. Collector reviews and taps **Submit Order**
3. Order payload sent to ERP via configured API endpoint
4. Confirmation screen shown with order ID and timestamp
5. Collector returns to home screen and awaits next order

**ERP payload includes:**
- Order ID, store ID, collector ID
- Timestamps: assigned, started, submitted
- Per item: SKU, quantity, weight (if applicable), price, status (collected / missing), collection method (scan / scale / manual), substitution details (Phase 2), photo if force-confirmed

---

### 5.7 Manager Dashboard

A web-based dashboard (or dedicated in-app view for managers) showing live operational status.

**Dashboard displays:**

| Column | Description |
|---|---|
| Collector name | Who is working |
| Current order ID | Which order they are on |
| Progress | Items collected / total (e.g., 14 / 23) |
| Start time | When they started this order |
| Status | Idle / In Progress / Submitted |
| Exceptions | Count of missing items flagged so far |

**Interactions:**
- Manager can assign an order to a collector
- Manager can view the full detail of any active or completed order
- Manager can see all completed orders for the current shift

**Refresh:** Live (WebSocket or polling every 10–30 seconds)

---

## 6. What's Out of Scope (Phase 1)

- Multi-store support
- Offline mode
- Zone picking / batch picking
- Order deadlines / slot times display
- Substitution suggestions, customer SMS, or approval workflow
- Produce quality guidance
- Voice-guided picking
- Android support
- Delivery / driver assignment

---

## 7. Technical Architecture (High-Level)

```
iPhone App (React + Capacitor)
    │
    ├── @capacitor-community/bluetooth-le  → BLE Scale
    ├── @capacitor-mlkit/barcode-scanning  → Barcode Scanner
    └── REST / WebSocket                   → Backend API

Backend (Node.js + TypeScript)
    │
    ├── Orders DB         — order + item data (PostgreSQL)
    ├── Product Catalog   — barcodes, images, pricing, weight flags
    ├── Store Layout DB   — aisle/section/shelf map for route ordering
    ├── WebSocket         — live updates to manager dashboard
    └── ERP Integration   — outbound webhook/REST on order submission

Manager Dashboard
    └── React (web) — reads from backend via REST + WebSocket
```

---

## 8. Non-Functional Requirements

| Requirement | Target |
|---|---|
| App launch to first item | < 3 seconds |
| Barcode scan to confirmation | < 0.5 seconds |
| Scale reading latency | < 1 second |
| iOS version support | iOS 16+ |
| Supported devices | iPhone 12 and newer |
| Data security | TLS 1.3 in transit; no customer PII beyond first name on device |
| Onboarding time | < 5 minutes for new collector |

---

## 9. Roadmap

| Phase | Features |
|---|---|
| **Phase 1 — MVP** | Login, order assignment, optimized pick list, barcode scan, scale weighing, manual collect, missing item, ERP submission, manager dashboard |
| **Phase 2 — Substitutions** | AI substitution suggestions, customer SMS/notification, configurable substitution policy, customer approval flow |
| **Phase 3 — Efficiency** | Batch picking, shift performance metrics, voice-guided mode, predictive out-of-stock flagging |

---

## 10. Open Questions

1. **Efficient path / store layout**: How is the optimal picking route defined? (Aisle number sequence? Custom map? To be provided.)
2. **Scale hardware**: Which model(s) will be used, and what is the connection type — BLE, USB-C, or WiFi?
3. **ERP system**: Which ERP will ASIF integrate with? (SAP, Priority, NetSuite, custom?) — defines payload schema.
4. **Orders DB**: Schema and connectivity method (direct DB, REST API, middleware)?
5. **Product catalog**: Where do product images, barcodes, and location data come from?
6. **Order assignment**: Is it manual (manager assigns) or automatic (system pushes to available collector)?
7. **Manager dashboard**: Web browser or native iPhone app for managers?

---

*Document maintained by the ASIF product team. Last updated: April 2026.*
