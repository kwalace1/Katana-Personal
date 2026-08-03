#!/usr/bin/env node
/**
 * Provision Katana Switch integration: migration check, OAuth client, .env update.
 *
 * Prerequisites:
 *   .env with VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage: npm run switch:setup
 */
import { createHash, randomBytes } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const ENV_PATH = path.join(ROOT, '.env')

dotenv.config({ path: ENV_PATH })

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function hashSecret(secret) {
  return createHash('sha256').update(secret).digest('hex')
}

function generateSecret() {
  return randomBytes(32).toString('base64url')
}

function upsertEnv(updates) {
  let content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : ''
  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}=${value}`
    const re = new RegExp(`^${key}=.*$`, 'm')
    if (re.test(content)) {
      content = content.replace(re, line)
    } else {
      content = content.trimEnd() + `\n${line}\n`
    }
  }
  fs.writeFileSync(ENV_PATH, content)
}

async function tableExists(admin, table) {
  const { error } = await admin.from(table).select('id').limit(1)
  if (!error) return true
  if (error.code === '42P01' || error.message?.includes('does not exist')) return false
  // Other errors might mean table exists but empty schema issue
  return !error.message?.includes('schema cache')
}

async function resolveOrganization(admin) {
  const preferred = process.env.SWITCH_DEFAULT_ORG_ID?.trim()
  if (preferred) {
    const { data } = await admin.from('organizations').select('id, name').eq('id', preferred).maybeSingle()
    if (data) return data
    console.warn('  SWITCH_DEFAULT_ORG_ID not found in DB, auto-detecting...')
  }

  const { data: dw } = await admin
    .from('organizations')
    .select('id, name')
    .or('name.ilike.%DW Growth%,slug.ilike.%dw-growth%,slug.ilike.%dwgrowth%')
    .limit(1)
    .maybeSingle()

  if (dw) return dw

  const { data: anyOrg } = await admin.from('organizations').select('id, name').limit(1).maybeSingle()
  return anyOrg
}

async function resolveActingUser(admin, orgId) {
  const preferred = process.env.SWITCH_ACTING_USER_ID?.trim()
  if (preferred) return preferred

  const { data: owner } = await admin
    .from('user_profiles')
    .select('id')
    .eq('organization_id', orgId)
    .in('role', ['owner', 'admin'])
    .limit(1)
    .maybeSingle()

  return owner?.id ?? null
}

async function main() {
  console.log('Katana Switch integration setup\n')

  if (!url || url.includes('your-project-ref')) {
    console.error('Set VITE_SUPABASE_URL in .env')
    process.exit(1)
  }
  if (!serviceKey) {
    console.error('Set SUPABASE_SERVICE_ROLE_KEY in .env')
    console.error('  Supabase Dashboard → Settings → API → service_role (secret)')
    process.exit(1)
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const migrationOk = await tableExists(admin, 'switch_oauth_clients')
  if (!migrationOk) {
    console.error('Switch tables not found.')
    console.error('Run supabase-switch-integration-migration.sql in Supabase SQL Editor, then re-run:')
    console.error('  npm run switch:setup')
    process.exit(1)
  }
  console.log('  Switch tables: OK')

  const org = await resolveOrganization(admin)
  if (!org) {
    console.error('No organization found. Create one in Katana or set SWITCH_DEFAULT_ORG_ID.')
    process.exit(1)
  }
  console.log(`  Organization: ${org.name} (${org.id})`)

  const actingUserId = await resolveActingUser(admin, org.id)
  if (actingUserId) console.log(`  Acting user: ${actingUserId}`)
  else console.warn('  No owner/admin found — SWITCH_ACTING_USER_ID will be empty')

  const clientId = process.env.SWITCH_OAUTH_CLIENT_ID?.trim() || 'switch-dev'
  let clientSecret = process.env.SWITCH_OAUTH_CLIENT_SECRET?.trim()
  if (!clientSecret) {
    clientSecret = generateSecret()
    console.log('  Generated new SWITCH_OAUTH_CLIENT_SECRET')
  }

  const katanaBase =
    process.env.KATANA_API_BASE_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3001')

  const { data: existing } = await admin
    .from('switch_oauth_clients')
    .select('id')
    .eq('client_id', clientId)
    .maybeSingle()

  const clientRow = {
    client_id: clientId,
    client_secret_hash: hashSecret(clientSecret),
    name: 'Switch Integration',
    organization_id: org.id,
    acting_user_id: actingUserId,
    is_active: true,
    updated_at: new Date().toISOString(),
  }

  if (existing?.id) {
    const { error } = await admin.from('switch_oauth_clients').update(clientRow).eq('id', existing.id)
    if (error) throw error
    console.log('  Updated OAuth client:', clientId)
  } else {
    const { error } = await admin.from('switch_oauth_clients').insert(clientRow)
    if (error) throw error
    console.log('  Created OAuth client:', clientId)
  }

  upsertEnv({
    SWITCH_OAUTH_CLIENT_ID: clientId,
    SWITCH_OAUTH_CLIENT_SECRET: clientSecret,
    SWITCH_DEFAULT_ORG_ID: org.id,
    ...(actingUserId ? { SWITCH_ACTING_USER_ID: actingUserId } : {}),
    KATANA_API_BASE_URL: katanaBase,
    SUPABASE_SERVICE_ROLE_KEY: serviceKey,
  })

  console.log('\n' + '='.repeat(60))
  console.log('SWITCH HANDOFF — send these to the Switch team')
  console.log('='.repeat(60))
  console.log(`
KATANA_API_BASE_URL (dev):  http://localhost:3001
KATANA_API_BASE_URL (prod): https://katana-vv2.vercel.app

OAuth token endpoint:       POST {KATANA_API_BASE_URL}/switch/oauth/token
Grant type:                 client_credentials

client_id:                  ${clientId}
client_secret:              ${clientSecret}

Target organization_id:     ${org.id}
Acting user_id:             ${actingUserId ?? '(none — optional)'}

Ingest endpoints:
  POST /switch/ingest/files
  POST /switch/ingest/records
  GET  /switch/schema

Callback URLs:              N/A (client credentials — no browser redirect)

File source types:          signed_url | public_url | webhook
Docs:                       docs/SWITCH_INTEGRATION.md
`)
  console.log('='.repeat(60))
  console.log('\nDone. .env updated. Restart npm run dev if running.')
  console.log('For Vercel prod: add the same env vars in Project → Settings → Environment Variables.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
