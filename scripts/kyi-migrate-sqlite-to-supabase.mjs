#!/usr/bin/env node
/**
 * KYI SQLite -> Supabase migration script.
 *
 * This is a one-off helper to copy existing KYI data from the legacy
 * Flask/SQLite database into the new Supabase KYI tables defined in
 * `supabase-kyi-schema.sql`.
 *
 * Usage (from katana root):
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   KYI_SQLITE_PATH=../KYI/kyi.db \
 *   node scripts/kyi-migrate-sqlite-to-supabase.mjs
 *
 * Notes:
 * - Requires `better-sqlite3` and `@supabase/supabase-js` (already in package).
 * - This script is intentionally conservative: it only inserts if tables are empty.
 * - It migrates:
 *   - companies           -> kyi_companies
 *   - investors           -> kyi_investors
 *   - client_geo_settings -> kyi_client_geo_settings
 *   - investor_leads      -> kyi_investor_leads
 *   - lead_profile_intel  -> kyi_lead_profile_intel
 */

import Database from 'better-sqlite3'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
const sqlitePath = process.env.KYI_SQLITE_PATH || '../KYI/kyi.db'

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to run migration.')
  process.exit(1)
}

console.log('🔄 Starting KYI migration')
console.log('  SQLite DB:', sqlitePath)
console.log('  Supabase URL:', supabaseUrl)

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
})

