import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import axios from 'axios'
import {
  clearLastAuthFailure,
  saveLastAuthFailure,
} from './authDebugStorage'
import { auth, googleProvider } from './firebase'
import { setAdminIdTokenGetter, verifyAdminSession } from './api'

type AuthState = {
  user: User | null
  loading: boolean
  gateError: string
  signInWithGoogle: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [gateError, setGateError] = useState('')

  useEffect(() => {
    setAdminIdTokenGetter(async () => {
      const u = auth.currentUser
      if (!u) return null
      return u.getIdToken()
    })

    return onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null)
        setLoading(false)
        return
      }

      setGateError('')
      setLoading(true)
      const apiBase =
        import.meta.env.VITE_API_URL ||
        (import.meta.env.DEV ? '/asif-api (proxy→3002)' : 'http://localhost:3002')
      try {
        const idToken = await u.getIdToken()
        await verifyAdminSession(idToken)
        clearLastAuthFailure()
        setUser(u)
      } catch (e) {
        let userMessage = 'החשבון אינו מורשה לניהול'
        let status: number | undefined
        let serverError: string | undefined
        if (axios.isAxiosError(e)) {
          status = e.response?.status
          serverError = (e.response?.data as { error?: string })?.error
          const body = serverError
          if (status === 403) {
            userMessage = 'החשבון אינו מורשה לניהול'
          } else if (status === 401) {
            userMessage =
              body === 'Invalid token'
                ? 'אימות נכשל — ודא ש־asif-server רץ עם אותו פרויקט Firebase (tulidu-prod)'
                : 'נדרשת התחברות מחדש'
          } else if (
            e.code === 'ERR_NETWORK' ||
            e.code === 'ECONNREFUSED' ||
            !e.response
          ) {
            userMessage = `לא נגיעה לשרת — הפעל asif-server (פורט 3002) ו־asif-admin כאן (פורט 5174). בסיס API: ${apiBase}`
          } else {
            userMessage = body || 'התחברות נכשלה'
          }
          saveLastAuthFailure({
            userMessage,
            status,
            apiPath: 'GET /admin/me',
            serverError: body,
            axiosCode: e.code,
            apiBaseUrl: apiBase,
          })
        } else {
          saveLastAuthFailure({
            userMessage,
            apiPath: 'GET /admin/me',
            apiBaseUrl: apiBase,
          })
        }
        setGateError(userMessage)
        await signOut(auth)
        setUser(null)
      } finally {
        setLoading(false)
      }
    })
  }, [])

  const signInWithGoogle = useCallback(async () => {
    setGateError('')
    clearLastAuthFailure()
    await signInWithPopup(auth, googleProvider)
  }, [])

  const logout = useCallback(async () => {
    setGateError('')
    clearLastAuthFailure()
    await signOut(auth)
  }, [])

  const value = useMemo(
    () => ({ user, loading, gateError, signInWithGoogle, logout }),
    [user, loading, gateError, signInWithGoogle, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const v = useContext(AuthContext)
  if (!v) throw new Error('useAuth must be used within AuthProvider')
  return v
}
