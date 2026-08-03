#!/usr/bin/env node
/**
 * Seed a local dev user in Supabase (auth + org + profile + HR employee).
 *
 * Prerequisites:
 *   - .env with VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   - VITE_DEV_EMAIL (default dev@localhost), VITE_DEV_PASSWORD
 *
 * Usage: npm run dev:seed
 */
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = (process.env.VITE_DEV_EMAIL || 'dev@localhost').trim().toLowerCase()
const password = process.env.VITE_DEV_PASSWORD || 'DevLocal123!'
const fullName = process.env.VITE_DEV_FULL_NAME || 'Dev User'

const ALL_MODULES = [
  'hub', 'projects', 'inventory', 'customer-success', 'workforce',
  'hr', 'employee', 'careers', 'manufacturing', 'automation', 'kyi', 'comms',
]

if (!url || url.includes('your-project-ref')) {
  console.error('Set VITE_SUPABASE_URL in .env to your Supabase project URL.')
  process.exit(1)
}
if (!serviceKey) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY in .env (Supabase → Settings → API → service_role).')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function findUserByEmail(targetEmail) {
  let page = 1
  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const match = data.users.find((u) => u.email?.toLowerCase() === targetEmail)
    if (match) return match
    if (data.users.length < 200) break
    page++
  }
  return null
}

async function main() {
  console.log('Seeding dev user:', email)

  let user = await findUserByEmail(email)
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
    if (error) throw error
    user = data.user
    console.log('  Created auth user:', user.id)
  } else {
    console.log('  Auth user exists:', user.id)
    const { error } = await admin.auth.admin.updateUserById(user.id, { password })
    if (error) console.warn('  Could not update password:', error.message)
  }

  const userId = user.id

  let orgId
  const { data: existingProfile } = await admin
    .from('user_profiles')
    .select('organization_id')
    .eq('id', userId)
    .maybeSingle()

  if (existingProfile?.organization_id) {
    orgId = existingProfile.organization_id
    console.log('  Using existing organization:', orgId)
  } else {
    const { data: org, error: orgErr } = await admin
      .from('organizations')
      .insert({
        name: 'Local Dev Organization',
        slug: `local-dev-${userId.slice(0, 8)}`,
        domain: 'localhost',
        subscription_tier: 'enterprise',
        subscription_status: 'active',
        max_users: 999,
        settings: { onboarding_completed: true, industry: 'Technology', company_size: '1-10' },
      })
      .select('id')
      .single()
    if (orgErr) throw orgErr
    orgId = org.id
    console.log('  Created organization:', orgId)
  }

  const { error: profileErr } = await admin.from('user_profiles').upsert(
    {
      id: userId,
      organization_id: orgId,
      email,
      full_name: fullName,
      role: 'owner',
      department: 'Engineering',
      job_title: 'Developer',
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  )
  if (profileErr) throw profileErr
  console.log('  Upserted user_profiles')

  const hireDate = new Date().toISOString().slice(0, 10)
  const employeeRow = {
    name: fullName,
    email,
    position: 'Developer',
    department: 'Engineering',
    status: 'Active',
    hire_date: hireDate,
    module_access: ALL_MODULES,
    user_id: userId,
    organization_id: orgId,
  }

  const { data: existingEmp } = await admin
    .from('hr_employees')
    .select('id')
    .ilike('email', email)
    .maybeSingle()

  if (existingEmp?.id) {
    const { error } = await admin.from('hr_employees').update(employeeRow).eq('id', existingEmp.id)
    if (error) throw error
    console.log('  Updated hr_employees:', existingEmp.id)
  } else {
    const { data: emp, error } = await admin.from('hr_employees').insert(employeeRow).select('id').single()
    if (error) {
      const { organization_id: _o, module_access: _m, ...minimal } = employeeRow
      const { data: emp2, error: err2 } = await admin
        .from('hr_employees')
        .insert(minimal)
        .select('id')
        .single()
      if (err2) throw err2
      console.log('  Created hr_employees (minimal columns):', emp2.id)
      console.warn('  Tip: run supabase-user-isolation-migration.sql if organization_id/module_access are missing.')
    } else {
      console.log('  Created hr_employees:', emp.id)
    }
  }

  console.log('\nDone. In .env set:')
  console.log('  VITE_DEV_EMAIL=' + email)
  console.log('  VITE_DEV_PASSWORD=' + password)
  console.log('  VITE_DEV_AUTH_BYPASS=true')
  console.log('\nRestart npm run dev, click "Continue without sign-in (dev)".')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
