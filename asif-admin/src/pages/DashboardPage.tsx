import { useState, useEffect, useCallback } from 'react'
import { getDashboard } from '../api'
import type { DashboardOrderEntry, DashboardRow } from '../api'
import s from './DashboardPage.module.css'

const POLL_MS = 15_000

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
}

function elapsed(iso: string | null): string {
  if (!iso) return ''
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'פחות מדקה'
  return `${mins} דק׳`
}

const STATUS_LABEL: Record<string, string> = {
  assigned:    'ממתין',
  in_progress: 'באיסוף',
  waiting_cs:  'ממתין לשירות',
  completed:   'הושלם',
}

export default function DashboardPage() {
  const [rows, setRows]       = useState<DashboardRow[]>([])
  const [lastUpdate, setLast] = useState<Date | null>(null)
  const [error, setError]     = useState('')

  const load = useCallback(async () => {
    try {
      setRows(await getDashboard())
      setLast(new Date())
      setError('')
    } catch {
      setError('שגיאה בטעינת הנתונים')
    }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, POLL_MS)
    return () => clearInterval(timer)
  }, [load])

  const active = rows.filter(r =>
    r.orders.some(
      o => o.actionable && (o.status === 'in_progress' || o.status === 'waiting_cs')
    )
  ).length

  return (
    <div className={s.page}>
      <div className={s.header}>
        <div>
          <h1 className={s.title}>דשבורד משמרת</h1>
          <p className={s.subtitle}>
            {active} ליקוטנים פעילים
            {lastUpdate && <span className={s.updated}> · עודכן {formatTime(lastUpdate.toISOString())}</span>}
          </p>
        </div>
        <button className={s.refreshBtn} onClick={load}>רענן</button>
      </div>

      {error && <div className={s.error}>{error}</div>}

      <div className={s.grid}>
        {rows.map(row => (
          <CollectorCard key={row.collectorId} row={row} />
        ))}
        {rows.length === 0 && !error && (
          <p className={s.empty}>אין ליקוטנים רשומים</p>
        )}
      </div>
    </div>
  )
}

function CollectorCard({ row }: { row: DashboardRow }) {
  const list = row.orders
  const primary = list.find(o => o.actionable)
  const hasActivePick = list.some(
    o => o.actionable && (o.status === 'in_progress' || o.status === 'waiting_cs')
  )

  return (
    <div className={`${s.card} ${hasActivePick ? s.active : ''}`}>
      <div className={s.cardHeader}>
        <span className={s.collectorName}>{row.collectorName}</span>
        {primary && (
          <span className={`${s.statusBadge} ${s[primary.status]}`}>
            {STATUS_LABEL[primary.status]}
          </span>
        )}
      </div>

      {list.length === 0 && (
        <p className={s.idle}>פנוי — אין הזמנה מוקצית</p>
      )}

      {list.length > 0 && (
        <div className={s.orderBlocks}>
          {list.map(o => (
            <OrderBlock key={o.id} o={o} />
          ))}
        </div>
      )}
    </div>
  )
}

function OrderBlock({ o }: { o: DashboardOrderEntry }) {
  const pct = o.total ? Math.round((o.collected / o.total) * 100) : 0
  const disabled = !o.actionable

  return (
    <div className={`${s.orderBlock} ${disabled ? s.orderBlockDisabled : ''}`}>
      <div className={s.orderBlockHeader}>
        <p className={s.orderId}>{o.id}</p>
        {!o.actionable && (
          <span className={s.queuePill}>בתור</span>
        )}
      </div>

      <div className={s.progressWrap}>
        <div className={s.progressBar}>
          <div className={s.progressFill} style={{ width: `${pct}%` }} />
        </div>
        <span className={s.progressLabel}>{o.collected} / {o.total}</span>
      </div>

      <div className={s.meta}>
        <div className={s.metaItem}>
          <span className={s.metaLabel}>התחלה</span>
          <span className={s.metaValue}>{formatTime(o.startedAt)}</span>
        </div>
        {o.startedAt && (
          <div className={s.metaItem}>
            <span className={s.metaLabel}>זמן</span>
            <span className={s.metaValue}>{elapsed(o.startedAt)}</span>
          </div>
        )}
        {o.missing > 0 && (
          <div className={s.metaItem}>
            <span className={s.metaLabel}>חסרים</span>
            <span className={`${s.metaValue} ${s.missing}`}>{o.missing}</span>
          </div>
        )}
      </div>

      {disabled && (
        <p className={s.queueHint}>ממתין — סיימו הזמנה קודמת</p>
      )}
    </div>
  )
}
