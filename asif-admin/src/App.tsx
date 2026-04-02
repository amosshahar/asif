import { useState } from 'react'
import './theme.css'
import logo from './assets/logo-light.png'
import UsersPage from './pages/UsersPage'
import DashboardPage from './pages/DashboardPage'
import s from './App.module.css'

type Page = 'dashboard' | 'users'

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')

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
      </header>
      <main className={s.main}>
        {page === 'dashboard' ? <DashboardPage /> : <UsersPage />}
      </main>
    </div>
  )
}
