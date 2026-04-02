import './theme.css'
import logo from './assets/logo-light.png'
import UsersPage from './pages/UsersPage'
import s from './App.module.css'

export default function App() {
  return (
    <div className={s.shell}>
      <header className={s.nav}>
        <img src={logo} alt="אסיף" className={s.logo} />
        <span className={s.navTitle}>פאנל ניהול</span>
      </header>
      <main className={s.main}>
        <UsersPage />
      </main>
    </div>
  )
}
