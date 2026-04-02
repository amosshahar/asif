import { useState } from 'react'
import type { Order, OrderItem } from '../api'
import { updateItem, completeOrder } from '../api'
import MissingModal from '../components/MissingModal'
import s from './PickListPage.module.css'

interface Props {
  order: Order
  onOrderComplete: () => void
  onBack: () => void
}

type GroupedItems = { label: string; items: OrderItem[] }[]

function groupByAisle(items: OrderItem[]): GroupedItems {
  const map = new Map<number, { label: string; items: OrderItem[] }>()
  for (const item of items) {
    const { aisle, label } = item.location
    if (!map.has(aisle)) map.set(aisle, { label, items: [] })
    map.get(aisle)!.items.push(item)
  }
  return Array.from(map.values())
}

export default function PickListPage({ order, onOrderComplete, onBack }: Props) {
  const [items, setItems]           = useState<OrderItem[]>(order.items)
  const [missingItem, setMissingItem] = useState<OrderItem | null>(null)
  const [completing, setCompleting] = useState(false)

  const collected = items.filter(i => i.status !== 'pending').length
  const total     = items.length
  const allDone   = collected === total

  const groups = groupByAisle(items)

  async function markCollected(item: OrderItem, method: 'scan' | 'manual') {
    const updated = await updateItem(order.id, item.id, {
      status: 'collected',
      collectedQuantity: item.quantity,
      collectionMethod: method,
    })
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
  }

  async function markMissing(item: OrderItem, reason: string) {
    const updated = await updateItem(order.id, item.id, {
      status: 'missing',
      missingReason: reason,
    })
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
    setMissingItem(null)
  }

  function undoItem(item: OrderItem) {
    updateItem(order.id, item.id, {
      status: 'pending',
      collectedQuantity: null,
      collectedWeight: null,
      collectionMethod: null,
      missingReason: undefined,
    })
    setItems(prev => prev.map(i => i.id === item.id
      ? { ...i, status: 'pending', collectedQuantity: null, collectedWeight: null, collectionMethod: null }
      : i
    ))
  }

  async function handleComplete() {
    setCompleting(true)
    try {
      await completeOrder(order.id)
      onOrderComplete()
    } finally {
      setCompleting(false)
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

      <div className={s.list}>
        {groups.map(group => (
          <div key={group.label}>
            <div className={s.aisleHeader}>{group.label}</div>
            {group.items.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                onCollect={() => markCollected(item, 'manual')}
                onMissing={() => setMissingItem(item)}
                onUndo={() => undoItem(item)}
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
    </div>
  )
}

// ── Item Card ────────────────────────────────────────────────────────────────

interface CardProps {
  item: OrderItem
  onCollect: () => void
  onMissing: () => void
  onUndo: () => void
}

function ItemCard({ item, onCollect, onMissing, onUndo }: CardProps) {
  const isWeighed   = item.unit !== 'piece'
  const isDone      = item.status !== 'pending'
  const isMissing   = item.status === 'missing'
  const isCollected = item.status === 'collected'

  return (
    <div className={`${s.card} ${isDone ? (isMissing ? s.cardMissing : s.cardCollected) : ''}`}>
      <div className={s.cardTop}>
        <div className={s.itemInfo}>
          <span className={s.itemName}>{item.name}</span>
          {item.brand && <span className={s.itemBrand}>{item.brand}</span>}
          <div className={s.badges}>
            <span className={s.qty}>
              {isWeighed ? `~${item.quantity} ק"ג` : `${item.quantity} יח׳`}
            </span>
            {isWeighed && <span className={s.weighBadge}>שקול</span>}
          </div>
          {item.customerNote ? (
            <div className={s.note}>
              <span className={s.noteIcon}>💬</span> {item.customerNote}
            </div>
          ) : null}
        </div>

        {isDone && (
          <button className={s.undoBtn} onClick={onUndo}>↩</button>
        )}
      </div>

      {!isDone && (
        <div className={s.cardActions}>
          <button className={s.missingBtn} onClick={onMissing}>חסר</button>
          <button className={s.collectBtn} onClick={onCollect}>
            {isWeighed ? 'שקל ואשר' : 'אסוף'}
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
