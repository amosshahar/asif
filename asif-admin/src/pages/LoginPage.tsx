import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../AuthContext'
import { getApiBaseUrl, pingAsifApi } from '../api'
import {
  clearLastAuthFailure,
  loadLastAuthFailure,
  type LastAuthFailure,
} from '../authDebugStorage'
import { isFirebaseWebReady } from '../firebase'
import logo from '../assets/logo-light.png'
import s from './LoginPage.module.css'

type ApiState = 'checking' | 'ok' | 'fail'

export default function LoginPage() {
  const { signInWithGoogle, gateError } = useAuth()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [storedFail, setStoredFail] = useState<LastAuthFailure | null>(null)
  const [apiState, setApiState] = useState<ApiState>('checking')
  const [apiDetail, setApiDetail] = useState('')

  const firebaseOk = isFirebaseWebReady()

  const runPing = useCallback(async () => {
    setApiState('checking')
    setApiDetail('')
    const r = await pingAsifApi()
    if (r.ok) {
      setApiState('ok')
      setApiDetail(r.serverTime)
    } else {
      setApiState('fail')
      setApiDetail(r.message)
    }
  }, [])

  useEffect(() => {
    void runPing()
  }, [runPing])

  useEffect(() => {
    setStoredFail(loadLastAuthFailure())
  }, [gateError])

  const displayError = error || gateError || storedFail?.userMessage
  const canUseGoogle = firebaseOk && apiState === 'ok'

  function dismissStored() {
    clearLastAuthFailure()
    setStoredFail(null)
  }

  async function onGoogle() {
    setError('')
    setBusy(true)
    try {
      await signInWithGoogle()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'התחברות נכשלה'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={s.wrap}>
      <div className={s.card}>
        <div className={s.cardHeader}>
          <img src={logo} alt="אסיף" className={s.logo} />
        </div>
        <h1 className={s.title}>ניהול אסיף</h1>

        <ol className={s.steps}>
          <li>
            טרמינל 1: <code className={s.code}>cd asif-server && npm run dev</code> (פורט 3002)
          </li>
          <li>
            טרמינל 2: <code className={s.code}>cd asif-admin && npm run dev</code> (פורט 5174)
          </li>
          <li>פתח את האתר מ־Vite: <strong>http://localhost:5174</strong></li>
        </ol>

        <div
          className={
            apiState === 'ok'
              ? s.apiOk
              : apiState === 'fail'
                ? s.apiFail
                : s.apiPending
          }
        >
          {apiState === 'checking' && 'בודק חיבור ל־API…'}
          {apiState === 'ok' && (
            <>
              שלב 1 הושלם: השרת עונה ({getApiBaseUrl()})
              {apiDetail && (
                <span className={s.apiTime}> · זמן שרת {apiDetail}</span>
              )}
            </>
          )}
          {apiState === 'fail' && (
            <>
              <strong>לא מצליחים להגיע ל־asif-server.</strong>
              <div className={s.apiErrDetail}>{apiDetail}</div>
              <button type="button" className={s.retryBtn} onClick={() => void runPing()}>
                נסה שוב
              </button>
            </>
          )}
        </div>

        {!firebaseOk && (
          <div className={s.apiFail}>
            <strong>חסרות משתני Firebase ב־asif-admin/.env</strong> — צריך VITE_FIREBASE_API_KEY,
            AUTH_DOMAIN, PROJECT_ID, APP_ID (אותו פרויקט כמו השרת). אחרי שינוי: עצור והפעל מחדש{' '}
            <code className={s.code}>npm run dev</code>.
          </div>
        )}

        <p className={s.hint}>
          שלב 2: התחברות Google (חלון קופץ). האימייל חייב להופיע ב־Firestore{' '}
          <code className={s.code}>asif_admins</code> בלבד.
        </p>

        {displayError && (
          <div className={s.errorBox}>
            <div className={s.error}>{displayError}</div>
            {storedFail && (
              <div className={s.technical}>
                <div>
                  {storedFail.apiPath} · בסיס API: {storedFail.apiBaseUrl}
                  {storedFail.status != null && ` · HTTP ${storedFail.status}`}
                </div>
                {storedFail.serverError && <div>שרת: {storedFail.serverError}</div>}
                {storedFail.axiosCode && <div>רשת: {storedFail.axiosCode}</div>}
                <button type="button" className={s.dismissBtn} onClick={dismissStored}>
                  סגור פרטים
                </button>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          className={s.googleBtn}
          onClick={onGoogle}
          disabled={busy || !canUseGoogle}
          title={
            !firebaseOk
              ? 'השלם הגדרת Firebase ב-.env'
              : apiState !== 'ok'
                ? 'חכה לחיבור מוצלח לשרת'
                : undefined
          }
        >
          {busy ? 'מתחבר…' : 'המשך עם Google'}
        </button>
      </div>
    </div>
  )
}
