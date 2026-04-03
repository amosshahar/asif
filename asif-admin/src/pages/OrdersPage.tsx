import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  getOrders,
  getUsers,
  assignOrder,
  getWooCommerceAdminStatus,
  syncWooCommerceOrders,
} from '../api'
import type { WcSyncOnLoad } from '../api'
import type { Order, User } from '../api'
import s from './OrdersPage.module.css'

const STATUS_LABEL: Record<Order['status'], string> = {
  queued: 'בתור',
  assigned: 'הוקצה',
  in_progress: 'בליקוט',
  completed: 'הושלם',
  waiting_cs: 'ממתין לשירות',
}

const STATUS_CLASS: Record<Order['status'], string> = {
  queued: s.statusQueued,
  assigned: s.statusAssigned,
  in_progress: s.statusProgress,
  completed: s.statusDone,
  waiting_cs: s.statusCs,
}

type StatusFilter = 'all' | Order['status']

type SortKey = 'wc' | 'customer' | 'status' | 'items' | 'collector' | 'started' | 'completed'

const STATUS_SORT_ORDER: Record<Order['status'], number> = {
  queued: 0,
  assigned: 1,
  in_progress: 2,
  waiting_cs: 3,
  completed: 4,
}

function itemMetrics(items: Order['items'] | undefined): { lines: number; units: number } {
  const list = Array.isArray(items) ? items : []
  return {
    lines: list.length,
    units: list.reduce((acc, i) => acc + (i.quantity ?? 0), 0),
  }
}

function itemSummary(items: Order['items'] | undefined): string {
  const list = Array.isArray(items) ? items : []
  const lines = list.length
  const units = list.reduce((acc, i) => acc + (i.quantity ?? 0), 0)
  return `${lines} שורות · ${units} יח׳`
}

