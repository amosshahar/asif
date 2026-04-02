import { useState, useEffect } from 'react'
import './theme.css'
import { loadUser } from './auth'
import type { AuthUser, Order } from './api'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import PickListPage from './pages/PickListPage'
import WebOnlyRolePage from './pages/WebOnlyRolePage'

type Screen = 'login' | 'home' | 'picklist'

export default function App() {
  const [user, setUser]     = useState<AuthUser | null>(null)
  const [order, setOrder]   = useState<Order | null>(null)
  const [screen, setScreen] = useState<Screen>('login')
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    loadUser().then(u => {
      if (u) { setUser(u); setScreen('home') }
      setChecking(false)
    })
  }, [])

  if (checking) return null

  if (screen === 'login' || !user) {
    return <LoginPage onLogin={u => { setUser(u); setScreen('home') }} />
  }

  if (user.role === 'manager' || user.role === 'customer_service') {
    return (
      <WebOnlyRolePage
        user={user}
        onLogout={() => { setUser(null); setOrder(null); setScreen('login') }}
      />
    )
  }

  if (screen === 'picklist' && order) {
    return (
      <PickListPage
        order={order}
        onOrderComplete={() => { setOrder(null); setScreen('home') }}
        onBack={() => setScreen('home')}
      />
    )
  }

  return (
    <HomePage
      user={user}
      onLogout={() => { setUser(null); setOrder(null); setScreen('login') }}
      onStartOrder={o => { setOrder(o); setScreen('picklist') }}
    />
  )
}
