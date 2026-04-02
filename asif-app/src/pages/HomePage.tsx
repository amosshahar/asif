import { useState, useEffect } from 'react'
import type { AuthUser, Order } from '../api'
import { getMyOrder, startOrder } from '../api'
import { clearUser } from '../auth'
import logo from '../assets/logo.png'
import s from './HomePage.module.css'

interface Props {
  user: AuthUser
  onLogout: () => void
  onStartOrder: (order: Order) => void
}

export default function HomePage({ user, onLogout, onStartOrder }: Props) {
  const [order, setOrder]     = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    getMyOrder(user.id)
      .then(setOrder)
      .catch(() => setOrder(null))
      .finally(() => setLoading(false))
  }, [user.id])

  async function handleStart() {
    if (!order) return
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

  async function handleLogout() {
    await clearUser()
    onLogout()
  }

  const collected = order?.items.filter(i => i.status !== 'pending').length ?? 0
  const total     = order?.items.length ?? 0

  return (
    <div className={s.page}>
      <header className={s.header}>
        <img src={logo} alt="אסיף" className={s.logo} />
        <button className={s.logoutBtn} onClick={handleLogout}>יציאה</button>
      </header>

      <div className={s.body}>
        <p className={s.greeting}>שלום, {user.name}</p>

        {loading && <p className={s.sub}>טוען...</p>}

        {!loading && !order && (
          <p className={s.sub}>אין הזמנות פתוחות כרגע</p>
        )}

        {!loading && order && (
          <div className={s.orderCard}>
            <div className={s.orderMeta}>
              <span className={s.orderId}>{order.id}</span>
              <span className={s.customerName}>לקוח: {order.customerName}</span>
            </div>

            <div className={s.progressRow}>
              <span className={s.progressText}>{collected} / {total} פריטים</span>
              <div className={s.progressBar}>
                <div
                  className={s.progressFill}
                  style={{ width: total ? `${(collected / total) * 100}%` : '0%' }}
                />
              </div>
            </div>

            <button className={s.startBtn} onClick={handleStart} disabled={starting}>
              {starting ? 'פותח...' : order.status === 'in_progress' ? 'המשך איסוף' : 'התחל איסוף'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
