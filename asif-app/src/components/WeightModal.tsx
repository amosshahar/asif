import { useState } from 'react'
import s from './WeightModal.module.css'

interface Props {
  itemName: string
  targetQty: number
  unit: 'kg' | 'g'
  onConfirm: (weight: number) => void
  onClose: () => void
}

export default function WeightModal({ itemName, targetQty, unit, onConfirm, onClose }: Props) {
  const [value, setValue] = useState('')

  const weight = parseFloat(value)
  const valid  = !isNaN(weight) && weight > 0

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

        <div className={s.actions}>
          <button className={s.cancel} onClick={onClose}>ביטול</button>
          <button className={s.confirm} disabled={!valid} onClick={() => onConfirm(weight)}>
            אשר משקל
          </button>
        </div>
      </div>
    </div>
  )
}
