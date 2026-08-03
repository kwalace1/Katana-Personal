import type { SupabaseClient } from '@supabase/supabase-js'

type IngestJobType = 'files' | 'records'

/** Resolve or create a Katana ingest job. Unknown client job_id values are ignored. */
export async function resolveSwitchIngestJobId(
  admin: SupabaseClient,
  input: {
    organizationId: string
    clientRef: string
    requestedJobId: string | null
    sourceSystem: string | null
    jobType: IngestJobType
  },
): Promise<{ jobId: string } | { error: string }> {
  let jobId = input.requestedJobId

  if (jobId) {
    const { data: existing } = await admin
      .from('switch_ingest_jobs')
      .select('id')
      .eq('id', jobId)
      .eq('organization_id', input.organizationId)
      .maybeSingle()

    if (!existing) jobId = null
  }

  if (!jobId) {
    const { data: job, error: jobErr } = await admin
      .from('switch_ingest_jobs')
      .insert({
        organization_id: input.organizationId,
        client_ref: input.clientRef !== 'env-client' ? input.clientRef : null,
        job_type: input.jobType,
        status: 'processing',
        source_system: input.sourceSystem,
      })
      .select('id')
      .single()

    if (jobErr || !job) {
      return { error: 'Failed to create ingest job' }
    }
    jobId = job.id as string
  }

  return { jobId }
}
