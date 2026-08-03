/**
 * Audit trail when authenticated users open a job posting (internal / careers detail).
 */

import { supabase } from '@/lib/supabase'

export async function logJobListingView(jobId: string): Promise<void> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user?.id) return
    const { error } = await supabase.from('job_listing_access_log').insert({
      job_id: jobId,
      user_id: session.user.id,
    })
    if (error && !error.message?.includes('does not exist')) {
      console.warn('job_listing_access_log insert:', error.message)
    }
  } catch {
    /* non-fatal */
  }
}
