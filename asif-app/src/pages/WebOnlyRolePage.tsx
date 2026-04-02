import type { AuthUser } from '../api'
import { clearUser } from '../auth'
const logo = '/logo.png'
import s from './WebOnlyRolePage.module.css'

interface Props {
  user: AuthUser
  onLogout: () => void
}

export default function WebOnlyRolePage({ user, onLogout }: Props) {
  const isCs = user.role === 'customer_service'
  const title = isCs ? 'שירות לקוחות' : 'מנהל'
  const body = isCs
    ? 'ממשק טיפול בחוסרים ובחריגות (לפי האפיון) יתווסף בשלב הבא. כרגע אין אפליקציית ליקוט לתפקיד זה — השתמש במערכת הניהול מהדפדפן כשתהיה זמינה.'
    : 'ניהול הזמנות ודשבורד זמינים דרך האדמין בדפדפן. אפליקציה זו מיועדת לליקוטנים בלבד.'

  async function handleLogout() {
    await clearUser()
    onLogout()
  }

  return (
    <div className={s.page}>
      <header className={s.header}>
        <img src={logo} alt="אסיף" className={s.logo} />
        <button type="button" className={s.logoutBtn} onClick={handleLogout}>
          יציאה
        </button>
      </header>
      <div className={s.body}>
        <p className={s.greeting}>
          שלום, {user.name}
        </p>
        <p className={s.role}>{title}</p>
        <p className={s.msg}>{body}</p>
      </div>
    </div>
  )
}
