import { useState, useMemo } from 'react'
import { isAxiosError } from 'axios'
import { CapacitorException, ExceptionCode } from '@capacitor/core'
import type { Order, OrderItem } from '../api'
import { updateItem, completeOrder, setCustomerServiceHandoff } from '../api'
import { scanBarcode } from '../scanner'
import MissingModal from '../components/MissingModal'
import CsHandoffModal from '../components/CsHandoffModal'
import MismatchModal from '../components/MismatchModal'
import WeightModal from '../components/WeightModal'
import s from './PickListPage.module.css'

function formatKg(n: number): string {
  const r = Math.round(n * 1000) / 1000
  const s = r.toFixed(3).replace(/\.?0+$/, '')
  return s || '0'
}

/** תצוגת כמות מבוקשת: יחידות / משקל / שילוב לפי שדות מ־WC. */
function orderedQtyLabel(item: OrderItem): string {
  if (item.unit === 'piece') {
    return `${item.quantity} יח׳`
  }
  const pieces = item.orderedPiecesCount
  const kg = item.orderedTotalWeightKg
  const parts: string[] = []
  if (pieces != null && pieces > 0) parts.push(`${pieces} יח׳`)
  if (kg != null && kg > 0) parts.push(`סה״כ ~${formatKg(kg)} ק״ג`)
  if (parts.length > 0) return parts.join(' · ')
  const unitLabel = item.unit === 'g' ? 'גרם' : 'ק"ג'
  return `~${item.quantity} ${unitLabel}`
}

function scanFailureToHebrew(e: unknown): string {
  if (e instanceof CapacitorException && e.code === ExceptionCode.Unimplemented) {
    return 'הסריקה לא מקושרת לאפליקציה (בנייה ללא CocoaPods). פתח את App.xcworkspace והרץ pod install.'
  }
  if (
    e &&
    typeof e === 'object' &&
    'code' in e &&
    (e as { code?: string }).code === 'CAMERA_PERMISSION_DENIED'
  ) {
    return 'נדרש אישור גישה למצלמה בהגדרות המכשיר.'
  }
  if (e instanceof Error && e.message) {
    return `שגיאת סריקה: ${e.message}`
  }
  return 'שגיאת סריקה — נסה שוב.'
}

interface Props {
  order: Order
  onOrderComplete: () => void
  /** מעדכן את אובייקט ההזמנה אחרי העברה לשירות / ניקוי הערה. */
  onOrderUpdated?: (order: Order) => void
  onBack: () => void
}

type GroupedItems = { label: string; items: OrderItem[] }[]

/** מיון ליקוט: מעבר (מספרי) → אזור לפי תווית כשאין מעבר → בתוך הקבוצה: ממתין לפני נאסף/חסר → שם. */
function statusRank(s: OrderItem['status']): number {
  if (s === 'pending') return 0
  if (s === 'collected') return 1
  return 2
}

function pickSortKey(item: OrderItem): [number, string, string] {
  const aisle = item.location.aisle
  const label = (item.location.label || '').trim()
  const labelKey = label === '—' ? '' : label
  const aisleBucket = aisle > 0 ? aisle : 100_000
  const secondary = aisle > 0 ? '' : labelKey || '\u0000'
  return [aisleBucket, secondary, item.name]
}

function sortItemsForPicking(items: OrderItem[]): OrderItem[] {
  return [...items].sort((a, b) => {
    const [a1, a2, a3] = pickSortKey(a)
    const [b1, b2, b3] = pickSortKey(b)
    if (a1 !== b1) return a1 - b1
    if (a2 !== b2) return a2.localeCompare(b2, 'he')
    const sr = statusRank(a.status) - statusRank(b.status)
    if (sr !== 0) return sr
    return a3.localeCompare(b3, 'he')
  })
}

/** כותרת קבוצה לתצוגה — עקבית עם סדר המיון. */
function groupHeading(item: OrderItem): string {
  const { aisle, label } = item.location
  const t = label.trim()
  if (aisle > 0) return `מעבר ${aisle}`
  if (t && t !== '—') return t
  return 'ללא מיקום מפורט'
}

function groupSortedItems(sorted: OrderItem[]): GroupedItems {
  const out: GroupedItems = []
  for (const item of sorted) {
    const h = groupHeading(item)
    const last = out[out.length - 1]
    if (!last || last.label !== h) out.push({ label: h, items: [item] })
    else last.items.push(item)
  }
  return out
}

