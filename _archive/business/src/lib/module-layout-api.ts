/**
 * Supabase-backed per-user module layout persistence.
 * Falls back to / syncs with localStorage cache for snappy UX.
 * Stores arbitrary layout jsonb (v1 sections or v2 widgets).
 */

import { supabase } from './supabase'
import { getCurrentUserId } from './auth-helpers'
import { readLayoutCache, writeLayoutCache } from './module-layout'

export async function loadModuleLayout(
  moduleId: string,
  surfaceId: string
): Promise<unknown | null> {
  const cached = readLayoutCache(moduleId, surfaceId)
  let remote: unknown | null = null

  try {
    const userId = await getCurrentUserId()
    const { data, error } = await supabase
      .from('user_module_layouts')
      .select('layout')
      .eq('user_id', userId)
      .eq('module_id', moduleId)
      .eq('surface_id', surfaceId)
      .maybeSingle()

    if (error) {
      console.error('[module-layout-api] load error:', error)
    } else if (data?.layout && typeof data.layout === 'object') {
      remote = data.layout
      writeLayoutCache(moduleId, surfaceId, remote)
    }
  } catch (err) {
    console.error('[module-layout-api] load failed:', err)
  }

  if (remote) return remote
  if (cached && typeof cached === 'object') return cached
  return null
}

export async function saveModuleLayout(
  moduleId: string,
  surfaceId: string,
  layout: unknown
): Promise<boolean> {
  writeLayoutCache(moduleId, surfaceId, layout)

  try {
    const userId = await getCurrentUserId()
    const { error } = await supabase.from('user_module_layouts').upsert(
      {
        user_id: userId,
        module_id: moduleId,
        surface_id: surfaceId,
        layout,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,module_id,surface_id' }
    )
    if (error) {
      console.error('[module-layout-api] save error:', error)
      return false
    }
    return true
  } catch (err) {
    console.error('[module-layout-api] save failed:', err)
    return false
  }
}
