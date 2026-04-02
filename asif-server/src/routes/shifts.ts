import { Router, Request, Response } from 'express'
import { findUser } from '../users'
import { buildShiftEndSummary } from '../shiftSummary'
import {
  endCollectorShift,
  getLatestClosedShiftForCollector,
  getOpenShiftForCollector,
  startCollectorShift,
} from '../shiftService'

const router = Router()

function parseCollectorId(req: Request): string {
  const bodyId = req.body?.collectorId
  const q = req.query['collectorId']
  const fromQuery = Array.isArray(q) ? q[0] : q
  const raw = typeof bodyId === 'string' ? bodyId : typeof fromQuery === 'string' ? fromQuery : ''
  return raw.trim()
}

async function requireCollector(collectorId: string, res: Response): Promise<boolean> {
  if (!collectorId) {
    res.status(400).json({ error: 'collectorId required' })
    return false
  }
  const user = await findUser(collectorId)
  if (!user || user.role !== 'collector') {
    res.status(403).json({ error: 'Shifts are only for collector accounts' })
    return false
  }
  return true
}

// POST /shifts/start { collectorId } — open or resume current shift
router.post('/start', async (req: Request, res: Response) => {
  const collectorId = parseCollectorId(req)
  if (!(await requireCollector(collectorId, res))) return
  const shift = await startCollectorShift(collectorId)
  res.json(shift)
})

// POST /shifts/end { collectorId } — close open shift
router.post('/end', async (req: Request, res: Response) => {
  const collectorId = parseCollectorId(req)
  if (!(await requireCollector(collectorId, res))) return
  const closed = await endCollectorShift(collectorId)
  let summary = null
  if (closed?.startedAt && closed.endedAt) {
    summary = await buildShiftEndSummary(collectorId, closed.startedAt, closed.endedAt)
  }
  res.json({ ok: true, shift: closed, summary })
})

// GET /shifts/current?collectorId=
router.get('/current', async (req: Request, res: Response) => {
  const collectorId = parseCollectorId(req)
  if (!(await requireCollector(collectorId, res))) return
  const shift = await getOpenShiftForCollector(collectorId)
  res.json(shift)
})

// GET /shifts/stats?collectorId= — משמרת פעילה: סטטיסטיקה בזמן אמת (לא סופית); אחרת: משמרת אחרונה סגורה
router.get('/stats', async (req: Request, res: Response) => {
  const collectorId = parseCollectorId(req)
  if (!(await requireCollector(collectorId, res))) return

  const open = await getOpenShiftForCollector(collectorId)
  if (open?.open && open.startedAt) {
    const summary = await buildShiftEndSummary(
      collectorId,
      open.startedAt,
      new Date().toISOString()
    )
    res.json({
      shiftOpen: true,
      finalized: false,
      shiftStartedAt: open.startedAt,
      shiftEndedAt: null,
      summary,
    })
    return
  }

  const closed = await getLatestClosedShiftForCollector(collectorId)
  if (closed?.endedAt && closed.startedAt) {
    const summary = await buildShiftEndSummary(collectorId, closed.startedAt, closed.endedAt)
    res.json({
      shiftOpen: false,
      finalized: true,
      shiftStartedAt: closed.startedAt,
      shiftEndedAt: closed.endedAt,
      summary,
    })
    return
  }

  res.json({
    shiftOpen: false,
    finalized: false,
    shiftStartedAt: null,
    shiftEndedAt: null,
    summary: null,
  })
})

export default router