function fmtWhen(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('he-IL', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

function normIncludes(hay: string, needle: string): boolean {
  const n = needle.trim().toLowerCase()
  if (!n) return true
  return hay.toLowerCase().includes(n)
}

function collectorSortLabel(o: Order, nameById: Map<string, string>): string {
  if (!o.assignedTo) return ''
  return (nameById.get(o.assignedTo) ?? o.assignedTo).trim()
}

function compareIso(a: string | null, b: string | null, dir: 1 | -1): number {
  const ta = a ? new Date(a).getTime() : NaN
  const tb = b ? new Date(b).getTime() : NaN
  const aBad = Number.isNaN(ta)
  const bBad = Number.isNaN(tb)
  if (aBad && bBad) return 0
  if (aBad) return 1
  if (bBad) return -1
  return dir * (ta - tb)
}

function compareTextHe(a: string, b: string, dir: 1 | -1): number {
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  return dir * a.localeCompare(b, 'he', { sensitivity: 'base' })
}

function sortOrdersList(
  list: Order[],
  key: SortKey,
  dir: 'asc' | 'desc',
  nameById: Map<string, string>
): Order[] {
  const m: 1 | -1 = dir === 'asc' ? 1 : -1
  return [...list].sort((a, b) => {
    let c = 0
    switch (key) {
      case 'wc': {
        const na = a.wcOrderId
        const nb = b.wcOrderId
        if (na == null && nb == null) c = 0
        else if (na == null) c = 1
        else if (nb == null) c = -1
        else c = m * (na - nb)
        break
      }
      case 'customer':
        c = compareTextHe((a.customerName ?? '').trim(), (b.customerName ?? '').trim(), m)
        break
      case 'status':
        c = m * (STATUS_SORT_ORDER[a.status] - STATUS_SORT_ORDER[b.status])
        break
      case 'items': {
        const ia = itemMetrics(a.items)
        const ib = itemMetrics(b.items)
        if (ia.lines !== ib.lines) c = m * (ia.lines - ib.lines)
        else c = m * (ia.units - ib.units)
        break
      }
      case 'collector':
        c = compareTextHe(collectorSortLabel(a, nameById), collectorSortLabel(b, nameById), m)
        break
      case 'started':
        c = compareIso(a.startedAt, b.startedAt, m)
        break
      case 'completed':
        c = compareIso(a.completedAt, b.completedAt, m)
        break
      default:
        break
    }
    if (c !== 0) return c
    return a.id.localeCompare(b.id)
  })
}

function axiosErrorMessage(err: unknown): string {
  const ax = err as {
    message?: string
    response?: { status?: number; data?: { error?: string; detail?: string } }
  }
  const body = ax?.response?.data?.error ?? ax?.response?.data?.detail
  if (body) return body
  if (ax?.response?.status) return `HTTP ${ax.response.status}`
  if (ax?.message) return ax.message
  return 'שגיאה'
}

const BG_POLL_MS = 2000
const BG_POLL_MAX_MS = 90_000

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [wcSync, setWcSync] = useState<WcSyncOnLoad | null>(null)
  const [wcBgSyncing, setWcBgSyncing] = useState(false)
  const bgPollStarted = useRef(0)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [filterCustomer, setFilterCustomer] = useState('')
  const [filterWcId, setFilterWcId] = useState('')
  const [assignFor, setAssignFor] = useState<Order | null>(null)
  const [pickCollectorId, setPickCollectorId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [sortState, setSortState] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'wc',
    dir: 'desc',
  })

  const collectors = useMemo(
    () => users.filter((u) => u.role === 'collector'),
    [users]
  )

  const nameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const u of users) m.set(u.id, u.name)
    return m
  }, [users])

  /** Fast list from Firestore; WC sync runs in background on server unless firestoreOnly. */
  const load = useCallback(async (opts?: { firestoreOnly?: boolean }) => {
    try {
      setLoading(true)
      const [orderRes, u] = await Promise.all([
        getOrders({ firestoreOnly: opts?.firestoreOnly === true }),
        getUsers(),
      ])
      setOrders(orderRes.orders)
      setWcSync(orderRes.wcSync)
      setUsers(Array.isArray(u) ? u : [])
      setError('')
    } catch (e) {
      setWcSync(null)
      setError(`שגיאה בטעינת ההזמנות: ${axiosErrorMessage(e)}`)
    } finally {
      setLoading(false)
    }
  }, [])

  /** Waits for full WooCommerce → Firestore sync, then reloads list from Firestore. */
  const loadFullWcRefresh = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      await syncWooCommerceOrders()
      const [orderRes, u] = await Promise.all([
        getOrders({ firestoreOnly: true }),
        getUsers(),
      ])
      setOrders(orderRes.orders)
      setWcSync('ok')
      setUsers(Array.isArray(u) ? u : [])
    } catch (e) {
      setError(`שגיאה בסנכרון / טעינה: ${axiosErrorMessage(e)}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (wcSync !== 'pending') {
      setWcBgSyncing(false)
      return
    }
    setWcBgSyncing(true)
    bgPollStarted.current = Date.now()
    const tick = async () => {
      if (Date.now() - bgPollStarted.current > BG_POLL_MAX_MS) {
        setWcBgSyncing(false)
        setWcSync('error')
        return
      }
      try {
        const st = await getWooCommerceAdminStatus()
        if (!st.fullSyncRunning) {
          setWcBgSyncing(false)
          const orderRes = await getOrders({ firestoreOnly: true })
          setOrders(orderRes.orders)
          setWcSync(st.fullSyncLastError ? 'error' : 'ok')
        }
      } catch {
        /* ignore transient poll errors */
      }
    }
    void tick()
    const id = window.setInterval(() => void tick(), BG_POLL_MS)
    return () => window.clearInterval(id)
  }, [wcSync])

  const hasColumnFilters =
    Boolean(filterCustomer.trim()) || Boolean(filterWcId.trim())

  const filtered = useMemo(() => {
    let safe = orders.filter((o) => o && typeof o.id === 'string')
    if (statusFilter !== 'all') safe = safe.filter((o) => o.status === statusFilter)
    if (filterCustomer.trim()) {
      safe = safe.filter((o) => normIncludes(o.customerName ?? '', filterCustomer))
    }
    if (filterWcId.trim()) {
      const needle = filterWcId.trim().replace(/^#/, '').replace(/\s/g, '')
      safe = safe.filter((o) => {
        if (o.wcOrderId == null) return false
        return String(o.wcOrderId).includes(needle)
      })
    }
    return safe
  }, [orders, statusFilter, filterCustomer, filterWcId])

  const sortedOrders = useMemo(
    () => sortOrdersList(filtered, sortState.key, sortState.dir, nameById),
    [filtered, sortState.key, sortState.dir, nameById]
  )

  function toggleSort(key: SortKey) {
    setSortState((s) =>
      s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    )
  }

  function sortIndicator(key: SortKey): string {
    if (sortState.key !== key) return ''
    return sortState.dir === 'asc' ? ' ▲' : ' ▼'
  }

  function thAriaSort(key: SortKey): 'none' | 'ascending' | 'descending' {
    if (sortState.key !== key) return 'none'
    return sortState.dir === 'asc' ? 'ascending' : 'descending'
  }

  async function confirmAssign() {
    if (!assignFor || !pickCollectorId) return
    setAssigning(true)
    try {
      await assignOrder(assignFor.id, pickCollectorId)
      setAssignFor(null)
      setPickCollectorId('')
      await load({ firestoreOnly: true })
    } catch (e) {
      alert(axiosErrorMessage(e))
    } finally {
      setAssigning(false)
    }
  }

  function openAssign(o: Order) {
    setAssignFor(o)
    setPickCollectorId(o.assignedTo && collectors.some((c) => c.id === o.assignedTo) ? o.assignedTo : '')
  }

  const filterButtons: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'הכל' },
    { key: 'queued', label: STATUS_LABEL.queued },
    { key: 'assigned', label: STATUS_LABEL.assigned },
    { key: 'in_progress', label: STATUS_LABEL.in_progress },
    { key: 'completed', label: STATUS_LABEL.completed },
    { key: 'waiting_cs', label: STATUS_LABEL.waiting_cs },
  ]

  return (
    <div className={s.page}>
      <div className={s.header}>
        <div>
          <h1 className={s.title}>הזמנות</h1>
          <p className={s.subtitle}>
            {filtered.length} מתוך {orders.length} הזמנות
          </p>
        </div>
        <div className={s.toolbar}>
          <button
            type="button"
            className={s.refreshBtn}
            disabled={loading}
            onClick={() => void loadFullWcRefresh()}
            title="ממתין לסנכרון מלא מ-WooCommerce ואז טוען את הרשימה מ-Firestore"
          >
            {loading ? 'טוען…' : 'רענון'}
          </button>
        </div>
      </div>

      {wcBgSyncing && (
        <div className={s.syncPending} role="status">
          מסנכרן מול WooCommerce ברקע — הרשימה כבר מ-Firestore ותתעדכן כשהסנכרון יסתיים.
        </div>
      )}
      {wcSync === 'skipped' && (
        <div className={s.syncWarn} role="status">
          WooCommerce לא מוגדר בשרת (WC_*) — מוצגות רק הזמנות שכבר ב-Firestore.
        </div>
      )}
      {wcSync === 'error' && (
        <div className={s.error} role="alert">
          סנכרון WooCommerce נכשל — מוצגות הזמנות שמורות ב-Firestore. בדקו מפתחות, סטטוסים ורשת; נסו רענון.
        </div>
      )}
      {error && <div className={s.error}>{error}</div>}

      <div className={s.filters}>
        {filterButtons.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={statusFilter === key ? s.filterBtnActive : s.filterBtn}
            onClick={() => setStatusFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={s.logisticsFilters}>
        <p className={s.logisticsFiltersTitle}>סינון לפי עמודות</p>
        <div className={s.filterField}>
          <label htmlFor="filter-wc-id">WC</label>
          <input
            id="filter-wc-id"
            className={s.filterInput}
            type="text"
            inputMode="numeric"
            placeholder="מס׳ הזמנה"
            value={filterWcId}
            onChange={(e) => setFilterWcId(e.target.value)}
          />
        </div>
        <div className={s.filterField}>
          <label htmlFor="filter-customer">לקוח</label>
          <input
            id="filter-customer"
            className={s.filterInput}
            type="search"
            placeholder="שם"
            value={filterCustomer}
            onChange={(e) => setFilterCustomer(e.target.value)}
          />
        </div>
        <button
          type="button"
          className={s.filterReset}
          disabled={!hasColumnFilters}
          onClick={() => {
            setFilterCustomer('')
            setFilterWcId('')
          }}
        >
          איפוס סינון
        </button>
      </div>

      {loading ? (
        <div className={s.loading}>טוען...</div>
      ) : filtered.length === 0 ? (
        <div className={s.tableWrap}>
          <p className={s.empty}>
            {orders.length === 0 && !error
              ? 'אין הזמנות. אם הוגדר WooCommerce בשרת, נסו «רענון»; אחרת הגדירו WC_* ב-.env.'
              : hasColumnFilters || statusFilter !== 'all'
                ? 'אין הזמנות במסנן הנוכחי. נסו «הכל», איפוס סינון או רענון.'
                : 'אין הזמנות במסנן הנוכחי. נסו «הכל» או רענון.'}
          </p>
        </div>
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th scope="col" aria-sort={thAriaSort('wc')}>
                  <button type="button" className={s.thSortBtn} onClick={() => toggleSort('wc')}>
                    WC{sortIndicator('wc')}
                  </button>
                </th>
                <th scope="col" aria-sort={thAriaSort('customer')}>
                  <button
                    type="button"
                    className={s.thSortBtn}
                    onClick={() => toggleSort('customer')}
                  >
                    לקוח{sortIndicator('customer')}
                  </button>
                </th>
                <th scope="col" aria-sort={thAriaSort('status')}>
                  <button type="button" className={s.thSortBtn} onClick={() => toggleSort('status')}>
                    סטטוס{sortIndicator('status')}
                  </button>
                </th>
                <th scope="col" aria-sort={thAriaSort('items')}>
                  <button type="button" className={s.thSortBtn} onClick={() => toggleSort('items')}>
                    פריטים{sortIndicator('items')}
                  </button>
                </th>
                <th scope="col" aria-sort={thAriaSort('collector')}>
                  <button
                    type="button"
                    className={s.thSortBtn}
                    onClick={() => toggleSort('collector')}
                  >
                    ליקוטן{sortIndicator('collector')}
                  </button>
                </th>
                <th scope="col" aria-sort={thAriaSort('started')}>
                  <button
                    type="button"
                    className={s.thSortBtn}
                    onClick={() => toggleSort('started')}
                  >
                    התחלה{sortIndicator('started')}
                  </button>
                </th>
                <th scope="col" aria-sort={thAriaSort('completed')}>
                  <button
                    type="button"
                    className={s.thSortBtn}
                    onClick={() => toggleSort('completed')}
                  >
                    סיום{sortIndicator('completed')}
                  </button>
                </th>
                <th scope="col" className={s.thActions} aria-label="פעולות" />
              </tr>
            </thead>
            <tbody>
              {sortedOrders.map((o) => (
                <tr key={o.id}>
                  <td>{o.wcOrderId ?? '—'}</td>
                  <td>{o.customerName || '—'}</td>
                  <td>
                    <span
                      className={`${s.statusBadge} ${STATUS_CLASS[o.status] ?? s.statusQueued}`}
                    >
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  </td>
                  <td>{itemSummary(o.items)}</td>
                  <td>
                    {o.assignedTo
                      ? nameById.get(o.assignedTo) ?? o.assignedTo.slice(0, 8)
                      : '—'}
                  </td>
                  <td>{fmtWhen(o.startedAt)}</td>
                  <td>{fmtWhen(o.completedAt)}</td>
                  <td>
                    <button
                      type="button"
                      className={s.assignBtn}
                      disabled={o.status === 'completed'}
                      onClick={() => openAssign(o)}
                    >
                      {o.assignedTo ? 'הקצה מחדש' : 'הקצה'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {assignFor && (
        <div
          className={s.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="assign-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setAssignFor(null)
              setPickCollectorId('')
            }
          }}
        >
          <div className={s.modal}>
            <h2 id="assign-title" className={s.modalTitle}>
              הקצאת ליקוטן
            </h2>
            <p className={s.modalHint}>
              הזמנה WC #{assignFor.wcOrderId ?? '?'} · {assignFor.customerName || 'ללא שם'}
            </p>
            {collectors.length === 0 ? (
              <p className={s.modalHint}>אין ליקוטנים במערכת — הוסיפו משתמש עם תפקיד ליקוטן.</p>
            ) : (
              <select
                className={s.select}
                value={pickCollectorId}
                onChange={(e) => setPickCollectorId(e.target.value)}
                aria-label="בחירת ליקוטן"
              >
                <option value="">בחרו ליקוטן</option>
                {collectors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.id})
                  </option>
                ))}
              </select>
            )}
            <div className={s.modalActions}>
              <button
                type="button"
                className={`${s.modalBtn} ${s.modalCancel}`}
                onClick={() => {
                  setAssignFor(null)
                  setPickCollectorId('')
                }}
              >
                ביטול
              </button>
              <button
                type="button"
                className={`${s.modalBtn} ${s.modalOk}`}
                disabled={!pickCollectorId || assigning || collectors.length === 0}
                onClick={() => void confirmAssign()}
              >
                {assigning ? 'שומר…' : 'אישור'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
