import { useState, useEffect, useCallback } from 'react'
import { getUsers, createUser, updateUser, deleteUser } from '../api'
import type { User, UserPayload } from '../api'
import UserModal from '../components/UserModal'
import s from './UsersPage.module.css'

const ROLE_LABEL: Record<string, string> = {
  collector: 'ליקוטן',
  manager: 'מנהל',
  customer_service: 'שירות לקוחות',
}

export default function UsersPage() {
  const [users, setUsers]       = useState<User[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [modal, setModal]       = useState<'create' | User | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setUsers(await getUsers())
      setError('')
    } catch {
      setError('שגיאה בטעינת המשתמשים')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSave(payload: UserPayload) {
    const isEdit = modal !== 'create'
    try {
      if (isEdit) {
        const updates: Partial<UserPayload> = { name: payload.name, role: payload.role }
        if (payload.pin) updates.pin = payload.pin
        await updateUser(payload.id, updates)
      } else {
        await createUser(payload)
      }
      setModal(null)
      load()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      alert(msg ?? 'שגיאה בשמירה')
    }
  }

  async function handleDelete(user: User) {
    if (!confirm(`למחוק את ${user.name}?`)) return
    setDeleting(user.id)
    try {
      await deleteUser(user.id)
      load()
    } catch {
      alert('שגיאה במחיקה')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className={s.page}>
      <div className={s.header}>
        <div>
          <h1 className={s.title}>ניהול משתמשים</h1>
          <p className={s.subtitle}>{users.length} משתמשים רשומים</p>
        </div>
        <button className={s.addBtn} onClick={() => setModal('create')}>
          + משתמש חדש
        </button>
      </div>

      {error && <div className={s.error}>{error}</div>}

      {loading ? (
        <div className={s.loading}>טוען...</div>
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>שם</th>
                <th>מזהה</th>
                <th>תפקיד</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr><td colSpan={4} className={s.empty}>אין משתמשים עדיין</td></tr>
              )}
              {users.map(u => (
                <tr key={u.id}>
                  <td className={s.nameCell}>{u.name}</td>
                  <td className={s.idCell}>{u.id}</td>
                  <td>
                    <span className={`${s.badge} ${s[u.role]}`}>
                      {ROLE_LABEL[u.role]}
                    </span>
                  </td>
                  <td className={s.actions}>
                    <button className={s.editBtn} onClick={() => setModal(u)}>
                      עריכה
                    </button>
                    <button
                      className={s.deleteBtn}
                      onClick={() => handleDelete(u)}
                      disabled={deleting === u.id}
                    >
                      {deleting === u.id ? '...' : 'מחיקה'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <UserModal
          user={modal === 'create' ? undefined : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
