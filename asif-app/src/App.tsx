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
      gap: '24px',
    }}>
      <img src={logo} alt="אסיף" style={{ width: 140 }} />
      <h1 style={{
        color: 'var(--color-primary)',
        fontSize: '22px',
        fontWeight: 700,
      }}>
        מערכת איסוף הזמנות
      </h1>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
        טוען...
      </p>
    </div>
  )
}
