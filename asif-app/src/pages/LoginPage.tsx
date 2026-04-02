import { useState } from 'react'
const logo = '/logo.png'
import { login } from '../api'
import { saveUser } from '../auth'
import type { AuthUser } from '../api'
import s from './LoginPage.module.css'

interface Props {
  onLogin: (user: AuthUser) => void
}

export default function LoginPage({ onLogin }: Props) {
  const [id, setId]       = useState('')
  const [pin, setPin]     = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!id.trim() || !pin.trim()) return
    setError('')
    setLoading(true)
    try {
      const user = await login(id.trim(), pin)
      await saveUser(user)
      onLogin(user)
    } catch {
      setError('מזהה עובד או PIN שגויים')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={s.page}>
      <div className={s.card}>
        <img src={logo} alt="אסיף" className={s.logo} />
        <h1 className={s.title}>כניסה למערכת</h1>

        <form onSubmit={handleSubmit} className={s.form}>
          <label className={s.label}>
            מזהה עובד
            <input
              className={s.input}
              value={id}
              onChange={e => setId(e.target.value)}
              placeholder="הכנס מזהה"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
            />
          </label>

          <label className={s.label}>
            PIN
            <input
              className={s.input}
              type="password"
              value={pin}
              onChange={e => setPin(e.target.value)}
              placeholder="••••"
              inputMode="numeric"
              maxLength={8}
            />
          </label>

          {error && <p className={s.error}>{error}</p>}

          <button className={s.btn} type="submit" disabled={loading || !id || !pin}>
            {loading ? 'מתחבר...' : 'כניסה'}
          </button>
        </form>
      </div>
    </div>
  )
}
