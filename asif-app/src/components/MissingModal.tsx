import { useState } from 'react'
import s from './MissingModal.module.css'

const REASONS = ['אזל מהמלאי', 'לא נמצא', 'פגום / לא ראוי למכירה']

interface Props {
  itemName: string
  onConfirm: (reason: string) => void
  onClose: () => void
}

export default function MissingModal({ itemName, onConfirm, onClose }: Props) {
  const [selected, setSelected] = useState('')

  return (
    <div className={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={s.sheet}>
        <div className={s.handle} />
        <h2 className={s.title}>סמן כחסר</h2>
        <p className={s.itemName}>{itemName}</p>

        <div className={s.reasons}>
          {REASONS.map(r => (
            <button
              key={r}
              className={`${s.reason} ${selected === r ? s.selected : ''}`}
              onClick={() => setSelected(r)}
            >
              {r}
            </button>
          ))}
        </div>

        <div className={s.actions}>
          <button className={s.cancel} onClick={onClose}>ביטול</button>
          <button
            className={s.confirm}
            disabled={!selected}
            onClick={() => onConfirm(selected)}
          >
            אשר חסר
          </button>
        </div>
      </div>
    </div>
  )
}
