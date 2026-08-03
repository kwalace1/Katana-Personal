/**
 * KYC executive summary API — POST /api/kyc-summary
 * Generates a short account summary grounded in provided intel JSON only.
 */

import { createClient } from '@supabase/supabase-js'
import {
  buildTemplateClientSummary,
  type KycSummaryContext,
} from '../src/lib/kyc-client-summary'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const PROVIDERS = [
  {
    name: 'groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    keyEnv: 'GROQ_API_KEY',
  },
  {
    name: 'cerebras',
    url: 'https://api.cerebras.ai/v1/chat/completions',
    model: 'llama-3.3-70b',
    keyEnv: 'CEREBRAS_API_KEY',
  },
  {
    name: 'gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model: 'gemini-2.5-flash-lite',
    keyEnv: 'GEMINI_API_KEY',
  },
  {
    name: 'mistral',
    url: 'https://api.mistral.ai/v1/chat/completions',
    model: 'mistral-small-latest',
    keyEnv: 'MISTRAL_API_KEY',
  },
]

const SYSTEM_PROMPT = `You write short customer success executive summaries for Katana.
Rules:
- Use ONLY facts present in the provided JSON context.
- Write 2-4 sentences in plain prose. No bullet points, no markdown.
- Do NOT invent revenue, ARR, expansion dollar amounts, or facts not in the context.
- Mention health/status, key risks or positives, and the recommended next action when available.
- If expansion likelihood is low, say not to push upsell yet when adoption is weak.`

async function authenticate(req: Request): Promise<{ userId: string; token: string } | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  if (!token || !SUPABASE_URL) return null

  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
  })
  if (!res.ok) return null
  const user = await res.json()
  if (!user?.id) return null
  return { userId: user.id, token }
}

async function callSummaryLlm(context: KycSummaryContext): Promise<string | null> {
  const provider = PROVIDERS.map((p) => {
    const key = process.env[p.keyEnv]
    return key ? { ...p, key } : null
  }).find(Boolean)

  if (!provider) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  try {
    const res = await fetch(provider.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.key}`,
      },
      body: JSON.stringify({
        model: provider.model,
        temperature: 0.3,
        max_tokens: 220,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Write the executive summary for this account:\n${JSON.stringify(context, null, 2)}`,
          },
        ],
      }),
      signal: controller.signal,
    })
    if (!res.ok) return null
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const text = json.choices?.[0]?.message?.content?.trim()
    return text || null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const auth = await authenticate(req)
  if (!auth) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const context = body.context as KycSummaryContext | undefined
  if (!context?.client_name) {
    return Response.json({ error: 'context with client_name is required' }, { status: 400 })
  }

  const clientId = body.client_id ? String(body.client_id) : null
  const contextHash = body.context_hash ? String(body.context_hash) : null
  const preferAi = body.prefer_ai !== false

  const templateSummary = buildTemplateClientSummary(context)
  let summary = templateSummary
  let source: 'template' | 'ai' = 'template'

  if (preferAi) {
    const aiSummary = await callSummaryLlm(context)
    if (aiSummary) {
      summary = aiSummary
      source = 'ai'
    }
  }

  const generatedAt = new Date().toISOString()

  if (clientId && SUPABASE_URL && SERVICE_KEY && contextHash) {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY)
    await admin
      .from('cs_client_intel')
      .upsert(
        {
          client_id: clientId,
          ai_summary: summary,
          summary_generated_at: generatedAt,
          summary_context_hash: contextHash,
          updated_at: generatedAt,
        },
        { onConflict: 'client_id' },
      )
  }

  return Response.json({
    summary,
    source,
    generated_at: generatedAt,
    persisted: Boolean(clientId && SERVICE_KEY),
  })
}
