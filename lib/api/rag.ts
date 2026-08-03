/**
 * Optional RAG: embed query → match_rag_documents (system knowledge only, see supabase-rag-schema.sql).
 * Uses Mistral embeddings (1024 dims). Skips silently if key missing, RPC missing, or no rows.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

const MISTRAL_EMBED_URL = 'https://api.mistral.ai/v1/embeddings'
const EMBED_MODEL = 'mistral-embed'
const EXPECTED_DIM = 1024

type MatchRow = {
  id: number
  content: string
  metadata?: Record<string, unknown>
  source_path: string
  source_type: string
  similarity?: number
}

export async function embedQueryMistral(text: string, apiKey: string): Promise<number[] | null> {
  const input = text.trim().slice(0, 8000)
  if (!input) return null
  try {
    const res = await fetch(MISTRAL_EMBED_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBED_MODEL,
        input: input,
      }),
    })
    if (!res.ok) return null
    const json = (await res.json()) as {
      data?: { embedding?: number[] }[]
      error?: { message?: string }
    }
    const emb = json.data?.[0]?.embedding
    if (!emb?.length || emb.length !== EXPECTED_DIM) return null
    return emb
  } catch {
    return null
  }
}

/** Returns a plain-text block to append to the system prompt, or null if RAG is unavailable or empty. */
export async function retrieveRagContextBlock(
  supabase: SupabaseClient,
  query: string,
  mistralApiKey: string | undefined,
): Promise<string | null> {
  const ragDisabled =
    process.env.KSYNC_RAG_DISABLED === '1' ||
    process.env.KSYNC_RAG_DISABLED === 'true' ||
    process.env.KATANABOT_RAG_DISABLED === '1' ||
    process.env.KATANABOT_RAG_DISABLED === 'true'
  if (ragDisabled) {
    return null
  }
  const key = mistralApiKey?.trim()
  if (!key) return null

  const embedding = await embedQueryMistral(query, key)
  if (!embedding) return null

  const { data, error } = await supabase.rpc('match_rag_documents', {
    query_embedding: embedding,
    match_threshold: 0.22,
    match_count: 6,
  })

  if (error) return null
  const rows = (data ?? []) as MatchRow[]
  if (!Array.isArray(rows) || rows.length === 0) return null

  const parts = rows.map((row, i) => {
    let meta = ''
    if (row.metadata && Object.keys(row.metadata).length) {
      const s = JSON.stringify(row.metadata)
      meta = s.length > 200 ? ` ${s.slice(0, 200)}…` : ` ${s}`
    }
    const sim =
      typeof row.similarity === 'number' ? ` (relevance ${Math.round(row.similarity * 100)}%)` : ''
    return `--- Excerpt ${i + 1}${sim}\nSource: ${row.source_path} [${row.source_type}]${meta}\n${row.content.trim()}`
  })

  return parts.join('\n\n')
}
