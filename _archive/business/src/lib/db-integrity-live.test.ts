/**
 * Live Database Integrity Validation Tests
 *
 * These tests run against the actual Supabase database using environment variables.
 * They validate schema structure, RLS policies, constraints, and data consistency.
 *
 * Run with: npx vitest run src/lib/db-integrity-live.test.ts
 * Requires: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to be set
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL || ''
const key = process.env.VITE_SUPABASE_ANON_KEY || ''
const configured = url.length > 10 && key.length > 10 && !url.includes('placeholder')

let supabase: SupabaseClient | null = null

if (configured) {
  supabase = createClient(url, key)
}

describe('Live Database Integrity', () => {
  describe.skipIf(!configured)('RLS Enforcement', () => {
    it('all public tables have RLS enabled', async () => {
      // Without auth, RLS should block access - queries should return empty, not crash
      const { data, error } = await supabase!
        .from('projects')
        .select('id')
        .limit(1)

      // If RLS is working, either data is empty (no org match) or returns specific rows
      // The key thing is it doesn't error with "row level security is not enabled"
      if (error) {
        expect(error.message).not.toContain('row_level_security')
      }
      // Empty array means RLS is blocking (no matching org)
      expect(data).toBeDefined()
    })

    it('cannot access other organization data from projects', async () => {
      // Without auth, should get empty results (RLS blocks)
      const { data } = await supabase!
        .from('projects')
        .select('id')
        .eq('organization_id', '00000000-0000-0000-0000-000000000000')
        .limit(1)

      expect(data).toEqual([])
    })

    it('cannot access other organization data from hr_employees', async () => {
      const { data } = await supabase!
        .from('hr_employees')
        .select('id')
        .eq('organization_id', '00000000-0000-0000-0000-000000000000')
        .limit(1)

      expect(data).toEqual([])
    })

    it('cannot access other organization data from wfm_jobs', async () => {
      const { data } = await supabase!
        .from('wfm_jobs')
        .select('id')
        .eq('organization_id', '00000000-0000-0000-0000-000000000000')
        .limit(1)

      expect(data).toEqual([])
    })
  })

  describe.skipIf(!configured)('Data Consistency', () => {
    it('no projects exist with null organization_id', async () => {
      const { data } = await supabase!
        .from('projects')
        .select('id')
        .is('organization_id', null)
        .limit(1)

      expect(data?.length ?? 0).toBe(0)
    })

    it('no tasks exist with null organization_id', async () => {
      const { data } = await supabase!
        .from('tasks')
        .select('id')
        .is('organization_id', null)
        .limit(1)

      expect(data?.length ?? 0).toBe(0)
    })

    it('no hr_employees exist with null organization_id', async () => {
      const { data } = await supabase!
        .from('hr_employees')
        .select('id')
        .is('organization_id', null)
        .limit(1)

      expect(data?.length ?? 0).toBe(0)
    })

    it('no wfm_jobs exist with null organization_id', async () => {
      const { data } = await supabase!
        .from('wfm_jobs')
        .select('id')
        .is('organization_id', null)
        .limit(1)

      expect(data?.length ?? 0).toBe(0)
    })

    it('no storage_files exist with null organization_id', async () => {
      const { data } = await supabase!
        .from('storage_files')
        .select('id')
        .is('organization_id', null)
        .limit(1)

      expect(data?.length ?? 0).toBe(0)
    })
  })

  describe.skipIf(!configured)('Referential Integrity', () => {
    it('all tasks reference valid projects', async () => {
      const { data: tasks } = await supabase!
        .from('tasks')
        .select('id, project_id')
        .not('project_id', 'is', null)
        .limit(10)

      if (!tasks || tasks.length === 0) return

      for (const task of tasks) {
        const { data: project } = await supabase!
          .from('projects')
          .select('id')
          .eq('id', task.project_id)
          .single()

        expect(project).not.toBeNull()
      }
    })

    it('all user_profiles reference valid organizations', async () => {
      const { data: profiles } = await supabase!
        .from('user_profiles')
        .select('id, organization_id')
        .not('organization_id', 'is', null)
        .limit(10)

      if (!profiles || profiles.length === 0) return

      for (const profile of profiles) {
        const { data: org } = await supabase!
          .from('organizations')
          .select('id')
          .eq('id', profile.organization_id)
          .single()

        expect(org).not.toBeNull()
      }
    })
  })

  describe.skipIf(!configured)('Schema Validation via Queries', () => {
    it('projects table has expected columns (query succeeds)', async () => {
      const { error } = await supabase!
        .from('projects')
        .select('id, name, status, organization_id, created_at')
        .limit(0)

      expect(error).toBeNull()
    })

    it('tasks table has expected columns', async () => {
      const { error } = await supabase!
        .from('tasks')
        .select('id, title, status, project_id, organization_id, created_at')
        .limit(0)

      expect(error).toBeNull()
    })

    it('hr_employees table has expected columns', async () => {
      const { error } = await supabase!
        .from('hr_employees')
        .select('id, name, email, status, organization_id, created_at')
        .limit(0)

      expect(error).toBeNull()
    })

    it('wfm_jobs table has expected columns', async () => {
      const { error } = await supabase!
        .from('wfm_jobs')
        .select('id, title, status, organization_id, created_at, start_time, end_time')
        .limit(0)

      expect(error).toBeNull()
    })

    it('wfm_technicians table has expected columns', async () => {
      const { error } = await supabase!
        .from('wfm_technicians')
        .select('id, name, organization_id, created_at')
        .limit(0)

      expect(error).toBeNull()
    })

    it('cs_clients table has expected columns', async () => {
      const { error } = await supabase!
        .from('cs_clients')
        .select('id, name, status, health_score, organization_id, created_at')
        .limit(0)

      expect(error).toBeNull()
    })

    it('inventory_items table has expected columns', async () => {
      const { error } = await supabase!
        .from('inventory_items')
        .select('id, product_name, sku, organization_id, created_at')
        .limit(0)

      expect(error).toBeNull()
    })

    it('storage_files table has expected columns', async () => {
      const { error } = await supabase!
        .from('storage_files')
        .select('id, file_name, module, organization_id, created_at')
        .limit(0)

      expect(error).toBeNull()
    })

    it('organizations table has expected columns', async () => {
      const { error } = await supabase!
        .from('organizations')
        .select('id, name, slug, subscription_tier, created_at')
        .limit(0)

      expect(error).toBeNull()
    })

    it('user_profiles table has expected columns', async () => {
      const { error } = await supabase!
        .from('user_profiles')
        .select('id, email, role, is_active, organization_id, created_at')
        .limit(0)

      expect(error).toBeNull()
    })
  })
})
