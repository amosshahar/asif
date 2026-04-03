import { useState, useEffect, useCallback } from 'react'
import {
  getWcLabCatalog,
  getWcLabFetch,
  getWcLabReadRoutes,
  type WcLabFetchResponse,
  type WcV3ReadRouteEntry,
  type WcV3ReadRouteQueryParam,
} from '../api'
import s from './ComaxLabPage.module.css'

function formatBody(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

function parseExtraQuery(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of raw.trim().split('&').filter(Boolean)) {
    const i = part.indexOf('=')
    if (i <= 0) continue
    const k = decodeURIComponent(part.slice(0, i).trim())
    const v = decodeURIComponent(part.slice(i + 1).trim())
    if (k && k !== 'path') out[k] = v
  }
  return out
}

function buildLabRelativePath(
  pattern: string,
  pathValues: Record<string, string>
): { ok: true; path: string } | { ok: false; error: string } {
  const rel = pattern.replace(/^\/wc\/v3\/?/, '').trim()
  const path = rel.replace(/\(\?P<(\w+)>[^)]+\)/g, (_full, name: string) => {
    return (pathValues[name] ?? '').trim()
  })
  if (!path) {
    return { ok: false, error: 'נתיב ריק — מלאו את פרמטרי הנתיב או בדקו את התבנית.' }
  }
  if (path.includes('..')) return { ok: false, error: 'נתיב לא תקין.' }
  if (path.length > 160) return { ok: false, error: 'נתיב ארוך מדי.' }
  if (!/^[\w/-]+$/.test(path)) {
    return {
      ok: false,
      error:
        'ערכי פרמטרים יוצרים נתיב עם תווים לא נתמכים במעבדה (מותר: אותיות, ספרות, /, -, _).',
    }
  }
  return { ok: true, path }
}

function queryParamLines(params: WcV3ReadRouteQueryParam[]): string {
  if (params.length === 0) return '(אין פרמטרי שאילתה מתועדים באינדקס ל־GET זה)'
  return params
    .map((p) => {
      const req = p.required ? 'חובה' : 'אופציונלי'
      let line = `${p.name} — ${p.type}, ${req}`
      if (p.enum?.length) line += `, ערכים: ${p.enum.join(' | ')}`
      if (p.default !== undefined) line += `, ברירת מחדל: ${JSON.stringify(p.default)}`
      return line
    })
    .join('\n')
}

