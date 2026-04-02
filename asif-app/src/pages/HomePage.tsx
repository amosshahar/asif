import type { AuthUser } from '../api'
import { clearUser } from '../auth'
import logo from '../assets/logo.png'
import s from './HomePage.module.css'

interface Props {
  user: AuthUser
  onLogout: () => void
}

export default function HomePage({ user, onLogout }: Props) {
  async function handleLogout() {
    await clearUser()
    onLogout()
  }

  return (
    <div className={s.page}>
      <header className={s.header}>
        <img src={logo} alt="אסיף" className={s.logo} />
        <button className={s.logoutBtn} onClick={handleLogout}>יציאה</button>
      </header>

      <div className={s.body}>
        <p className={s.greeting}>שלום, {user.name}</p>
        <p className={s.sub}>אין הזמנות פתוחות כרגע</p>
      </div>
    </div>
  )
}
