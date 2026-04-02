import { useState, useEffect } from 'react'
import type { User, UserPayload } from '../api'
import s from './UserModal.module.css'

interface Props {
  user?: User          // if set → edit mode, else → create mode
  onSave: (payload: UserPayload) => void
  onClose: () => void
}

export default function UserModal({ user, onSave, onClose }: Props) {
  const [id, setId]     = useState(user?.id   ?? '')
  const [name, setName] = useState(user?.name ?? '')
  const [pin, setPin]   = useState('')
  const [role, setRole] = useState<'collector' | 'manager' | 'customer_service'>(
    user?.role ?? 'collector'
  )

  const isEdit = !!user

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    if (!isEdit && (!id.trim() || !pin.trim())) return
    onSave({ id: id.trim(), name: name.trim(), pin, role })
  }

  return (
    <div className={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={s.modal}>
        <h2 className={s.title}>{isEdit ? 'עריכת משתמש' : 'משתמש חדש'}</h2>

        <form onSubmit={handleSubmit} className={s.form}>
          <label>
            מזהה עובד
            <input
              value={id}
              onChange={e => setId(e.target.value)}
              placeholder="לדוגמה: 001"
              disabled={isEdit}
              required={!isEdit}
              autoFocus={!isEdit}
            />
          </label>

          <label>
            שם מלא
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="שם הליקוטן"
              required
              autoFocus={isEdit}
            />
          </label>

          <label>
            {isEdit ? 'PIN חדש (השאר ריק לאי-שינוי)' : 'PIN'}
            <input
              type="password"
              value={pin}
              onChange={e => setPin(e.target.value)}
              placeholder="4 ספרות"
              maxLength={8}
              required={!isEdit}
              inputMode="numeric"
            />
          </label>

          <label>
            תפקיד
            <select
              value={role}
              onChange={e =>
                setRole(e.target.value as 'collector' | 'manager' | 'customer_service')
              }
            >
              <option value="collector">ליקוטן</option>
              <option value="manager">מנהל</option>
              <option value="customer_service">שירות לקוחות</option>
            </select>
          </label>

          <div className={s.actions}>
            <button type="button" className={s.cancel} onClick={onClose}>ביטול</button>
            <button type="submit" className={s.save}>שמור</button>
          </div>
        </form>
      </div>
    </div>
  )
}