export default function PickListPage({ order, onOrderComplete, onOrderUpdated, onBack }: Props) {
  const [items, setItems]             = useState<OrderItem[]>(order.items)
  const [missingItem, setMissingItem] = useState<OrderItem | null>(null)
  const [mismatch, setMismatch]       = useState<{
    item: OrderItem
    scanned: string
    expected: string
  } | null>(null)
  const [scanning, setScanning]       = useState<string | null>(null)
  const [scanError, setScanError]     = useState('')
  const [weightItem, setWeightItem]   = useState<OrderItem | null>(null)
  const [weightModalError, setWeightModalError] = useState('')
  const [completing, setCompleting]   = useState(false)
  const [completeError, setCompleteError] = useState('')
  const [csModalOpen, setCsModalOpen] = useState(false)
  const [handoffError, setHandoffError] = useState('')
  const [handoffSubmitting, setHandoffSubmitting] = useState(false)

  const collected = items.filter(i => i.status !== 'pending').length
  const total     = items.length
  const allDone   = collected === total
  const hasMissingLine = items.some(i => i.status === 'missing')
  const handoffNote = (order.csHandoffReason ?? '').trim()

  const groups = useMemo(() => groupSortedItems(sortItemsForPicking(items)), [items])

  function expectedCode(item: OrderItem): string {
    return (item.barcode || item.sku || '').trim()
  }

  async function handleScan(item: OrderItem) {
    setScanning(item.id)
    setScanError('')
    try {
      const scanned = await scanBarcode()
      if (!scanned) return // user closed scanner without a read
      const expected = expectedCode(item)
      if (!expected || scanned === expected) {
        await markCollected(item, 'scan')
      } else {
        setMismatch({ item, scanned, expected })
      }
    } catch (e) {
      console.error('[ASIF scan]', e)
      setScanError(scanFailureToHebrew(e))
    } finally {
      setScanning(null)
    }
  }

  async function handleForceConfirm(item: OrderItem) {
    setMismatch(null)
    await markCollected(item, 'scan')
  }

  async function markCollected(
    item: OrderItem,
    method: 'scan' | 'manual' | 'scale',
    weight?: number,
    acknowledgeWeightDeviation?: boolean
  ) {
    const updated = await updateItem(order.id, item.id, {
      status: 'collected',
      collectedQuantity: item.quantity,
      collectedWeight: weight ?? null,
      collectionMethod: method,
      ...(acknowledgeWeightDeviation ? { acknowledgeWeightDeviation: true } : {}),
    })
    setItems(prev => prev.map(i => (i.id === updated.id ? updated : i)))
  }

  async function handleWeightConfirm(
    item: OrderItem,
    weight: number,
    acknowledgeDeviationOver20: boolean
  ) {
    setWeightModalError('')
    try {
      await markCollected(item, 'scale', weight, acknowledgeDeviationOver20)
      setWeightItem(null)
    } catch (e: unknown) {
      if (
        isAxiosError(e) &&
        e.response?.status === 409 &&
        (e.response.data as { code?: string })?.code === 'WEIGHT_DEVIATION_OVER_20'
      ) {
        setWeightModalError(
          'יש לאשר משקל שחורג מ־±20% — ודאו את הערך ולחצו ״אשר משקל (חריגה)״.'
        )
        return
      }
      throw e
    }
  }

  async function markMissing(item: OrderItem, reason: string) {
    const updated = await updateItem(order.id, item.id, {
      status: 'missing',
      missingReason: reason,
    })
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
    setMissingItem(null)
  }

  async function undoItem(item: OrderItem) {
    try {
      const updated = await updateItem(order.id, item.id, {
        status: 'pending',
        collectedQuantity: null,
        collectedWeight: null,
        collectionMethod: null,
        missingReason: '',
      })
      setItems(prev => prev.map(i => (i.id === updated.id ? updated : i)))
    } catch {
      setItems(prev => prev.map(i => i.id === item.id
        ? { ...i, status: 'pending', collectedQuantity: null, collectedWeight: null, collectionMethod: null }
        : i
      ))
    }
  }

  async function handleComplete() {
    setCompleting(true)
    setCompleteError('')
    try {
      await completeOrder(order.id)
      onOrderComplete()
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } }
      setCompleteError(ax.response?.data?.error ?? 'לא ניתן לסיים את ההזמנה')
    } finally {
      setCompleting(false)
    }
  }

  async function submitHandoff(reason: string) {
    setHandoffSubmitting(true)
    setHandoffError('')
    try {
      const updated = await setCustomerServiceHandoff(order.id, reason)
      onOrderUpdated?.(updated)
      setCsModalOpen(false)
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } }
      setHandoffError(ax.response?.data?.error ?? 'לא ניתן לשמור')
    } finally {
      setHandoffSubmitting(false)
    }
  }

  return (
    <div className={s.page}>
      <header className={s.header}>
        <button className={s.backBtn} onClick={onBack}>→</button>
        <div className={s.headerCenter}>
          <span className={s.orderId}>{order.id}</span>
          <span className={s.customerName}>{order.customerName}</span>
        </div>
        <span className={s.counter}>{collected}/{total}</span>
      </header>

      <div className={s.progressBar}>
        <div className={s.progressFill} style={{ width: `${(collected / total) * 100}%` }} />
      </div>

      <p className={s.sortHint}>
        הרשימה מסודרת לפי מעבר ומיקום (ואז פריטים פתוחים ראשונים) לנוחות הליכה בחנות.
      </p>

      {(order.customerNote ?? '').trim() ? (
        <div className={s.orderNoteBanner} role="status">
          <span className={s.orderNoteLabel}>הערת לקוח</span>
          <span className={s.orderNoteText}>{order.customerNote}</span>
        </div>
      ) : null}

      {scanError ? <p className={s.scanError}>{scanError}</p> : null}
      {completeError ? <p className={s.scanError}>{completeError}</p> : null}
      {handoffError ? <p className={s.scanError}>{handoffError}</p> : null}
      {hasMissingLine && handoffNote ? (
        <p className={s.csBanner}>
          מסומן לשירות לקוחות: יש פריטים חסרים והערת מלקט — סיימו את שאר השורות ואז לחצו ״סיים
          וסגור הזמנה״.
        </p>
      ) : hasMissingLine ? (
        <p className={s.csBanner}>מסומן לשירות לקוחות (חסרים) — סיימו את שאר השורות ואז לחצו ״סיים וסגור הזמנה״.</p>
      ) : handoffNote ? (
        <p className={s.csBanner}>
          מסומן לשירות לקוחות לפי הערת המלקט — ניתן להמשיך ליקוט; בסיום לחצו ״סיים וסגור הזמנה״.
        </p>
      ) : null}

      <div className={s.csHandoffRow}>
        <button
          type="button"
          className={s.csHandoffBtn}
          disabled={handoffSubmitting}
          onClick={() => {
            setHandoffError('')
            setCsModalOpen(true)
          }}
        >
          {handoffNote ? 'עריכת הערה לשירות לקוחות' : 'העברה לשירות לקוחות (עם הערה)'}
        </button>
      </div>

      <div className={s.list}>
        {groups.map((group, gi) => (
          <div key={`${group.label}-${gi}`}>
            <div className={s.aisleHeader}>{group.label}</div>
            {group.items.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                scanning={scanning === item.id}
                onScan={() => handleScan(item)}
                onWeight={() => {
                  setWeightModalError('')
                  setWeightItem(item)
                }}
                onCollect={() => markCollected(item, 'manual')}
                onMissing={() => setMissingItem(item)}
                onUndo={() => void undoItem(item)}
              />
            ))}
          </div>
        ))}

        {allDone && (
          <div className={s.completeWrap}>
            <button className={s.completeBtn} onClick={handleComplete} disabled={completing}>
              {completing ? 'שולח...' : 'סיים וסגור הזמנה'}
            </button>
          </div>
        )}
      </div>

      {missingItem && (
        <MissingModal
          itemName={missingItem.name}
          onConfirm={reason => markMissing(missingItem, reason)}
          onClose={() => setMissingItem(null)}
        />
      )}

      {csModalOpen && (
        <CsHandoffModal
          initialReason={order.csHandoffReason}
          canClearNote={!hasMissingLine && Boolean(handoffNote)}
          busy={handoffSubmitting}
          onConfirm={(reason) => void submitHandoff(reason)}
          onClearNote={() => void submitHandoff('')}
          onClose={() => {
            if (!handoffSubmitting) setCsModalOpen(false)
          }}
        />
      )}

      {weightItem && (
        <WeightModal
          itemName={weightItem.name}
          targetQty={weightItem.quantity}
          unit={weightItem.unit as 'kg' | 'g'}
          submitError={weightModalError}
          onConfirm={(w, ack) => void handleWeightConfirm(weightItem, w, ack)}
          onClose={() => {
            setWeightModalError('')
            setWeightItem(null)
          }}
        />
      )}

      {mismatch && (
        <MismatchModal
          itemName={mismatch.item.name}
          scanned={mismatch.scanned}
          expected={mismatch.expected}
          onForceConfirm={() => handleForceConfirm(mismatch.item)}
          onRetry={() => { setMismatch(null); void handleScan(mismatch.item) }}
          onClose={() => setMismatch(null)}
        />
      )}
    </div>
  )
}