function run() {
  const db = new Database(sqlitePath, { readonly: true })

  // Helper to check if a Supabase table already has rows
  async function tableHasRows(table) {
    const { data, error } = await supabase.from(table).select('id').limit(1)
    if (error) {
      console.error(`❌ Supabase error checking table ${table}:`, error.message)
      throw error
    }
    return Array.isArray(data) && data.length > 0
  }

  async function migrateCompanies() {
    if (await tableHasRows('kyi_companies')) {
      console.log('✅ kyi_companies already has data; skipping companies migration')
      return
    }

    console.log('📦 Migrating companies -> kyi_companies')
    const rows = db
      .prepare(
        'SELECT id, name, location, industry, website, description, created_at FROM companies ORDER BY id',
      )
      .all()

    if (rows.length === 0) {
      console.log('ℹ️ No companies found in SQLite')
      return
    }

    const payload = rows.map((r) => ({
      id: r.id,
      name: r.name,
      location: r.location || null,
      industry: r.industry || null,
      website: r.website || null,
      description: r.description || null,
      created_at: r.created_at || new Date().toISOString(),
    }))

    const { error } = await supabase.from('kyi_companies').insert(payload)
    if (error) {
      console.error('❌ Failed to insert companies into Supabase:', error.message)
      throw error
    }
    console.log(`✅ Migrated ${rows.length} companies`)
  }

  async function migrateInvestors() {
    if (await tableHasRows('kyi_investors')) {
      console.log('✅ kyi_investors already has data; skipping investors migration')
      return
    }

    console.log('📦 Migrating investors -> kyi_investors')
    const rows = db
      .prepare(
        `SELECT id, company_id, full_name, email, phone, location, industry,
                firm, title, profile_url, notes, created_at, updated_at
           FROM investors
           ORDER BY id`,
      )
      .all()

    if (rows.length === 0) {
      console.log('ℹ️ No investors found in SQLite')
      return
    }

    const payload = rows.map((r) => ({
      id: r.id,
      company_id: r.company_id,
      full_name: r.full_name,
      email: r.email || null,
      phone: r.phone || null,
      location: r.location || null,
      industry: r.industry || null,
      firm: r.firm || null,
      title: r.title || null,
      profile_url: r.profile_url || null,
      notes: r.notes || null,
      created_at: r.created_at || new Date().toISOString(),
      updated_at: r.updated_at || r.created_at || new Date().toISOString(),
    }))

    const { error } = await supabase.from('kyi_investors').insert(payload)
    if (error) {
      console.error('❌ Failed to insert investors into Supabase:', error.message)
      throw error
    }
    console.log(`✅ Migrated ${rows.length} investors`)
  }

  async function migrateGeoSettings() {
    if (await tableHasRows('kyi_client_geo_settings')) {
      console.log('✅ kyi_client_geo_settings already has data; skipping geo settings migration')
      return
    }

    console.log('📦 Migrating client_geo_settings -> kyi_client_geo_settings')
    const rows = db
      .prepare(
        `SELECT id, client_id, location_label, center_lat, center_lng, radius_miles,
                bbox_min_lat, bbox_max_lat, bbox_min_lng, bbox_max_lng, updated_at
           FROM client_geo_settings
           ORDER BY id`,
      )
      .all()

    if (rows.length === 0) {
      console.log('ℹ️ No geo settings found in SQLite')
      return
    }

    const payload = rows.map((r) => ({
      id: r.id,
      client_id: r.client_id,
      location_label: r.location_label,
      center_lat: r.center_lat,
      center_lng: r.center_lng,
      radius_miles: r.radius_miles,
      bbox_min_lat: r.bbox_min_lat,
      bbox_max_lat: r.bbox_max_lat,
      bbox_min_lng: r.bbox_min_lng,
      bbox_max_lng: r.bbox_max_lng,
      updated_at: r.updated_at || new Date().toISOString(),
    }))

    const { error } = await supabase.from('kyi_client_geo_settings').insert(payload)
    if (error) {
      console.error('❌ Failed to insert geo settings into Supabase:', error.message)
      throw error
    }
    console.log(`✅ Migrated ${rows.length} geo settings rows`)
  }

  async function migrateLeads() {
    if (await tableHasRows('kyi_investor_leads')) {
      console.log('✅ kyi_investor_leads already has data; skipping leads migration')
      return
    }

    console.log('📦 Migrating investor_leads -> kyi_investor_leads')
    const rows = db
      .prepare(
        `SELECT id, client_id, entity_type, display_name, street_address, city, state, zip_code,
                country, lat, lng, sources, signals, raw_score, score_breakdown, tags,
                created_at, updated_at
           FROM investor_leads
           ORDER BY id`,
      )
      .all()

    if (rows.length === 0) {
      console.log('ℹ️ No leads found in SQLite')
      return
    }

    const payload = rows.map((r) => ({
      id: r.id,
      client_id: r.client_id,
      entity_type: r.entity_type,
      display_name: r.display_name,
      street_address: r.street_address || null,
      city: r.city || null,
      state: r.state || null,
      zip_code: r.zip_code || null,
      country: r.country || 'US',
      lat: r.lat,
      lng: r.lng,
      sources: r.sources ? JSON.parse(r.sources) : null,
      signals: r.signals ? JSON.parse(r.signals) : null,
      raw_score: r.raw_score || 0,
      score_breakdown: r.score_breakdown ? JSON.parse(r.score_breakdown) : null,
      tags: r.tags ? JSON.parse(r.tags) : null,
      created_at: r.created_at || new Date().toISOString(),
      updated_at: r.updated_at || r.created_at || new Date().toISOString(),
    }))

    const { error } = await supabase.from('kyi_investor_leads').insert(payload)
    if (error) {
      console.error('❌ Failed to insert leads into Supabase:', error.message)
      throw error
    }
    console.log(`✅ Migrated ${rows.length} leads`)
  }

  async function migrateLeadIntel() {
    if (await tableHasRows('kyi_lead_profile_intel')) {
      console.log('✅ kyi_lead_profile_intel already has data; skipping intel migration')
      return
    }

    console.log('📦 Migrating lead_profile_intel -> kyi_lead_profile_intel')
    const rows = db
      .prepare(
        `SELECT id, lead_id, client_id, investor_type, motivations,
                cares_about_most, decision_drivers, red_flags, green_flags,
                ideal_messaging_approach, example_outreach_angles, notes_next_steps,
                created_at, updated_at
           FROM lead_profile_intel
           ORDER BY id`,
      )
      .all()

    if (rows.length === 0) {
      console.log('ℹ️ No lead_profile_intel rows found in SQLite')
      return
    }

    const payload = rows.map((r) => ({
      id: r.id,
      lead_id: r.lead_id,
      client_id: r.client_id,
      investor_type: r.investor_type || null,
      motivations: r.motivations || null,
      cares_about_most: r.cares_about_most ? JSON.parse(r.cares_about_most) : null,
      decision_drivers: r.decision_drivers ? JSON.parse(r.decision_drivers) : null,
      red_flags: r.red_flags ? JSON.parse(r.red_flags) : null,
      green_flags: r.green_flags ? JSON.parse(r.green_flags) : null,
      ideal_messaging_approach: r.ideal_messaging_approach || null,
      example_outreach_angles: r.example_outreach_angles ? JSON.parse(r.example_outreach_angles) : null,
      notes_next_steps: r.notes_next_steps || null,
      created_at: r.created_at || new Date().toISOString(),
      updated_at: r.updated_at || r.created_at || new Date().toISOString(),
    }))

    const { error } = await supabase.from('kyi_lead_profile_intel').insert(payload)
    if (error) {
      console.error('❌ Failed to insert lead_profile_intel into Supabase:', error.message)
      throw error
    }
    console.log(`✅ Migrated ${rows.length} lead_profile_intel rows`)
  }

  ;(async () => {
    try {
      await migrateCompanies()
      await migrateInvestors()
      await migrateGeoSettings()
      await migrateLeads()
      await migrateLeadIntel()
      console.log('✅ KYI migration completed')
      process.exit(0)
    } catch (err) {
      console.error('❌ KYI migration failed:', err)
      process.exit(1)
    } finally {
      db.close()
    }
  })()
}

run()

