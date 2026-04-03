#!/usr/bin/env node
/**
 * Reads docs/wc-asif-json.json (WordPress REST index) and emits
 * src/routes/wcV3ReadRoutes.generated.json — GET routes under /wc/v3 with slim query metadata.
 *
 * Run from repo root: node asif-server/scripts/generate-wc-v3-read-routes.mjs
 * Or: cd asif-server && npm run generate:wc-read-routes
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../..')
const input = path.join(repoRoot, 'docs/wc-asif-json.json')
const outFile = path.join(__dirname, '../src/routes/wcV3ReadRoutes.generated.json')

const WP_ROUTE_PARAM = /\(\?P<(\w+)>[^)]+\)/g

function hasGet(route) {
  return (route.endpoints || []).some((e) => (e.methods || []).includes('GET'))
}

function mergeGetArgs(route) {
  const merged = {}
  for (const ep of route.endpoints || []) {
    if (!ep.methods?.includes('GET')) continue
    const args = ep.args || {}
    for (const [k, spec] of Object.entries(args)) {
      if (!spec || typeof spec !== 'object') continue
      const cur = merged[k] || {}
      merged[k] = {
        required: !!(cur.required || spec.required),
        type: spec.type || cur.type || 'string',
        enum: spec.enum ?? cur.enum,
        default: spec.default !== undefined ? spec.default : cur.default,
      }
    }
  }
  return merged
}

function displayPath(rel) {
  return rel.replace(WP_ROUTE_PARAM, (_, name) => `{${name}}`)
}

function pathParamNames(rel) {
  const names = []
  let m
  const re = /\(\?P<(\w+)>[^)]+\)/g
  while ((m = re.exec(rel)) !== null) names.push(m[1])
  return names
}

function slimArg(name, spec) {
  const o = {
    name,
    required: !!spec.required,
    type: typeof spec.type === 'string' ? spec.type : 'string',
  }
  if (Array.isArray(spec.enum)) o.enum = spec.enum
  if (spec.default !== undefined && spec.default !== '') o.default = spec.default
  return o
}

function main() {
  const raw = fs.readFileSync(input, 'utf8')
  const j = JSON.parse(raw)
  const routes = j.routes || {}
  const out = []
  let n = 0

  for (const key of Object.keys(routes).sort()) {
    if (!key.startsWith('/wc/v3')) continue
    const route = routes[key]
    if (!hasGet(route)) continue

    const rel = key.replace(/^\/wc\/v3\/?/, '').trim()
    if (!rel) continue

    const params = pathParamNames(rel)
    const merged = mergeGetArgs(route)
    for (const p of params) delete merged[p]

    const queryParams = Object.entries(merged)
      .map(([name, spec]) => slimArg(name, spec))
      .sort((a, b) => {
        if (a.required !== b.required) return a.required ? -1 : 1
        return a.name.localeCompare(b.name)
      })

    out.push({
      id: `wc3-${n++}`,
      pattern: key,
      displayPath: displayPath(rel),
      pathParams: params,
      queryParams,
    })
  }

  const payload = {
    generatedFrom: 'docs/wc-asif-json.json',
    generatedAt: new Date().toISOString(),
    routeCount: out.length,
    routes: out,
  }

  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), 'utf8')
  console.log(`Wrote ${out.length} GET routes to ${path.relative(repoRoot, outFile)}`)
}

main()
