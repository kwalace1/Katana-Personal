#!/usr/bin/env node
/**
 * Migrate KYI data from Zenith (cgpyicouyovixfsovfre) to Katana V2 (uhvmhzmxsvrkzqqesbli).
 * Uses the PostgREST API directly (no npm packages needed).
 *
 * Usage:  node scripts/kyi-migrate-zenith-to-katana.mjs
 */

const ZENITH_URL = 'https://cgpyicouyovixfsovfre.supabase.co'
const ZENITH_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNncHlpY291eW92aXhmc292ZnJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2ODA1MjAsImV4cCI6MjA3NzI1NjUyMH0.5QHjKNkK59Dz-vRFiPNjEtr4Sp5_N4LtEyjLvGoPsUE'

const KATANA_URL = 'https://uhvmhzmxsvrkzqqesbli.supabase.co'
const KATANA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVodm1oem14c3Zya3pxcWVzYmxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NTAxNTksImV4cCI6MjA4NjQyNjE1OX0.XYe7rxZpkrAIBT3iFk3yYgQFUo2HRIeBYPkzgFB0_2s'

const BATCH = 500

async function restGet(baseUrl, apiKey, table, offset = 0, limit = BATCH) {
  const url = `${baseUrl}/rest/v1/${table}?select=*&offset=${offset}&limit=${limit}`
  const res = await fetch(url, {
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GET ${table} (${res.status}): ${body}`)
  }
  return res.json()
}

async function fetchAll(baseUrl, apiKey, table) {
  const all = []
  let offset = 0
  while (true) {
    const batch = await restGet(baseUrl, apiKey, table, offset, BATCH)
    all.push(...batch)
    if (batch.length < BATCH) break
    offset += BATCH
  }
  return all
}

async function restDelete(baseUrl, apiKey, table) {
  const url = `${baseUrl}/rest/v1/${table}?id=gt.0`
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`DELETE ${table} (${res.status}): ${body}`)
  }
}

async function restInsert(baseUrl, apiKey, table, rows) {
  if (rows.length === 0) return 0
  let inserted = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const url = `${baseUrl}/rest/v1/${table}`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(batch),
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`INSERT ${table} batch@${i} (${res.status}): ${body}`)
    }
    inserted += batch.length
    if (rows.length > BATCH) {
      process.stdout.write(`  inserted ${inserted}/${rows.length}\r`)
    }
  }
  return inserted
}

async function migrateTable(table) {
  console.log(`\n--- ${table} ---`)

  const rows = await fetchAll(ZENITH_URL, ZENITH_KEY, table)
  console.log(`  Zenith: ${rows.length} rows`)
  if (rows.length === 0) {
    console.log('  Skipping (empty)')
    return
  }

  console.log('  Clearing Katana V2...')
  try {
    await restDelete(KATANA_URL, KATANA_KEY, table)
  } catch (e) {
    console.log(`  Warning clearing: ${e.message}`)
  }

  console.log('  Inserting into Katana V2...')
  const count = await restInsert(KATANA_URL, KATANA_KEY, table, rows)
  console.log(`  Done: ${count} rows inserted`)
}

async function main() {
  console.log('=== KYI Data Migration: Zenith -> Katana V2 ===\n')

  const tables = [
    'kyi_companies',
    'kyi_investors',
    'kyi_client_geo_settings',
    'kyi_investor_geo_settings',
    'kyi_investor_type_profiles',
    'kyi_investor_leads',
  ]

  // Only re-run the tables that failed in the first pass
  const retryOnly = process.argv.includes('--retry')
  const retryTables = ['kyi_investors', 'kyi_investor_geo_settings', 'kyi_investor_type_profiles']
  const toMigrate = retryOnly ? tables.filter(t => retryTables.includes(t)) : tables

  for (const table of toMigrate) {
    try {
      await migrateTable(table)
    } catch (e) {
      console.error(`  ERROR on ${table}: ${e.message}`)
    }
  }

  console.log('\n=== Migration complete ===')
}

main().catch(console.error)
