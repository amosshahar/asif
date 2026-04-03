import { useState } from 'react'
import {
  postComaxCustomersSearch,
  postComaxCustomerById,
  postComaxOrders,
  postComaxItems,
  type ComaxLabBlock,
  type ComaxUpstream,
} from '../api'
import s from './ComaxLabPage.module.css'

type LoadingKey = null | 'search' | 'byId' | 'orders' | 'items'

type ComaxResultBundle = { comax: ComaxUpstream; block: ComaxLabBlock }

function ResultPanel({
  comax,
  block,
  error,
}: {
  comax: ComaxUpstream | null
  block: ComaxLabBlock | null
  error: string | null
}) {
  if (error) {
    return <p className={s.error}>{error}</p>
  }
  if (!block || !comax) {
    return null
  }
  return (
    <article className={`${s.block} ${block.ok ? s.blockOk : s.blockBad}`}>
      <h4 className={s.blockTitle}>
        תשובה מ־Comax · HTTP {comax.httpStatus} · {comax.method}{' '}
        <span className={s.url}>{comax.endpoint}</span>
      </h4>
      {comax.truncated ? (
        <p className={s.warnInline}>גוף התשובה קוצץ בשרת ASIF בגלל גודל (עדיין כמעט מלא).</p>
      ) : null}
      {comax.body ? <pre className={s.pre}>{comax.body}</pre> : null}
      <h4 className={s.labMetaTitle}>פענוח מקומי (ASIF בלבד)</h4>
      <p className={s.note}>{block.note}</p>
      <p className={s.url}>{block.url}</p>
    </article>
  )
}

