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

function fmtDeliveryDate(yyyyMmDd: string | null | undefined): string {
  if (!yyyyMmDd) return '—'
  const parts = yyyyMmDd.trim().split('-').map((x) => parseInt(x, 10))
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return yyyyMmDd
  const [y, m, d] = parts
  try {
    return new Date(y, m - 1, d).toLocaleDateString('he-IL', { dateStyle: 'short' })
  } catch {
    return yyyyMmDd
  }
}

function fmtDeliveryWindow(o: Order): string {
  const a = o.deliveryTimeFrom?.trim()
  const b = o.deliveryTimeTo?.trim()
  if (!a && !b) return '—'
  return `${a || '—'} – ${b || '—'}`
}

function timeStrToMinutes(t: string | null | undefined): number | null {
  if (!t || typeof t !== 'string') return null
  const m = t.trim().match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

/** Overlap between order delivery window and filter range [filterFrom, filterTo] (inclusive minutes). */
function orderOverlapsTimeFilter(
  o: Order,
  filterFrom: string,
  filterTo: string
): boolean {
  if (!filterFrom && !filterTo) return true
  const fStart = filterFrom ? timeStrToMinutes(filterFrom) ?? 0 : 0
  const fEnd = filterTo ? timeStrToMinutes(filterTo) ?? 24 * 60 - 1 : 24 * 60 - 1
  const oStartRaw = o.deliveryTimeFrom
  const oEndRaw = o.deliveryTimeTo ?? o.deliveryTimeFrom
  if (!oStartRaw && !oEndRaw) return true
  const oStart = timeStrToMinutes(oStartRaw) ?? 0
  const oEnd = timeStrToMinutes(oEndRaw ?? oStartRaw) ?? oStart
  return !(oEnd < fStart || oStart > fEnd)
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
  const [filterDeliveryDate, setFilterDeliveryDate] = useState('')
  const [filterArea, setFilterArea] = useState('')
  const [filterTimeFrom, setFilterTimeFrom] = useState('')
  const [filterTimeTo, setFilterTimeTo] = useState('')
  const [assignFor, setAssignFor] = useState<Order | null>(null)
  const [pickCollectorId, setPickCollectorId] = useState('')
  const [assigning, setAssigning] = useState(false)

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

  const distinctAreas = useMemo(() => {
    const set = new Set<string>()
    for (const o of orders) {
      const a = (o.distributionArea ?? '').trim()
      if (a) set.add(a)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'he'))
  }, [orders])

  const hasLogisticsFilters =
    Boolean(filterDeliveryDate) ||
    Boolean(filterArea) ||
    Boolean(filterTimeFrom) ||
    Boolean(filterTimeTo)

  const filtered = useMemo(() => {
    let safe = orders.filter((o) => o && typeof o.id === 'string')
    if (statusFilter !== 'all') safe = safe.filter((o) => o.status === statusFilter)
    if (filterDeliveryDate) {
      safe = safe.filter((o) => o.deliveryDate === filterDeliveryDate)
    }
    if (filterArea) {
      safe = safe.filter((o) => (o.distributionArea ?? '').trim() === filterArea)
    }
    if (filterTimeFrom || filterTimeTo) {
      safe = safe.filter((o) => orderOverlapsTimeFilter(o, filterTimeFrom, filterTimeTo))
    }
    return safe
  }, [
    orders,
    statusFilter,
    filterDeliveryDate,
    filterArea,
    filterTimeFrom,
    filterTimeTo,
  ])

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
        <p className={s.logisticsFiltersTitle}>סינון לוגיסטיקה (הקצאה למלקט)</p>
        <div className={s.filterField}>
          <label htmlFor="filter-delivery-date">תאריך חלוקה</label>
          <input
            id="filter-delivery-date"
            className={s.filterInput}
            type="date"
            value={filterDeliveryDate}
            onChange={(e) => setFilterDeliveryDate(e.target.value)}
          />
        </div>
        <div className={s.filterField}>
          <label htmlFor="filter-area">אזור חלוקה</label>
          <select
            id="filter-area"
            className={s.filterSelect}
            value={filterArea}
            onChange={(e) => setFilterArea(e.target.value)}
          >
            <option value="">כל האזורים</option>
            {distinctAreas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div className={s.filterField}>
          <label htmlFor="filter-time-from">משעה</label>
          <input
            id="filter-time-from"
            className={s.filterInput}
            type="time"
            value={filterTimeFrom}
            onChange={(e) => setFilterTimeFrom(e.target.value)}
          />
        </div>
        <div className={s.filterField}>
          <label htmlFor="filter-time-to">עד שעה</label>
          <input
            id="filter-time-to"
            className={s.filterInput}
            type="time"
            value={filterTimeTo}
            onChange={(e) => setFilterTimeTo(e.target.value)}
          />
        </div>
        <button
          type="button"
          className={s.filterReset}
          disabled={!hasLogisticsFilters}
          onClick={() => {
            setFilterDeliveryDate('')
            setFilterArea('')
            setFilterTimeFrom('')
            setFilterTimeTo('')
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
              : hasLogisticsFilters || statusFilter !== 'all'
                ? 'אין הזמנות במסנן הנוכחי. נסו «הכל», איפוס סינון לוגיסטיקה או רענון.'
                : 'אין הזמנות במסנן הנוכחי. נסו «הכל» או רענון.'}
          </p>
        </div>
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>WC</th>
                <th>לקוח</th>
                <th>תאריך חלוקה</th>
                <th>אזור</th>
                <th>חלון שעות</th>
                <th>הערת ש״ל</th>
                <th>סטטוס</th>
                <th>פריטים</th>
                <th>ליקוטן</th>
                <th>התחלה</th>
                <th>סיום</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id}>
                  <td>{o.wcOrderId ?? '—'}</td>
                  <td>{o.customerName || '—'}</td>
                  <td>{fmtDeliveryDate(o.deliveryDate ?? undefined)}</td>
                  <td>{(o.distributionArea ?? '').trim() || '—'}</td>
                  <td>{fmtDeliveryWindow(o)}</td>
                  <td
                    className={s.noteCell}
                    title={(o.csHandoffReason ?? '').trim() || undefined}
                  >
                    {(o.csHandoffReason ?? '').trim()
                      ? `${(o.csHandoffReason ?? '').trim().slice(0, 48)}${
                          (o.csHandoffReason ?? '').trim().length > 48 ? '…' : ''
                        }`
                      : '—'}
                  </td>
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
