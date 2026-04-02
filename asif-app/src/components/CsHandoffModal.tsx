import { useState, useEffect } from 'react'
import s from './CsHandoffModal.module.css'

const MIN_LEN = 3
const MAX_LEN = 2000

interface Props {
  initialReason?: string | null
  /** When true, show option to clear note (server allows empty only if no missing lines). */
  canClearNote: boolean
  busy?: boolean
  onConfirm: (reason: string) => void
  onClearNote?: () => void
  onClose: () => void
}

export default function CsHandoffModal({
  initialReason,
  canClearNote,
  busy = false,
  onConfirm,
  onClearNote,
  onClose,
}: Props) {
  const [text, setText] = useState(() => (initialReason ?? '').trim())

  useEffect(() => {
    setText((initialReason ?? '').trim())
  }, [initialReason])

  const trimmed = text.trim()
  const valid = trimmed.length >= MIN_LEN && trimmed.length <= MAX_LEN

  return (
    <div
      className={s.overlay}
      onClick={(e) => !busy && e.target === e.currentTarget && onClose()}
    >
      <div className={s.sheet}>
        <div className={s.handle} />
        <h2 className={s.title}>העברה לשירות לקוחות</h2>
        <p className={s.hint}>
          תארו בקצרה למה נדרשת התערבות שירות לקוחות. ההזמנה תסומן כממתינה לשירות (גם בלי פריט
          חסר).
        </p>
        <textarea
          className={s.textarea}
          dir="rtl"
          value={text}
          disabled={busy}
          onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
          placeholder="לדוגמה: לקוח ביקש להחליף מוצר / בעיה בתשלום / הוראות מיוחדות שלא ניתן לבצע"
          aria-label="סיבת העברה לשירות לקוחות"
        />
        <span className={s.charHint}>
          {trimmed.length}/{MAX_LEN} — מינימום {MIN_LEN} תווים
        </span>
        <div className={s.actions}>
          <div className={s.row}>
            <button type="button" className={s.cancel} disabled={busy} onClick={onClose}>
              ביטול
            </button>
            <button
              type="button"
              className={s.confirm}
              disabled={!valid || busy}
              onClick={() => onConfirm(trimmed)}
            >
              {busy ? 'שולח…' : 'שמור וסמן לשירות'}
            </button>
          </div>
          {canClearNote && onClearNote ? (
            <button
              type="button"
              className={s.clearLink}
              disabled={busy}
              onClick={() => onClearNote()}
            >
              מחק הערת מלקט (רק אם אין פריטים חסרים)
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