export default function ComaxLabPage() {
  const [organization, setOrganization] = useState('')
  const [loginId, setLoginId] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  const [searchMobile, setSearchMobile] = useState('')
  const [searchPhone, setSearchPhone] = useState('')
  const [searchEmail, setSearchEmail] = useState('')
  const [searchId, setSearchId] = useState('')
  const [searchName, setSearchName] = useState('')
  const [searchCity, setSearchCity] = useState('')
  const [searchGroupId, setSearchGroupId] = useState('')
  const [byIdCustomerId, setByIdCustomerId] = useState('')
  const [ordersFrom, setOrdersFrom] = useState('')
  const [ordersTo, setOrdersTo] = useState('')
  const [itemsStoreId, setItemsStoreId] = useState('')

  const [loading, setLoading] = useState<LoadingKey>(null)

  const [resSearch, setResSearch] = useState<ComaxResultBundle | null>(null)
  const [errSearch, setErrSearch] = useState<string | null>(null)
  const [resById, setResById] = useState<ComaxResultBundle | null>(null)
  const [errById, setErrById] = useState<string | null>(null)
  const [resOrders, setResOrders] = useState<ComaxResultBundle | null>(null)
  const [errOrders, setErrOrders] = useState<string | null>(null)
  const [resItems, setResItems] = useState<ComaxResultBundle | null>(null)
  const [errItems, setErrItems] = useState<string | null>(null)

  function auth() {
    return {
      organization: organization.trim() || undefined,
      loginId: loginId.trim() || undefined,
      loginPassword: loginPassword || undefined,
    }
  }

  async function runSearch() {
    setLoading('search')
    setErrSearch(null)
    setResSearch(null)
    try {
      const data = await postComaxCustomersSearch({
        ...auth(),
        mobile: searchMobile.trim(),
        phone: searchPhone.trim(),
        email: searchEmail.trim(),
        id: searchId.trim(),
        name: searchName.trim(),
        city: searchCity.trim(),
        groupId: searchGroupId.trim(),
      })
      if (!data.configured) {
        setErrSearch(data.error)
        return
      }
      setResSearch({ comax: data.comax, block: data.block })
    } catch (e) {
      setErrSearch(e instanceof Error ? e.message : 'שגיאת רשת')
    } finally {
      setLoading(null)
    }
  }

  async function runById() {
    setLoading('byId')
    setErrById(null)
    setResById(null)
    try {
      const data = await postComaxCustomerById({
        ...auth(),
        customerId: byIdCustomerId.trim(),
      })
      if (!data.configured) {
        setErrById(data.error)
        return
      }
      setResById({ comax: data.comax, block: data.block })
    } catch (e) {
      setErrById(e instanceof Error ? e.message : 'שגיאת רשת')
    } finally {
      setLoading(null)
    }
  }

  async function runOrders() {
    setLoading('orders')
    setErrOrders(null)
    setResOrders(null)
    try {
      const data = await postComaxOrders({
        ...auth(),
        fromDate: ordersFrom.trim(),
        toDate: ordersTo.trim(),
      })
      if (!data.configured) {
        setErrOrders(data.error)
        return
      }
      setResOrders({ comax: data.comax, block: data.block })
    } catch (e) {
      setErrOrders(e instanceof Error ? e.message : 'שגיאת רשת')
    } finally {
      setLoading(null)
    }
  }

  async function runItems() {
    setLoading('items')
    setErrItems(null)
    setResItems(null)
    try {
      const data = await postComaxItems({
        ...auth(),
        storeId: itemsStoreId.trim(),
      })
      if (!data.configured) {
        setErrItems(data.error)
        return
      }
      setResItems({ comax: data.comax, block: data.block })
    } catch (e) {
      setErrItems(e instanceof Error ? e.message : 'שגיאת רשת')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className={s.wrap}>
      <h1 className={s.title}>בדיקת Comax (זמני)</h1>
      <p className={s.sub}>
        כל כפתור מריץ קריאה אחת בלבד. השרת קורא ל־<code dir="ltr">ws.comax.co.il</code> (CORS).
      </p>
      <p className={s.warn}>
        אם לא ממלאים משתמש/סיסמה כאן, השרת משתמש ב־<code dir="ltr">COMAX_LOGIN_ID</code> /{' '}
        <code dir="ltr">COMAX_LOGIN_PASSWORD</code> בקונפיג.
      </p>

      <fieldset className={s.fieldset}>
        <legend className={s.legend}>התחברות Comax — משותף לכל הקריאות</legend>
        <p className={s.paramHint}>
          במסך הכניסה של Comax יש לרוב <strong>ארגון</strong> + <strong>משתמש</strong> + סיסמה. ב־Web Service רשמי
          אין שדה ארגון נפרד — לעיתים צריך <code dir="ltr">LoginID</code> בצורת{' '}
          <code dir="ltr">ארגון\משתמש</code>. מלאו ארגון למטה, או הדביקו את מחרוזת ה־Login המלאה בשדה משתמש
          (עם <code dir="ltr">\</code> או <code dir="ltr">/</code>) והשאירו ארגון ריק.
        </p>
        <div className={s.row}>
          <label className={s.label} htmlFor="comax-org">
            ארגון (אופציונלי) → נשלח כ־<code dir="ltr">LoginID = ארגון\משתמש</code>
          </label>
          <input
            id="comax-org"
            className={s.input}
            dir="ltr"
            placeholder="למשל אסיף1"
            autoComplete="off"
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
          />
        </div>
        <div className={s.row}>
          <label className={s.label} htmlFor="comax-login">
            משתמש (LoginID ל־WS, בלי ארגון אם מילאת ארגון למעלה)
          </label>
          <input
            id="comax-login"
            className={s.input}
            dir="ltr"
            autoComplete="off"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
          />
        </div>
        <div className={s.row}>
          <label className={s.label} htmlFor="comax-pw">
            סיסמה
          </label>
          <input
            id="comax-pw"
            type="password"
            className={s.input}
            dir="ltr"
            autoComplete="off"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
          />
        </div>
      </fieldset>

      <div className={s.form}>
        {/* 1 — Customer search */}
        <section className={s.apiSection} aria-labelledby="comax-h-search">
          <h2 id="comax-h-search" className={s.sectionHeading}>
            1) חיפוש לקוחות
          </h2>
          <p className={s.apiMeta} dir="ltr">
            Customers_Service.asmx · <strong>Get_CustomerDetailsBySearch_Simple</strong>
          </p>
          <p className={s.paramHint}>
            כל השדות אופציונליים — מלאו לפי כרטיס הלקוח בקומקס (טלפון/נייד לרוב הכי אמין).{' '}
            <code dir="ltr">ID</code> כאן = שדה החיפוש ב־WS (לא אותו דבר כמו CustomerID במקטע 2).
          </p>
          <div className={s.row}>
            <label className={s.label} htmlFor="cx-phone">
              Phone (טלפון) → WS Phone
            </label>
            <input
              id="cx-phone"
              className={s.input}
              dir="ltr"
              placeholder="0524477639"
              autoComplete="off"
              value={searchPhone}
              onChange={(e) => setSearchPhone(e.target.value)}
            />
          </div>
          <div className={s.row}>
            <label className={s.label} htmlFor="cx-mobile">
              Mobile (נייד) → WS Mobile
            </label>
            <input
              id="cx-mobile"
              className={s.input}
              dir="ltr"
              placeholder="05xxxxxxxx"
              autoComplete="off"
              value={searchMobile}
              onChange={(e) => setSearchMobile(e.target.value)}
            />
          </div>
          <div className={s.row}>
            <label className={s.label} htmlFor="cx-email">
              Email → WS Email
            </label>
            <input
              id="cx-email"
              className={s.input}
              dir="ltr"
              autoComplete="off"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
            />
          </div>
          <div className={s.row}>
            <label className={s.label} htmlFor="cx-sid">
              ID (לקוח לחיפוש) → WS ID
            </label>
            <input
              id="cx-sid"
              className={s.input}
              dir="ltr"
              placeholder="112060"
              autoComplete="off"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
            />
          </div>
          <div className={s.row}>
            <label className={s.label} htmlFor="cx-sname">
              Name (שם) → WS Name
            </label>
            <input
              id="cx-sname"
              className={s.input}
              autoComplete="off"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
            />
          </div>
          <div className={s.row}>
            <label className={s.label} htmlFor="cx-scity">
              City (ישוב) → WS City
            </label>
            <input
              id="cx-scity"
              className={s.input}
              autoComplete="off"
              value={searchCity}
              onChange={(e) => setSearchCity(e.target.value)}
            />
          </div>
          <div className={s.row}>
            <label className={s.label} htmlFor="cx-sgroup">
              GroupID (קבוצה) → WS GroupID
            </label>
            <input
              id="cx-sgroup"
              className={s.input}
              dir="ltr"
              placeholder="1120100"
              autoComplete="off"
              value={searchGroupId}
              onChange={(e) => setSearchGroupId(e.target.value)}
            />
          </div>
          <button
            type="button"
            className={s.runBtn}
            disabled={loading !== null}
            onClick={() => void runSearch()}
          >
            {loading === 'search' ? 'מריץ…' : 'הרצת חיפוש לקוחות'}
          </button>
          <ResultPanel comax={resSearch?.comax ?? null} block={resSearch?.block ?? null} error={errSearch} />
        </section>

        {/* 2 — Customer by ID */}
        <section className={s.apiSection} aria-labelledby="comax-h-byid">
          <h2 id="comax-h-byid" className={s.sectionHeading}>
            2) לקוח לפי קוד
          </h2>
          <p className={s.apiMeta} dir="ltr">
            Customers_Service.asmx · <strong>Get_CustomerDetails_Simple</strong>
          </p>
          <p className={s.paramHint}>
            בכרטיס לקוח בקומקס יש לרוב <strong>לקוח</strong> (מספר תצוגה, למשל 112060) ו־<strong>קבוע</strong> (מזהה
            קבוע/פנימי אחר, למשל 2487). ל־WS יש רק שדה <code dir="ltr">CustomerID</code> — אם שלחת את{' '}
            <strong>לקוח</strong> וקיבלת <code dir="ltr">ID=0</code>, הרץ שוב עם המספר מ־<strong>קבוע</strong>{' '}
            (או להפך). בנוסף: וודא <strong>ארגון\משתמש</strong> בכניסה, ובמקטע 1 אפשר לחפש לפי{' '}
            <strong>נייד/טלפון</strong> מהכרטיס.
          </p>
          <div className={s.row}>
            <label className={s.label} htmlFor="cx-custid">
              CustomerID (נסו לקוח או קבוע) → Get_CustomerDetails_Simple
            </label>
            <input
              id="cx-custid"
              className={s.input}
              dir="ltr"
              autoComplete="off"
              value={byIdCustomerId}
              onChange={(e) => setByIdCustomerId(e.target.value)}
            />
          </div>
          <button
            type="button"
            className={s.runBtn}
            disabled={loading !== null}
            onClick={() => void runById()}
          >
            {loading === 'byId' ? 'מריץ…' : 'הרצת לקוח לפי קוד'}
          </button>
          <ResultPanel comax={resById?.comax ?? null} block={resById?.block ?? null} error={errById} />
        </section>

        {/* 3 — Orders */}
        <section className={s.apiSection} aria-labelledby="comax-h-orders">
          <h2 id="comax-h-orders" className={s.sectionHeading}>
            3) הזמנות לפי טווח תאריכים
          </h2>
          <p className={s.apiMeta} dir="ltr">
            CustomersOrders_Service.asmx · <strong>Get_CustomersOrdersDetails</strong>
          </p>
          <p className={s.paramHint}>פרמטרים ל־WS: FromDate, ToDate (שניהם חובה — לרוב dd/MM/yyyy)</p>
          <div className={s.row}>
            <label className={s.label} htmlFor="cx-from">
              FromDate → Get_CustomersOrdersDetails
            </label>
            <input
              id="cx-from"
              className={s.input}
              dir="ltr"
              placeholder="dd/MM/yyyy"
              autoComplete="off"
              value={ordersFrom}
              onChange={(e) => setOrdersFrom(e.target.value)}
            />
          </div>
          <div className={s.row}>
            <label className={s.label} htmlFor="cx-to">
              ToDate → Get_CustomersOrdersDetails
            </label>
            <input
              id="cx-to"
              className={s.input}
              dir="ltr"
              placeholder="dd/MM/yyyy"
              autoComplete="off"
              value={ordersTo}
              onChange={(e) => setOrdersTo(e.target.value)}
            />
          </div>
          <button
            type="button"
            className={s.runBtn}
            disabled={loading !== null}
            onClick={() => void runOrders()}
          >
            {loading === 'orders' ? 'מריץ…' : 'הרצת הזמנות'}
          </button>
          <ResultPanel comax={resOrders?.comax ?? null} block={resOrders?.block ?? null} error={errOrders} />
        </section>

        {/* 4 — Items */}
        <section className={s.apiSection} aria-labelledby="comax-h-items">
          <h2 id="comax-h-items" className={s.sectionHeading}>
            4) מוצרים לפי מחסן
          </h2>
          <p className={s.apiMeta} dir="ltr">
            Items_Service.asmx · <strong>GetAllItemsDetails</strong>
          </p>
          <p className={s.paramHint}>פרמטר ל־WS: StoreID (מחסן — חובה)</p>
          <div className={s.row}>
            <label className={s.label} htmlFor="cx-store">
              StoreID → GetAllItemsDetails
            </label>
            <input
              id="cx-store"
              className={s.input}
              dir="ltr"
              autoComplete="off"
              value={itemsStoreId}
              onChange={(e) => setItemsStoreId(e.target.value)}
            />
          </div>
          <button
            type="button"
            className={s.runBtn}
            disabled={loading !== null}
            onClick={() => void runItems()}
          >
            {loading === 'items' ? 'מריץ…' : 'הרצת מוצרים'}
          </button>
          <ResultPanel comax={resItems?.comax ?? null} block={resItems?.block ?? null} error={errItems} />
        </section>
      </div>
    </div>
  )
}
