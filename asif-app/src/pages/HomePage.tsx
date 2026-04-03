import { useState, useEffect, useCallback } from 'react'
import type { AuthUser, Order } from '../api'
import {
  endCollectorShift,
  getCurrentShift,
  getMyOrders,
  getShiftStats,
  startCollectorShift,
  startOrder,
} from '../api'
import type { Shift, ShiftEndSummary, ShiftStatsPayload } from '../api'
import { clearUser } from '../auth'
import EndShiftSummaryModal from '../components/EndShiftSummaryModal'
const logo = '/logo.png'
import s from './HomePage.module.css'

type HomeTab = 'orders' | 'stats'

type PendingEndShift = {
  summary: ShiftEndSummary
  next: 'logout' | 'done'
} | null

interface Props {
  user: AuthUser
  onLogout: () => void
  onStartOrder: (order: Order) => void
}

function formatShiftMinutes(m: number): string {
  if (!Number.isFinite(m) || m <= 0) return 'פחות מדקה'
  if (m < 60) return `${Math.round(m)} דק׳`
  const h = Math.floor(m / 60)
  const min = Math.round(m % 60)
  if (min === 0) return `${h} שע׳`
  return `${h} שע׳ ו־${min} דק׳`
}

export default function HomePage({ user, onLogout, onStartOrder }: Props) {
  const [homeTab, setHomeTab] = useState<HomeTab>('orders')
  const [orders, setOrders] = useState<Order[]>([])
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [starting, setStarting] = useState(false)
  const [shift, setShift] = useState<Shift | null>(null)
  const [pendingEndShift, setPendingEndShift] = useState<PendingEndShift>(null)
  const [shiftBusy, setShiftBusy] = useState(false)
  const [statsPayload, setStatsPayload] = useState<ShiftStatsPayload | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState('')

  const loadShiftStats = useCallback(async () => {
    try {
      setStatsLoading(true)
      setStatsError('')
      setStatsPayload(await getShiftStats(user.id))
    } catch {
      setStatsError('לא ניתן לטעון סטטיסטיקה')
      setStatsPayload(null)
    } finally {
      setStatsLoading(false)
    }
  }, [user.id])

  const loadOrder = useCallback(
    async (opts?: { isRefresh?: boolean }) => {
      const isRefresh = opts?.isRefresh === true
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      try {
        const { orders: list, activeOrderId: active } = await getMyOrders(user.id)
        setOrders(list)
        setActiveOrderId(active)
        try {
          setShift(await getCurrentShift(user.id))
        } catch {
          setShift(null)
        }
      } catch {
        setOrders([])
        setActiveOrderId(null)
        setShift(null)
      } finally {
        if (isRefresh) setRefreshing(false)
        else setLoading(false)
      }
    },
    [user.id]
  )

  useEffect(() => {
    void loadOrder()
  }, [loadOrder])

  useEffect(() => {
    if (homeTab !== 'stats') return
    void loadShiftStats()
  }, [homeTab, loadShiftStats])

  useEffect(() => {
    if (homeTab !== 'stats' || !shift?.open) return
    const id = window.setInterval(() => void loadShiftStats(), 45_000)
    return () => window.clearInterval(id)
  }, [homeTab, shift?.open, loadShiftStats])

  async function handleRefreshAll() {
    await loadOrder({ isRefresh: true })
    if (homeTab === 'stats') void loadShiftStats()
  }

  async function handleStart(order: Order) {
    if (order.id !== activeOrderId) return
    setStarting(true)
    try {
      const started = order.status === 'assigned'
        ? await startOrder(order.id)
        : order
      onStartOrder(started)
    } finally {
      setStarting(false)
    }
  }

  async function performLogout() {
    await clearUser()
    onLogout()
  }

  async function handleLogout() {
    try {
      const r = await endCollectorShift(user.id)
      if (r.shift && r.summary) {
        setPendingEndShift({ summary: r.summary, next: 'logout' })
        return
      }
    } catch {
      /* fall through */
    }
    await performLogout()
  }

  async function handleEndShiftOnly() {
    setShiftBusy(true)
    try {
      const r = await endCollectorShift(user.id)
      if (r.shift && r.summary) {
        setPendingEndShift({ summary: r.summary, next: 'done' })
        return
      }
      void loadOrder({ isRefresh: true })
    } catch {
      void loadOrder({ isRefresh: true })
    } finally {
      setShiftBusy(false)
    }
  }

  async function handleStartShift() {
    setShiftBusy(true)
    try {
      await startCollectorShift(user.id)
      void loadOrder({ isRefresh: true })
      if (homeTab === 'stats') void loadShiftStats()
    } catch {
      /* ignore */
    } finally {
      setShiftBusy(false)
    }
  }

  async function handleSummaryConfirm() {
    const p = pendingEndShift
    setPendingEndShift(null)
    if (!p) return
    if (p.next === 'logout') {
      await performLogout()
      return
    }
    if (p.next === 'done') {
      // Stay on «הזמנות» so «התחל משמרת» is visible (it only lived there; stats tab had no CTA).
      setHomeTab('orders')
      void loadOrder({ isRefresh: true })
      void loadShiftStats()
    }
  }

  function shiftStartedLabel(iso: string): string {
    try {
      return new Date(iso).toLocaleString('he-IL', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    } catch {
      return iso
    }
  }

  const avgLabel =
    statsPayload?.summary?.averageOrderMinutes != null
      ? `${statsPayload.summary.averageOrderMinutes} דק׳`
      : 'אין נתונים (הזמנות בלי זמן התחלה)'

  return (
    <div className={s.page}>
      <header className={s.header}>
        <img src={logo} alt="אסיף" className={s.logo} />
        <div className={s.headerActions}>
          <button
            type="button"
            className={s.refreshBtn}
            onClick={() => void handleRefreshAll()}
            disabled={loading || refreshing || statsLoading}
            aria-label="רענון"
          >
            {refreshing || (homeTab === 'stats' && statsLoading) ? '…' : 'רענון'}
          </button>
          <button type="button" className={s.logoutBtn} onClick={handleLogout}>
            יציאה
          </button>
        </div>
      </header>

      <div className={s.body}>
        <p className={s.greeting}>שלום, {user.name}</p>

        <div className={s.tabBar} role="tablist" aria-label="מסכי בית">
          <button
            type="button"
            role="tab"
            aria-selected={homeTab === 'orders'}
            className={homeTab === 'orders' ? s.tabActive : s.tab}
            onClick={() => setHomeTab('orders')}
          >
            הזמנות
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={homeTab === 'stats'}
            className={homeTab === 'stats' ? s.tabActive : s.tab}
            onClick={() => {
              setHomeTab('stats')
              void loadShiftStats()
            }}
          >
            סטטיסטיקת משמרת
          </button>
        </div>

        {homeTab === 'orders' && (
          <>
            {!loading && shift?.open && (
              <div className={s.shiftBlock}>
                <p className={s.shiftLine} role="status">
                  משמרת פעילה · התחלה {shiftStartedLabel(shift.startedAt)}
                </p>
                <button
                  type="button"
                  className={s.shiftEndPrimaryBtn}
                  disabled={shiftBusy || !!pendingEndShift}
                  onClick={() => void handleEndShiftOnly()}
                >
                  {shiftBusy ? 'סוגר משמרת…' : 'סיום משמרת'}
                </button>
                <p className={s.shiftHint}>
                  בסיום יוצג סיכום; אפשר לעקוב אחרי נתונים בזמן אמת בלשונית «סטטיסטיקת משמרת».
                </p>
              </div>
            )}

            {!loading && (!shift || !shift.open) && (
              <div className={s.noShiftCard}>
                <p className={s.noShiftTitle}>אין משמרת פעילה</p>
                <p className={s.noShiftText}>
                  כדי לספור הזמנות וזמנים למשמרת, התחילו משמרת. אחרי סיום משמרת תופיע כאן אפשרות
                  לפתוח משמרת נוספת.
                </p>
                <button
                  type="button"
                  className={s.startShiftBtn}
                  disabled={shiftBusy || !!pendingEndShift}
                  onClick={() => void handleStartShift()}
                >
                  {shiftBusy ? 'פותח…' : 'התחל משמרת'}
                </button>
              </div>
            )}

            {loading && <p className={s.sub}>טוען...</p>}

            {!loading && orders.length === 0 && (
              <p className={s.sub}>אין הזמנות פתוחות כרגע</p>
            )}

            {!loading &&
              orders.map((order) => {
                const isActive = order.id === activeOrderId
                const collected = order.items.filter(i => i.status !== 'pending').length
                const total = order.items.length
                return (
                  <div
                    key={order.id}
                    className={`${s.orderCard} ${!isActive ? s.orderCardDisabled : ''}`}
                  >
                    <div className={s.orderMeta}>
                      <span className={s.orderId}>{order.id}</span>
                      <span className={s.customerName}>לקוח: {order.customerName}</span>
                    </div>

                    {!isActive && (
                      <p className={s.queueHint}>ממתין בתור — סיימו את ההזמנה הפעילה תחילה</p>
                    )}

                    {isActive && order.status === 'waiting_cs' && (
                      <p className={s.csHint}>
                        {(() => {
                          const hasMissing = order.items.some((i) => i.status === 'missing')
                          const note = (order.csHandoffReason ?? '').trim()
                          if (hasMissing && note) {
                            return 'יש פריטים חסרים והערת מלקט — ההזמנה מסומנת לשירות לקוחות; ניתן להמשיך ליקוט ולסיים כשכל השורות טופלו.'
                          }
                          if (hasMissing) {
                            return 'יש פריטים חסרים — ההזמנה מסומנת לשירות לקוחות; ניתן להמשיך ליקוט ולסיים כשכל השורות טופלו.'
                          }
                          return 'ההזמנה סומנה לשירות לקוחות לפי הערת המלקט; ניתן להמשיך בליקוט ולסיים כשכל השורות טופלו.'
                        })()}
                      </p>
                    )}

                    <div className={s.progressRow}>
                      <span className={s.progressText}>{collected} / {total} פריטים</span>
                      <div className={s.progressBar}>
                        <div
                          className={s.progressFill}
                          style={{ width: total ? `${(collected / total) * 100}%` : '0%' }}
                        />
                      </div>
                    </div>

                    <button
                      className={s.startBtn}
                      onClick={() => void handleStart(order)}
                      disabled={starting || !isActive}
                    >
                      {starting && isActive
                        ? 'פותח...'
                        : order.status === 'assigned'
                          ? 'התחל איסוף'
                          : 'המשך איסוף'}
                    </button>
                  </div>
                )
              })}
          </>
        )}

        {homeTab === 'stats' && (
          <div className={s.statsPanel}>
            {statsError ? <p className={s.sub}>{statsError}</p> : null}

            {!loading && (!shift || !shift.open) && (
              <div className={s.statsStartShiftBar}>
                <p className={s.statsStartShiftLabel}>אין משמרת פעילה — אפשר להתחיל משמרת חדשה</p>
                <button
                  type="button"
                  className={s.startShiftBtn}
                  disabled={shiftBusy || !!pendingEndShift}
                  onClick={() => void handleStartShift()}
                >
                  {shiftBusy ? 'פותח…' : 'התחל משמרת'}
                </button>
              </div>
            )}

            {statsPayload?.shiftOpen && (
              <p className={`${s.statsBanner} ${s.statsBannerProvisional}`} role="status">
                משמרת <strong>בתהליך</strong> — הנתונים מתעדכנים ואינם סופיים. משך העבודה וההזמנות נספרים
                עד הרגע. רענון אוטומטי כל 45 שניות.
              </p>
            )}

            {statsPayload && !statsPayload.shiftOpen && statsPayload.finalized && statsPayload.summary && (
              <p className={`${s.statsBanner} ${s.statsBannerFinal}`} role="status">
                סיכום <strong>סופי</strong> של המשמרת האחרונה שסגרת
                {statsPayload.shiftEndedAt
                  ? ` · סיום ${shiftStartedLabel(statsPayload.shiftEndedAt)}`
                  : ''}
              </p>
            )}

            {statsPayload &&
              !statsPayload.shiftOpen &&
              !statsPayload.finalized &&
              !statsPayload.summary && (
                <p className={`${s.statsBanner} ${s.statsBannerEmpty}`}>
                  אין עדיין משמרת סגורה במערכת. התחילו משמרת בלשונית «הזמנות», או סגרו הזמנה כדי
                  שיופיעו כאן נתונים.
                </p>
              )}

            <button
              type="button"
              className={s.statsRefresh}
              disabled={statsLoading}
              onClick={() => void loadShiftStats()}
            >
              {statsLoading ? 'טוען…' : 'רענן נתונים'}
            </button>

            {statsPayload?.summary && (
              <>
                {statsPayload.shiftStartedAt ? (
                  <p className={s.statsMeta}>
                    התחלת משמרת (לנתונים אלה): {shiftStartedLabel(statsPayload.shiftStartedAt)}
                  </p>
                ) : null}
                <ul className={s.statsList}>
                  <li>
                    <span className={s.statsLabel}>הזמנות שסגרת</span>
                    <span className={s.statsValue}>{statsPayload.summary.ordersFinished}</span>
                  </li>
                  <li>
                    <span className={s.statsLabel}>זמן עבודה במשמרת</span>
                    <span className={s.statsValue}>
                      {formatShiftMinutes(statsPayload.summary.totalShiftMinutes)}
                    </span>
                  </li>
                  <li>
                    <span className={s.statsLabel}>ממוצע זמן ליקוט להזמנה</span>
                    <span className={s.statsValue}>{avgLabel}</span>
                  </li>
                </ul>
              </>
            )}
          </div>
        )}
      </div>

      {pendingEndShift && (
        <EndShiftSummaryModal
          summary={pendingEndShift.summary}
          afterClose={pendingEndShift.next}
          onConfirm={() => void handleSummaryConfirm()}
        />
      )}
    </div>
  )
}
