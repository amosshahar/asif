import { useState, useEffect } from 'react'
import './theme.css'
import { loadUser } from './auth'
import type { AuthUser } from './api'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    loadUser().then(u => {
      setUser(u)
      setChecking(false)
    })
  }, [])

  if (checking) return null

  if (!user) {
    return <LoginPage onLogin={setUser} />
  }

  return <HomePage user={user} onLogout={() => setUser(null)} />
}
