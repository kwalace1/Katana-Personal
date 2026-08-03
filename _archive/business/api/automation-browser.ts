/**
 * POST /api/automation-browser — run Automation browser tools (fetch/extract/screenshot/download).
 */

import { runAutomationBrowserTool, type AutomationBrowserRequest } from '../src/lib/automation-browser'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''

async function authenticate(req: Request): Promise<boolean> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return false
  const token = authHeader.slice(7)
  if (!token || !SUPABASE_URL) return false

  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
  })
  return res.ok
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() })
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders() })
  }

  const ok = await authenticate(req)
  if (!ok) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers: corsHeaders() })
  }

  const tool = String(body.tool || '')
  const url = String(body.url || '').trim()
  if (!tool || !url) {
    return Response.json(
      { error: 'tool and url are required' },
      { status: 400, headers: corsHeaders() },
    )
  }

  const request: AutomationBrowserRequest = {
    tool: tool as AutomationBrowserRequest['tool'],
    url,
    selector: body.selector ? String(body.selector) : undefined,
    timeoutMs: typeof body.timeoutMs === 'number' ? body.timeoutMs : undefined,
    viewportWidth: typeof body.viewportWidth === 'number' ? body.viewportWidth : undefined,
    viewportHeight: typeof body.viewportHeight === 'number' ? body.viewportHeight : undefined,
    formData:
      body.formData && typeof body.formData === 'object' && !Array.isArray(body.formData)
        ? Object.fromEntries(
            Object.entries(body.formData as Record<string, unknown>).map(([k, v]) => [
              k,
              String(v ?? ''),
            ]),
          )
        : undefined,
    clickSequence: Array.isArray(body.clickSequence)
      ? body.clickSequence.map((s) => String(s)).filter(Boolean)
      : undefined,
  }

  const result = await runAutomationBrowserTool(request)
  return Response.json(result, {
    status: result.ok ? 200 : 422,
    headers: corsHeaders(),
  })
}
