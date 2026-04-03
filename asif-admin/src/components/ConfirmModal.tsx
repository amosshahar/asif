import s from './ConfirmModal.module.css'

type Props = {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  confirmVariant?: 'primary' | 'danger'
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'אישור',
  cancelLabel = 'ביטול',
  confirmVariant = 'primary',
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div
      className={s.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel()
      }}
    >
      <div className={s.box}>
        <h2 id="confirm-modal-title" className={s.title}>
          {title}
        </h2>
        <p className={s.message}>{message}</p>
        <div className={s.actions}>
          <button type="button" className={`${s.btn} ${s.cancel}`} onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`${s.btn} ${confirmVariant === 'danger' ? s.danger : s.primary}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
