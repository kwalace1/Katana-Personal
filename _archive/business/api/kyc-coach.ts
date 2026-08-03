/**
 * KYC account coach API — POST /api/kyc-coach
 */

import { createClient } from '@supabase/supabase-js'
import {
  buildTemplateCoachResponse,
  type KycCoachResponse,
} from '../src/lib/kyc-account-coach'
import type { KycSummaryContext } from '../src/lib/kyc-client-summary'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const PROVIDERS = [
  { url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile', keyEnv: 'GROQ_API_KEY' },
  { url: 'https://api.cerebras.ai/v1/chat/completions', model: 'llama-3.3-70b', keyEnv: 'CEREBRAS_API_KEY' },
  { url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model: 'gemini-2.5-flash-lite', keyEnv: 'GEMINI_API_KEY' },
]

const SYSTEM_PROMPT = `You are a customer success coach for Katana. Return ONLY valid JSON with this shape:
{"recommended_action":"string","why":"string","cautions":["string"],"priority":"high"|"medium"|"low"}
Rules:
- Use ONLY facts from the provided account JSON.
- Do NOT invent revenue, ARR, or expansion dollar amounts.
- If expansion_likelihood is low, include a caution not to push upsell yet.
- Keep recommended_action to one short imperative phrase.`

async function authenticate(req: Request): Promise<boolean> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return false
  const token = authHeader.slice(7)
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
  })
  return res.ok
}

async function callCoachLlm(context: KycSummaryContext): Promise<KycCoachResponse | null> {
  const provider = PROVIDERS.map((p) => {
    const key = process.env[p.keyEnv]
    return key ? { ...p, key } : null
  }).find(Boolean)
  if (!provider) return null

  try {
    const res = await fetch(provider.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.key}`,
      },
      body: JSON.stringify({
        model: provider.model,
        temperature: 0.2,
        max_tokens: 300,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(context) },
        ],
      }),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const raw = json.choices?.[0]?.message?.content
    if (!raw) return null
    const parsed = JSON.parse(raw) as KycCoachResponse
    if (!parsed.recommended_action || !parsed.why) return null
    return {
      recommended_action: parsed.recommended_action,
      why: parsed.why,
      cautions: Array.isArray(parsed.cautions) ? parsed.cautions : [],
      priority: parsed.priority ?? 'medium',
    }
  } catch {
    return null
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

  if (!(await authenticate(req))) {
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
  const template = buildTemplateCoachResponse(context)
  let response = template
  let source: 'template' | 'ai' = 'template'

  const ai = await callCoachLlm(context)
  if (ai) {
    response = ai
    source = 'ai'
  }

  const generatedAt = new Date().toISOString()

  if (clientId && SUPABASE_URL && SERVICE_KEY && contextHash) {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY)
    await admin.from('cs_client_intel').upsert(
      {
        client_id: clientId,
        coach_response: JSON.stringify(response),
        coach_generated_at: generatedAt,
        coach_context_hash: contextHash,
        updated_at: generatedAt,
      },
      { onConflict: 'client_id' },
    )
  }

  return Response.json({
    response,
    source,
    generated_at: generatedAt,
    persisted: Boolean(clientId && SERVICE_KEY),
  })
}