// ── Item Card ────────────────────────────────────────────────────────────────

interface CardProps {
  item: OrderItem
  scanning: boolean
  onScan: () => void
  onWeight: () => void
  onCollect: () => void
  onMissing: () => void
  onUndo: () => void
}

function ItemCard({ item, scanning, onScan, onWeight, onCollect, onMissing, onUndo }: CardProps) {
  const isWeighed   = item.unit !== 'piece'
  const isDone      = item.status !== 'pending'
  const isMissing   = item.status === 'missing'
  const isCollected = item.status === 'collected'
  const locLabel = item.location.label.trim()
  const hasLocationText = locLabel !== '' && locLabel !== '—'
  const scanCode = (item.barcode || item.sku || '').trim()
  const barcodeOnly = (item.barcode || '').trim()
  const skuOnly = (item.sku || '').trim()

  return (
    <div className={`${s.card} ${isDone ? (isMissing ? s.cardMissing : s.cardCollected) : ''}`}>
      <div className={s.cardTop}>
        <div className={s.cardBody}>
          {item.imageUrl ? (
            <img
              className={s.thumb}
              src={item.imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className={s.thumbPlaceholder} aria-hidden />
          )}
          <div className={s.itemInfo}>
            <span className={s.itemName}>{item.name}</span>
            {item.brand && <span className={s.itemBrand}>{item.brand}</span>}
            <div className={s.metaBlock}>
              <div className={s.metaRow}>
                <span className={s.metaLabel}>מיקום בחנות</span>
                <span className={`${s.metaValue} ${hasLocationText || item.location.aisle > 0 ? s.metaValueOk : s.metaValueMuted}`} dir="auto">
                  {hasLocationText
                    ? locLabel
                    : item.location.aisle > 0
                      ? `מעבר ${item.location.aisle}`
                      : 'לא זמין'}
                </span>
              </div>
              <div className={s.metaRow}>
                <span className={s.metaLabel}>ברקוד לסריקה</span>
                <span className={`${s.metaValue} ${scanCode ? s.metaValueMono : s.metaValueMuted}`} dir="ltr">
                  {scanCode
                    ? barcodeOnly && skuOnly && barcodeOnly !== skuOnly
                      ? `${barcodeOnly} (מק״ט: ${skuOnly})`
                      : scanCode
                    : 'אין — אסוף ידנית או הוסיפו ברקוד/מק״ט בחנות'}
                </span>
              </div>
            </div>
            <div className={s.badges}>
              <span className={s.qty}>{orderedQtyLabel(item)}</span>
              {isWeighed && <span className={s.weighBadge}>שקול</span>}
            </div>
            {item.customerNote ? (
              <div className={s.note}>
                <span className={s.noteIcon}>💬</span> {item.customerNote}
              </div>
            ) : null}
          </div>
        </div>

        {isDone && (
          <button className={s.undoBtn} onClick={onUndo}>↩</button>
        )}
      </div>

      {!isDone && (
        <div className={s.cardActions}>
          <button type="button" className={s.missingBtn} onClick={onMissing}>
            חסר
          </button>
          <button type="button" className={s.scanBtn} onClick={onScan} disabled={scanning}>
            {scanning ? '...' : '📷 סרוק'}
          </button>
          <button
            type="button"
            className={s.weightBtn}
            onClick={onWeight}
            disabled={!isWeighed}
            title={isWeighed ? 'הזנת משקל (ק״ג / גרם)' : 'פריט לפי יחידה — אין הזנת משקל'}
          >
            משקל
          </button>
          <button
            type="button"
            className={s.collectBtn}
            onClick={onCollect}
            disabled={isWeighed}
            title={isWeighed ? 'לפריט שקיל — השתמשו ב״משקל״ או ב״סרוק״' : 'איסוף לפי כמות (יחידות)'}
          >
            אסוף
          </button>
        </div>
      )}

      {isCollected && (
        <div className={s.doneRow}>
          <span className={s.doneCheck}>✓</span>
          <span className={s.doneText}>נאסף</span>
        </div>
      )}

      {isMissing && (
        <div className={s.missingRow}>
          <span className={s.missingX}>✗</span>
          <span className={s.missingText}>חסר — {item.missingReason}</span>
        </div>
      )}
    </div>
  )
}
