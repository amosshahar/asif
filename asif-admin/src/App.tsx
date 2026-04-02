import './theme.css'
import logo from './assets/logo.png'

export default function App() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
    }}>
      <img src={logo} alt="אסיף" style={{ width: 120 }} />
      <h1 style={{ color: 'var(--color-primary)', fontSize: '20px', fontWeight: 700 }}>
        פאנל ניהול
      </h1>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>
        טוען...
      </p>
    </div>
  )
}
