import s from './MismatchModal.module.css'

interface Props {
  scanned: string
  expected: string
  itemName: string
  onForceConfirm: () => void
  onRetry: () => void
  onClose: () => void
}

export default function MismatchModal({ scanned, expected, itemName, onForceConfirm, onRetry, onClose }: Props) {
  return (
    <div className={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={s.sheet}>
        <div className={s.handle} />
        <div className={s.icon}>⚠️</div>
        <h2 className={s.title}>ברקוד לא תואם</h2>
        <p className={s.itemName}>{itemName}</p>
        <div className={s.codes}>
          <div className={s.codeRow}>
            <span className={s.codeLabel}>נסרק</span>
            <span className={s.codeValue}>{scanned}</span>
          </div>
          <div className={s.codeRow}>
            <span className={s.codeLabel}>צפוי</span>
            <span className={s.codeValue}>{expected}</span>
          </div>
        </div>
        <p className={s.hint}>האם המוצר נכון אך הברקוד שונה?</p>
        <div className={s.actions}>
          <button className={s.retry} onClick={onRetry}>סרוק שוב</button>
          <button className={s.confirm} onClick={onForceConfirm}>אשר בכל זאת</button>
        </div>
        <button className={s.cancel} onClick={onClose}>ביטול</button>
      </div>
    </div>
  )
}