export default function WcLabPage() {
  const [catalogErr, setCatalogErr] = useState<string | null>(null)
  const [storeOrigin, setStoreOrigin] = useState<string | null>(null)
  const [docsUrl, setDocsUrl] = useState<string | null>(null)
  const [wpHint, setWpHint] = useState<string | null>(null)

  const [readRoutes, setReadRoutes] = useState<WcV3ReadRouteEntry[]>([])
  const [readMeta, setReadMeta] = useState<{ from?: string; at?: string; count?: number } | null>(null)
  const [readErr, setReadErr] = useState<string | null>(null)

  const [perPage, setPerPage] = useState('20')
  const [page, setPage] = useState('1')
  const [extraQuery, setExtraQuery] = useState('')

  const [pathValues, setPathValues] = useState<Record<string, Record<string, string>>>({})
  const [results, setResults] = useState<Record<string, WcLabFetchResponse | undefined>>({})
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [copyOkId, setCopyOkId] = useState<string | null>(null)

  useEffect(() => {
    void getWcLabCatalog()
      .then((d) => {
        if (!d.configured) {
          setCatalogErr(d.error ?? 'WC לא מוגדר')
          return
        }
        setStoreOrigin(d.storeOrigin ?? null)
        setDocsUrl(d.docs ?? null)
        setWpHint(d.wpIndexHint ?? null)
      })
      .catch((e) => setCatalogErr(e instanceof Error ? e.message : 'שגיאה'))
  }, [])

  useEffect(() => {
    void getWcLabReadRoutes()
      .then((d) => {
        if (!d.configured) {
          setReadErr(d.error ?? 'לא ניתן לטעון רשימת נתיבים')
          return
        }
        const routes = d.routes ?? []
        setReadRoutes(routes)
        setReadMeta({
          from: d.generatedFrom,
          at: d.generatedAt,
          count: d.routeCount,
        })
        const init: Record<string, Record<string, string>> = {}
        for (const r of routes) {
          init[r.id] = {}
          for (const p of r.pathParams) init[r.id][p] = ''
        }
        setPathValues(init)
      })
      .catch((e) => setReadErr(e instanceof Error ? e.message : 'שגיאה'))
  }, [])

  const setPathField = useCallback((routeId: string, param: string, value: string) => {
    setPathValues((prev) => ({
      ...prev,
      [routeId]: { ...prev[routeId], [param]: value },
    }))
  }, [])

  const runRoute = useCallback(
    async (route: WcV3ReadRouteEntry) => {
      const pv = pathValues[route.id] || {}
      if (route.pathParams.length > 0) {
        const missing = route.pathParams.some((p) => !(pv[p] ?? '').trim())
        if (missing) {
          setResults((prev) => ({
            ...prev,
            [route.id]: { configured: true, error: 'נא למלא את כל פרמטרי הנתיב לפני הרצה.' },
          }))
          return
        }
      }
      const built = buildLabRelativePath(route.pattern, pv)
      if (!built.ok) {
        setResults((prev) => ({
          ...prev,
          [route.id]: { configured: true, error: built.error },
        }))
        return
      }

      setLoadingId(route.id)
      try {
        const data = await getWcLabFetch(built.path, {
          ...parseExtraQuery(extraQuery),
          per_page: perPage.trim() || '20',
          page: page.trim() || '1',
        })
        setResults((prev) => ({ ...prev, [route.id]: data }))
      } catch (e) {
        setResults((prev) => ({
          ...prev,
          [route.id]: {
            configured: true,
            error: e instanceof Error ? e.message : 'שגיאת רשת',
          },
        }))
      } finally {
        setLoadingId(null)
      }
    },
    [extraQuery, page, pathValues, perPage]
  )

  return (
    <div className={s.wrap}>
      <h1 className={s.title}>WooCommerce — מעבדה (זמני)</h1>
      <p className={s.sub}>
        קריאות ישירות ל־<code dir="ltr">/wp-json/wc/v3/…</code> עם מפתחות מהשרת בלבד. התשובה מוצגת כמעט
        כפי שהחנות מחזירה (טקסט גולמי; ניסיון לפרמט JSON לתצוגה).
      </p>
      <p className={s.paramHint}>
        <strong>להבדיל:</strong> ב־<code dir="ltr">/wp-json/</code> השדה <code dir="ltr">namespaces</code>{' '}
        מציג מה קיים באתר. אם אין שם <code dir="ltr">wc/v3</code> — אין WooCommerce REST בכתובת{' '}
        <code dir="ltr">WC_STORE_URL</code> (או Woo כבוי). <code dir="ltr">wp/v2</code> זה וורדפרס רגיל
        (פוסטים, משתמשי מערכת) — לא לקוחות חנות; לקוחות Woo הם ב־<code dir="ltr">wc/v3/customers</code>{' '}
        כש־Woo פעיל.
      </p>

      {catalogErr ? <p className={s.error}>{catalogErr}</p> : null}

      {docsUrl ? (
        <p className={s.paramHint}>
          ישויות ונתיבים:{' '}
          <a href={docsUrl} target="_blank" rel="noreferrer">
            WooCommerce REST API docs
          </a>
          {wpHint ? (
            <>
              {' '}
              · אינדקס כל ה־REST של WordPress (כולל תוספים):{' '}
              <a href={wpHint} target="_blank" rel="noreferrer">
                <code dir="ltr">/wp-json/</code>
              </a>
            </>
          ) : null}
        </p>
      ) : null}

      {storeOrigin ? (
        <p className={s.paramHint}>
          חנות: <code dir="ltr">{storeOrigin}</code>
        </p>
      ) : null}

      <fieldset className={s.fieldset}>
        <legend className={s.legend}>פרמטרי עימוד גלובליים (מועברים לכל קריאה ל־WC)</legend>
        <div className={s.row}>
          <label className={s.label} htmlFor="wc-per">
            per_page
          </label>
          <input
            id="wc-per"
            className={s.input}
            dir="ltr"
            value={perPage}
            onChange={(e) => setPerPage(e.target.value)}
          />
        </div>
        <div className={s.row}>
          <label className={s.label} htmlFor="wc-page">
            page
          </label>
          <input
            id="wc-page"
            className={s.input}
            dir="ltr"
            value={page}
            onChange={(e) => setPage(e.target.value)}
          />
        </div>
        <div className={s.row}>
          <label className={s.label} htmlFor="wc-extra-q">
            פרמטרי שאילתה נוספים (אופציונלי)
          </label>
          <input
            id="wc-extra-q"
            className={`${s.input} ${s.inputMono}`}
            dir="ltr"
            placeholder='status=processing&search=example'
            value={extraQuery}
            onChange={(e) => setExtraQuery(e.target.value)}
          />
          <p className={s.paramHint} style={{ marginTop: '0.35rem', marginBottom: 0 }}>
            מועברים לכל הבקשות בנוסף ל־<code dir="ltr">per_page</code> ו־<code dir="ltr">page</code> (השדות למעלה
            דורסים מפתחות זהים אם הופיעו כאן).
          </p>
        </div>
      </fieldset>

      <div className={s.form}>
        <section className={s.apiSection}>
          <h2 className={s.sectionHeading}>כל נתיבי GET ב־wc/v3</h2>
          {readErr ? <p className={s.error}>{readErr}</p> : null}
          {readMeta ? (
            <p className={s.paramHint}>
              מקור: <code dir="ltr">{readMeta.from}</code>
              {readMeta.at ? (
                <>
                  {' '}
                  · נוצר: <code dir="ltr">{readMeta.at}</code>
                </>
              ) : null}
              {readMeta.count != null ? <> · {readMeta.count} נתיבים</> : null}
              . לעדכון הרשימה אחרי שדרוג WooCommerce:{' '}
              <code dir="ltr">cd asif-server && npm run generate:wc-read-routes</code>
            </p>
          ) : null}
          <p className={s.paramHint}>
            לכל שורה: נתיב יחסי, פרמטרי שאילתה לפי אינדקס REST (שורה לכל פרמטר), מילוי פרמטרי נתיב אם יש{' '}
            <code dir="ltr">{'{'}…{'}'}</code>, כפתור הרצה, ואז התשובה מיד מתחת.
          </p>

          <div className={s.wcReadList}>
            {readRoutes.map((route) => {
              const res = results[route.id]
              const busy = loadingId === route.id
              return (
                <div key={route.id} className={s.wcReadRow}>
                  <div className={s.wcReadPathLine} dir="ltr">
                    {route.displayPath}
                  </div>
                  <div className={s.wcReadPattern} dir="ltr">
                    {route.pattern}
                  </div>

                  {route.pathParams.length > 0 ? (
                    <>
                      <div className={s.wcReadLabel}>פרמטרי נתיב</div>
                      <div className={s.wcReadPathInputs}>
                        {route.pathParams.map((param) => (
                          <div key={param} className={s.wcReadPathField}>
                            <label className={s.label} htmlFor={`${route.id}-${param}`}>
                              {param}
                            </label>
                            <input
                              id={`${route.id}-${param}`}
                              className={`${s.input} ${s.inputMono}`}
                              dir="ltr"
                              placeholder="מזהה מספרי"
                              value={pathValues[route.id]?.[param] ?? ''}
                              onChange={(e) => setPathField(route.id, param, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={s.wcReadLabel}>פרמטרי נתיב</div>
                      <p className={s.paramHint} style={{ marginTop: 0 }}>
                        אין
                      </p>
                    </>
                  )}

                  <div className={s.wcReadLabel}>פרמטרי שאילתה (מתועדים ב־GET)</div>
                  <pre className={s.wcReadQueryLine}>{queryParamLines(route.queryParams)}</pre>

                  <button
                    type="button"
                    className={s.runBtn}
                    disabled={!!catalogErr || busy}
                    onClick={() => void runRoute(route)}
                  >
                    {busy ? 'טוען…' : 'הרצה'}
                  </button>

                  {res ? (
                    <div style={{ marginTop: '0.65rem' }}>
                      {res.error ? <p className={s.error}>{res.error}</p> : null}
                      {res.wc ? (
                        <>
                          <p className={s.apiMeta} dir="ltr">
                            HTTP {res.wc.httpStatus}
                            {res.wc.contentType ? ` · ${res.wc.contentType}` : ''}
                          </p>
                          <p className={s.url}>{res.wc.endpoint}</p>
                          <div className={s.btnRow}>
                            <button
                              type="button"
                              className={s.btnSecondary}
                              onClick={() => {
                                const text = formatBody(res.wc!.bodyText)
                                void navigator.clipboard.writeText(text).then(() => {
                                  setCopyOkId(route.id)
                                  window.setTimeout(() => setCopyOkId(null), 2000)
                                })
                              }}
                            >
                              {copyOkId === route.id ? 'הועתק' : 'העתק גוף'}
                            </button>
                          </div>
                          {res.wc.truncated ? (
                            <p className={s.warnInline}>גוף התשובה קוצץ בשרת (מעל ~2.5MB).</p>
                          ) : null}
                          {res.lab?.note ? <p className={s.note}>{res.lab.note}</p> : null}
                          <pre className={s.wcReadPre}>{formatBody(res.wc.bodyText)}</pre>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
