/**
 * Import Firebase password hashes onto existing Supabase Auth users
 * so people can sign in with the same email + password.
 *
 * Prerequisites:
 * 1. Firebase Console → Authentication → Users → ⋮ → Password hash parameters
 *    Copy into migrate .env (see below).
 * 2. Export users (includes passwordHash + salt):
 *      cd scripts/migrate-firebase-to-supabase
 *      GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *        npx firebase-tools auth:export ./firebase-users.json \
 *        --project katana-personal --format=json
 * 3. node import-firebase-passwords.mjs
 *
 * Hash format (GoTrue):
 *   $fbscrypt$v=1,n=<mem_cost>,r=<rounds>,p=1,ss=<salt_sep>,sk=<signer_key>$<salt>$<hash>
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnvFile() {
  const envPath = resolve(__dirname, '.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const i = trimmed.indexOf('=')
    if (i < 0) continue
    const key = trimmed.slice(0, i).trim()
    let val = trimmed.slice(i + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnvFile()

function requireEnv(key) {
  const v = process.env[key]
  if (!v) throw new Error(`Missing env ${key}`)
  return v
}

function buildFbscryptHash({ passwordHash, salt, memCost, rounds, saltSeparator, signerKey }) {
  // n = mem_cost (log2 of scrypt N). r = rounds. p = 1 (Firebase default).
  return `$fbscrypt$v=1,n=${memCost},r=${rounds},p=1,ss=${saltSeparator},sk=${signerKey}$${salt}$${passwordHash}`
}

async function main() {
  const exportPath = resolve(
    __dirname,
    process.env.FIREBASE_USERS_JSON || './firebase-users.json',
  )
  if (!existsSync(exportPath)) {
    throw new Error(
      `Missing ${exportPath}. Run firebase auth:export first (see script header).`,
    )
  }

  const signerKey = requireEnv('FIREBASE_HASH_SIGNER_KEY')
  const saltSeparator = requireEnv('FIREBASE_HASH_SALT_SEPARATOR')
  const rounds = requireEnv('FIREBASE_HASH_ROUNDS')
  const memCost = requireEnv('FIREBASE_HASH_MEM_COST')

  const raw = JSON.parse(readFileSync(exportPath, 'utf8'))
  const users = Array.isArray(raw) ? raw : raw.users || []
  if (!users.length) throw new Error('No users in export file')

  const supabase = createClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // Map email → supabase user id
  const { data: listed, error: listErr } = await supabase.auth.admin.listUsers({
    perPage: 1000,
  })
  if (listErr) throw listErr
  const byEmail = new Map(
    (listed?.users || []).map((u) => [String(u.email || '').toLowerCase(), u]),
  )

  let updated = 0
  let skipped = 0
  let missing = 0

  for (const u of users) {
    const email = String(u.email || '').toLowerCase()
    if (!email) {
      skipped += 1
      continue
    }
    const passwordHash = u.passwordHash || u.password_hash
    const salt = u.salt
    if (!passwordHash || !salt) {
      console.log(`  skip ${email} (no password hash — likely Apple/OAuth only)`)
      skipped += 1
      continue
    }

    const existing = byEmail.get(email)
    if (!existing) {
      console.log(`  missing in Supabase: ${email}`)
      missing += 1
      continue
    }

    const hash = buildFbscryptHash({
      passwordHash,
      salt,
      memCost,
      rounds,
      saltSeparator,
      signerKey,
    })

    // Admin API accepts password_hash for pre-hashed passwords (Firebase scrypt).
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      // @ts-expect-error password_hash is supported by GoTrue admin API
      password_hash: hash,
      email_confirm: true,
    })

    if (error) {
      console.warn(`  FAIL ${email}:`, error.message)
      continue
    }
    console.log(`  ok ${email}`)
    updated += 1
  }

  console.log(`Done. updated=${updated} skipped=${skipped} missing=${missing}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
