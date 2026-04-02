/**
 * Create/update `asif_admins/{email}` for web admin (asif-admin Google sign-in).
 * Uses asif-server/.env (FIREBASE_*).
 *
 * Usage: npx ts-node scripts/add-asif-admin.ts avishin5@gmail.com
 */
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { getFirestoreDb } from '../src/firebaseAdmin'
import { ASIF_ADMINS_COLLECTION } from '../src/firestoreCollections'

const pkgRoot = path.join(__dirname, '..')
const pkgEnv = path.join(pkgRoot, '.env')
dotenv.config({ path: pkgEnv, override: true })
const cwdAsifEnv = path.join(process.cwd(), 'asif-server', '.env')
if (fs.existsSync(cwdAsifEnv) && path.resolve(cwdAsifEnv) !== path.resolve(pkgEnv)) {
  dotenv.config({ path: cwdAsifEnv, override: true })
}

async function main(): Promise<void> {
  const raw = process.argv[2]?.trim().toLowerCase()
  if (!raw || !raw.includes('@')) {
    console.error('Usage: npx ts-node scripts/add-asif-admin.ts <email>')
    process.exit(1)
  }
  const db = getFirestoreDb()
  const ref = db.collection(ASIF_ADMINS_COLLECTION).doc(raw)
  await ref.set(
    {
      email: raw,
      addedAt: new Date().toISOString(),
    },
    { merge: true }
  )
  console.log(`OK — ${ASIF_ADMINS_COLLECTION}/${raw}`)
  console.log('Note: server caches allowlist ~60s; restart asif-server or wait before testing.')
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
