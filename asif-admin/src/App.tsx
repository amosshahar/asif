import { useState } from 'react'
import './theme.css'
import logo from './assets/logo-light.png'
import { useAuth } from './AuthContext'
import UsersPage from './pages/UsersPage'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import s from './App.module.css'

type Page = 'dashboard' | 'users'

export default function App() {
  const { user, loading, logout } = useAuth()
  const [page, setPage] = useState<Page>('dashboard')

  if (loading) {
    return (
      <div className={s.loadingShell}>
        <p className={s.loadingText}>טוען…</p>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <div className={s.shell}>
      <header className={s.nav}>
        <img src={logo} alt="אסיף" className={s.logo} />
        <nav className={s.navLinks}>
          <button
            className={`${s.navBtn} ${page === 'dashboard' ? s.active : ''}`}
            onClick={() => setPage('dashboard')}
          >
            דשבורד
          </button>
          <button
            className={`${s.navBtn} ${page === 'users' ? s.active : ''}`}
            onClick={() => setPage('users')}
          >
            משתמשים
          </button>
        </nav>
        <div className={s.navSpacer} />
        <span className={s.userEmail} title={user.email ?? ''}>
          {user.email ?? user.uid}
        </span>
        <button type="button" className={s.logoutBtn} onClick={() => void logout()}>
          יציאה
        </button>
      </header>
      <main className={s.main}>
        {page === 'dashboard' ? <DashboardPage /> : <UsersPage />}
      </main>
    </div>
  )
}
