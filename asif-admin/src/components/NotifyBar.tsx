import s from './NotifyBar.module.css'

type Props = {
  variant: 'error' | 'success'
  message: string
  onDismiss: () => void
}

export default function NotifyBar({ variant, message, onDismiss }: Props) {
  return (
    <div
      className={`${s.bar} ${variant === 'error' ? s.error : s.success}`}
      role={variant === 'error' ? 'alert' : 'status'}
    >
      <span className={s.text}>{message}</span>
      <button type="button" className={s.dismiss} onClick={onDismiss} aria-label="סגור">
        ×
      </button>
    </div>
  )
}
