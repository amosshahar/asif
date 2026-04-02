import { useState } from 'react'
import s from './WeightModal.module.css'

interface Props {
  itemName: string
  targetQty: number
  unit: 'kg' | 'g'
  /** Second arg true when weight is beyond ±20% — sent to API as acknowledgeWeightDeviation. */
  onConfirm: (weight: number, acknowledgeDeviationOver20: boolean) => void
  onClose: () => void
  /** Shown after a failed submit (e.g. server rejected missing ack). */
  submitError?: string
}

const DEVIATION_WARN = 0.2 // spec §5.6 — warn beyond ±20% vs ordered weight

export default function WeightModal({
  itemName,
  targetQty,
  unit,
  onConfirm,
  onClose,
  submitError,
}: Props) {
  const [value, setValue] = useState('')

  const weight = parseFloat(value)
  const valid  = !isNaN(weight) && weight > 0
  const deviation =
    valid && targetQty > 0 ? Math.abs(weight - targetQty) / targetQty : 0
  const showDeviationWarn = valid && targetQty > 0 && deviation > DEVIATION_WARN

  return (
    <div className={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={s.sheet}>
        <div className={s.handle} />
        <h2 className={s.title}>שקילה</h2>
        <p className={s.itemName}>{itemName}</p>
        <p className={s.target}>כמות מבוקשת: ~{targetQty} {unit === 'kg' ? 'ק"ג' : 'גרם'}</p>

        <div className={s.inputWrap}>
          <input
            className={s.input}
            type="number"
            inputMode="decimal"
            placeholder="0.000"
            value={value}
            onChange={e => setValue(e.target.value)}
            autoFocus
          />
          <span className={s.unit}>{unit === 'kg' ? 'ק"ג' : 'גרם'}</span>
        </div>

        {showDeviationWarn ? (
          <p className={s.deviationWarn} role="alert">
            המשקל חורג מ־±20% מהכמות שהוזמנה — ודאו במידה ולחצו ״אשר משקל״ לאישור מפורש.
          </p>
        ) : null}

        {submitError ? (
          <p className={s.submitError} role="alert">
            {submitError}
          </p>
        ) : null}

        <div className={s.actions}>
          <button className={s.cancel} onClick={onClose}>ביטול</button>
          <button
            className={s.confirm}
            disabled={!valid}
            onClick={() => onConfirm(weight, showDeviationWarn)}
          >
            {showDeviationWarn ? 'אשר משקל (חריגה)' : 'אשר משקל'}
          </button>
        </div>
      </div>
    </div>
  )
}
