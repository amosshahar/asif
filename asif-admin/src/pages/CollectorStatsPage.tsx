import { useState, useEffect, useCallback, useMemo } from 'react'
import { getCollectorStats, getUsers } from '../api'
import type { CollectorStatsPayload, User } from '../api'
import s from './CollectorStatsPage.module.css'

const DAY_OPTIONS = [7, 14, 30, 90] as const

function formatDuration(sec: number | null): string {
  if (sec == null) return '—'
  if (sec < 60) return `${sec} שנ׳`
  const m = Math.floor(sec / 60)
  const r = sec % 60
  return r ? `${m} דק׳ ${r} שנ׳` : `${m} דק׳`
}

function fmtRange(isoFrom: string, isoTo: string): string {
  try {
    const o: Intl.DateTimeFormatOptions = { dateStyle: 'short', timeStyle: 'short' }
    return `${new Date(isoFrom).toLocaleString('he-IL', o)} – ${new Date(isoTo).toLocaleString('he-IL', o)}`
  } catch {
    return `${isoFrom} – ${isoTo}`
  }
}

export default function CollectorStatsPage() {
  const [users, setUsers] = useState<User[]>([])
  const [collectorId, setCollectorId] = useState('')
  const [days, setDays] = useState<number>(7)
  const [stats, setStats] = useState<CollectorStatsPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const collectors = useMemo(
    () => users.filter((u) => u.role === 'collector'),
    [users]
  )

  useEffect(() => {
    void getUsers().then((u) => setUsers(Array.isArray(u) ? u : []))
  }, [])

  useEffect(() => {
    if (collectors.length && !collectorId) {
      setCollectorId(collectors[0].id)
    }
  }, [collectors, collectorId])

  const load = useCallback(async () => {
    if (!collectorId) return
    setLoading(true)
    setError('')
    try {
      setStats(await getCollectorStats(collectorId, { days }))
    } catch {
      setStats(null)
      setError('שגיאה בטעינת הסטטיסטיקה')
    } finally {
      setLoading(false)
    }
  }, [collectorId, days])

  useEffect(() => {
    if (collectorId) void load()
  }, [collectorId, days, load])

  return (
    <div className={s.page}>
      <div className={s.header}>
        <div>
          <h1 className={s.title}>מדידות זמן ליקוט</h1>
          <p className={s.subtitle}>
            זמן ליקוט להזמנה: מהתחלת ליקוט (לחיצה על התחלה) ועד סגירת ההזמנה. זמן בין פריטים: ממוצע
            הפערים בין סימון שורה כנאסף/חסר לשורה הבאה (נשמר אוטומטית בשרת). הזמנות ישנות לפני העדכון
            עשויות להציג רק זמן כולל בלי פירוט בין פריטים.
          </p>
        </div>
        <div className={s.controls}>
          <div className={s.field}>
            <label htmlFor="stats-collector">ליקוטן</label>
            <select
              id="stats-collector"
              className={s.select}
              value={collectorId}
              onChange={(e) => setCollectorId(e.target.value)}
            >
              {collectors.length === 0 ? (
                <option value="">אין ליקוטנים</option>
              ) : (
                collectors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.id})
                  </option>
                ))
              )}
            </select>
          </div>
          <div className={s.field}>
            <label htmlFor="stats-days">חלון</label>
            <select
              id="stats-days"
              className={s.select}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} ימים אחרונים
                </option>
              ))}
            </select>
          </div>
          <button type="button" className={s.refreshBtn} disabled={loading || !collectorId} onClick={() => void load()}>
            {loading ? 'טוען…' : 'רענן'}
          </button>
        </div>
      </div>

      {error && <div className={s.error}>{error}</div>}

      {stats && (
        <>
          <p className={s.subtitle} style={{ marginBottom: 16 }}>
            <strong>{stats.collectorName}</strong> · {stats.orderCount} הזמנות נסגרו בטווח ·{' '}
            {fmtRange(stats.from, stats.to)}
          </p>

          <div className={s.metrics}>
            <div className={s.metric}>
              <div className={s.metricLabel}>ממוצע זמן ליקוט להזמנה</div>
              <div className={s.metricValue}>{formatDuration(stats.avgPickDurationSeconds)}</div>
              <div className={s.metricHint}>
                חציון: {formatDuration(stats.medianPickDurationSeconds)} · מתוך{' '}
                {stats.ordersWithPickTiming}/{stats.orderCount} עם התחלה+סיום
              </div>
            </div>
            <div className={s.metric}>
              <div className={s.metricLabel}>ממוצע זמן בין פריטים</div>
              <div className={s.metricValue}>{formatDuration(stats.avgGapBetweenItemsSeconds)}</div>
              <div className={s.metricHint}>
                חציון: {formatDuration(stats.medianGapBetweenItemsSeconds)} · על כל זוגות סיום שורות
                רצופות
              </div>
            </div>
            <div className={s.metric}>
              <div className={s.metricLabel}>ממוצע עד פריט ראשון</div>
              <div className={s.metricValue}>{formatDuration(stats.avgTimeToFirstItemSeconds)}</div>
              <div className={s.metricHint}>מהתחלת הליקוט ועד סימון השורה הראשונה</div>
            </div>
          </div>

          {stats.orders.length === 0 ? (
            <p className={s.empty}>אין הזמנות שנסגרו בטווח שנבחר.</p>
          ) : (
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>הזמנה</th>
                    <th>סגירה</th>
                    <th>זמן ליקוט</th>
                    <th>ממוצע בין פריטים</th>
                    <th>עד פריט ראשון</th>
                    <th>שורות נספרו</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.orders.map((o) => (
                    <tr key={o.orderId}>
                      <td>{o.orderId}</td>
                      <td>
                        {o.completedAt
                          ? new Date(o.completedAt).toLocaleString('he-IL', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })
                          : '—'}
                      </td>
                      <td>{formatDuration(o.pickDurationSeconds)}</td>
                      <td>{formatDuration(o.avgGapBetweenItemsSeconds)}</td>
                      <td>{formatDuration(o.timeToFirstItemSeconds)}</td>
                      <td>{o.itemsResolved}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
