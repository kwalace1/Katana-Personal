#!/usr/bin/env npx tsx
/**
 * Batch KYC external enrichment for all customer accounts.
 * Usage: npm run kyc:enrich
 */
import { createClient } from '@supabase/supabase-js'
import { enrichCompanyFromPublicSources } from '../src/lib/kyc-enrichment'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const LIMIT = Number(process.env.KYC_ENRICH_LIMIT || 50)
const DELAY_MS = Number(process.env.KYC_ENRICH_DELAY_MS || 2500)

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
  const { data: clients, error } = await supabase
    .from('cs_clients')
    .select('id, name, state, country, lifecycle_stage')
    .or('lifecycle_stage.eq.customer,lifecycle_stage.is.null')
    .order('updated_at', { ascending: true })
    .limit(LIMIT)

  if (error) {
    console.error('Failed to load clients:', error.message)
    process.exit(1)
  }

  console.log(`Enriching ${clients?.length ?? 0} customer accounts…`)

  let ok = 0
  let partial = 0
  let failed = 0

  for (const client of clients ?? []) {
    const name = String(client.name ?? '').trim()
    if (!name) continue

    try {
      const result = await enrichCompanyFromPublicSources({
        name,
        state: client.state as string | null,
        country: client.country as string | null,
      })
      const now = new Date().toISOString()
      const signalCount = Object.values(result.external_signals).filter((v) => v === true).length

      await supabase
        .from('cs_clients')
        .update({
          external_signals: result.external_signals,
          external_enrichment: result.enrichment,
          last_external_refresh_at: now,
          updated_at: now,
        })
        .eq('id', client.id)

      await supabase.from('cs_kyc_enrichment_log').insert({
        client_id: client.id,
        source: 'batch',
        status: result.payload.errors.length > 0 ? 'partial' : 'success',
        signal_count: signalCount,
        error_message: result.payload.errors.length > 0 ? result.payload.errors.join('; ') : null,
      })

      if (result.payload.errors.length > 0) partial++
      else ok++
      console.log(`  ✓ ${name} (${signalCount} signals)`)
    } catch (e) {
      failed++
      console.warn(`  ✗ ${name}:`, e instanceof Error ? e.message : e)
      await supabase.from('cs_kyc_enrichment_log').insert({
        client_id: client.id,
        source: 'batch',
        status: 'failed',
        signal_count: 0,
        error_message: e instanceof Error ? e.message : 'Unknown error',
      })
    }

    await sleep(DELAY_MS)
  }

  console.log(`Done. success=${ok} partial=${partial} failed=${failed}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
