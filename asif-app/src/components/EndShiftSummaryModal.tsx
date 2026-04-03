import type { ShiftEndSummary } from '../api'
import s from './EndShiftSummaryModal.module.css'

function formatDurationMinutes(m: number): string {
  if (!Number.isFinite(m) || m <= 0) return 'פחות מדקה'
  if (m < 60) return `${Math.round(m)} דק׳`
  const h = Math.floor(m / 60)
  const min = Math.round(m % 60)
  if (min === 0) return `${h} שע׳`
  return `${h} שע׳ ו־${min} דק׳`
}

interface Props {
  summary: ShiftEndSummary
  /** What to do after the user taps the primary button. */
  afterClose: 'logout' | 'done'
  onConfirm: () => void
}

export default function EndShiftSummaryModal({ summary, afterClose, onConfirm }: Props) {
  const avg =
    summary.averageOrderMinutes != null
      ? `${summary.averageOrderMinutes} דק׳`
      : 'אין נתונים (הזמנות בלי זמן התחלה)'

  return (
    <div className={s.overlay} role="dialog" aria-modal="true" aria-labelledby="end-shift-title">
      <div className={s.sheet}>
        <h2 id="end-shift-title" className={s.title}>
          סיכום משמרת
        </h2>
        <p className={s.lead}>
          {afterClose === 'done'
            ? 'לאחר האישור תחזרו ללשונית «הזמנות» — שם אפשר להתחיל משמרת חדשה. הסיכום הסופי זמין גם ב«סטטיסטיקת משמרת».'
            : 'הנתונים למשמרת שסיימת (לפי שעון המערכת):'}
        </p>
        <ul className={s.list}>
          <li>
            <span className={s.label}>הזמנות שסגרת במשמרת</span>
            <span className={s.value}>{summary.ordersFinished}</span>
          </li>
          <li>
            <span className={s.label}>זמן עבודה כולל במשמרת</span>
            <span className={s.value}>{formatDurationMinutes(summary.totalShiftMinutes)}</span>
          </li>
          <li>
            <span className={s.label}>ממוצע זמן ליקוט להזמנה</span>
            <span className={s.value}>{avg}</span>
          </li>
        </ul>
        <button type="button" className={s.primaryBtn} onClick={onConfirm}>
          {afterClose === 'logout' ? 'יציאה מהמערכת' : 'חזרה למסך הראשי'}
        </button>
      </div>
    </div>
  )
}
