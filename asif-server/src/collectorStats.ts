import type { Order } from './models/order'

export interface OrderTimingRow {
  orderId: string
  completedAt: string | null
  pickDurationSeconds: number | null
  /** Average gap between finishing one line and the next (same order). */
  avgGapBetweenItemsSeconds: number | null
  /** Time from order start to first line resolved. */
  timeToFirstItemSeconds: number | null
  itemsResolved: number
}

export interface CollectorStatsRange {
  fromMs: number
  toMs: number
  fromIso: string
  toIso: string
}

export interface CollectorStatsResult {
  from: string
  to: string
  orderCount: number
  ordersWithPickTiming: number
  avgPickDurationSeconds: number | null
  medianPickDurationSeconds: number | null
  avgGapBetweenItemsSeconds: number | null
  medianGapBetweenItemsSeconds: number | null
  avgTimeToFirstItemSeconds: number | null
  orders: OrderTimingRow[]
}

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null
  const s = [...sorted].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  if (s.length % 2) return s[m]
  return (s[m - 1] + s[m]) / 2
}

export function parseStatsRange(q: {
  days?: string
  from?: string
  to?: string
}): CollectorStatsRange {
  const now = Date.now()
  const fromQ = typeof q.from === 'string' ? Date.parse(q.from) : NaN
  const toQ = typeof q.to === 'string' ? Date.parse(q.to) : NaN
  if (Number.isFinite(fromQ) && Number.isFinite(toQ) && toQ > fromQ) {
    return {
      fromMs: fromQ,
      toMs: toQ,
      fromIso: new Date(fromQ).toISOString(),
      toIso: new Date(toQ).toISOString(),
    }
  }
  const d = parseInt(String(q.days ?? '7'), 10)
  const days = Number.isFinite(d) && d > 0 ? Math.min(366, d) : 7
  const fromMs = now - days * 86_400_000
  return {
    fromMs,
    toMs: now,
    fromIso: new Date(fromMs).toISOString(),
    toIso: new Date(now).toISOString(),
  }
}

export function computeCollectorStats(
  allOrders: Order[],
  collectorId: string,
  range: CollectorStatsRange
): CollectorStatsResult {
  const finished = allOrders.filter(o => {
    if (o.assignedTo !== collectorId) return false
    if (o.status !== 'completed' && o.status !== 'waiting_cs') return false
    if (!o.completedAt) return false
    const c = Date.parse(o.completedAt)
    return c >= range.fromMs && c <= range.toMs
  })

  const pickDurations: number[] = []
  const allInterItemGaps: number[] = []
  const firstItemTimes: number[] = []

  const rows: OrderTimingRow[] = finished.map(o => {
    const started = o.startedAt ? Date.parse(o.startedAt) : NaN
    const completed = o.completedAt ? Date.parse(o.completedAt) : NaN
    let pickDurationSeconds: number | null = null
    if (Number.isFinite(started) && Number.isFinite(completed) && completed >= started) {
      pickDurationSeconds = Math.round((completed - started) / 1000)
      pickDurations.push(pickDurationSeconds)
    }

    const picked = o.items
      .map(i => ({ t: i.pickedAt ? Date.parse(i.pickedAt) : NaN }))
      .filter(x => Number.isFinite(x.t))
      .sort((a, b) => a.t - b.t)

    let avgGap: number | null = null
    let timeToFirst: number | null = null

    if (picked.length >= 1 && Number.isFinite(started)) {
      const sec = Math.round((picked[0].t - started) / 1000)
      if (sec >= 0) {
        timeToFirst = sec
        firstItemTimes.push(sec)
      }
    }

    const gaps: number[] = []
    for (let i = 1; i < picked.length; i++) {
      const g = Math.round((picked[i].t - picked[i - 1].t) / 1000)
      if (g >= 0) gaps.push(g)
    }
    if (gaps.length) {
      avgGap = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length)
      allInterItemGaps.push(...gaps)
    }

    return {
      orderId: o.id,
      completedAt: o.completedAt,
      pickDurationSeconds,
      avgGapBetweenItemsSeconds: avgGap,
      timeToFirstItemSeconds: timeToFirst,
      itemsResolved: picked.length,
    }
  })

  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null

  rows.sort((a, b) => {
    const tb = b.completedAt ? Date.parse(b.completedAt) : 0
    const ta = a.completedAt ? Date.parse(a.completedAt) : 0
    return tb - ta
  })

  return {
    from: range.fromIso,
    to: range.toIso,
    orderCount: finished.length,
    ordersWithPickTiming: pickDurations.length,
    avgPickDurationSeconds:
      pickDurations.length > 0 ? Math.round(avg(pickDurations)!) : null,
    medianPickDurationSeconds: median(pickDurations),
    avgGapBetweenItemsSeconds:
      allInterItemGaps.length > 0 ? Math.round(avg(allInterItemGaps)!) : null,
    medianGapBetweenItemsSeconds: median(allInterItemGaps),
    avgTimeToFirstItemSeconds:
      firstItemTimes.length > 0 ? Math.round(avg(firstItemTimes)!) : null,
    orders: rows,
  }
}
