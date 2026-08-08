/**
 * Meal photo → macro estimate via OpenRouter (Gemini Flash vision).
 */

import { DEFAULT_OPENROUTER_MODEL } from './ask-llm-core'

export type MealEstimate = {
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  estimatedGrams?: number
  confidence?: 'low' | 'medium' | 'high'
  note?: string
}

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  })
}

function num(n: unknown, fallback = 0): number {
  const v = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(v) ? v : fallback
}

function clampNonNeg(n: number) {
  return Math.max(0, n)
}

function parseEstimate(text: string): MealEstimate | null {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(cleaned) as Record<string, unknown>
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      raw = JSON.parse(match[0]) as Record<string, unknown>
    } catch {
      return null
    }
  }
  const name = String(raw.name || raw.meal || '').trim()
  if (!name) return null
  const calories = clampNonNeg(Math.round(num(raw.calories)))
  const protein = clampNonNeg(Math.round(num(raw.protein) * 10) / 10)
  const carbs = clampNonNeg(Math.round(num(raw.carbs) * 10) / 10)
  const fat = clampNonNeg(Math.round(num(raw.fat) * 10) / 10)
  if (calories <= 0 && protein <= 0 && carbs <= 0 && fat <= 0) return null
  const confidenceRaw = String(raw.confidence || '').toLowerCase()
  const confidence =
    confidenceRaw === 'low' || confidenceRaw === 'medium' || confidenceRaw === 'high'
      ? confidenceRaw
      : undefined
  const estimatedGrams = clampNonNeg(Math.round(num(raw.estimatedGrams ?? raw.grams, 0))) || undefined
  const note = String(raw.note || raw.assumptions || '').trim() || undefined
  return { name, calories, protein, carbs, fat, estimatedGrams, confidence, note }
}

const SYSTEM = `You estimate nutrition for a meal photo for a personal health app used by people in the United States.

Return ONLY valid JSON (no markdown) with this shape:
{
  "name": "short meal name",
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "estimatedGrams": number,
  "confidence": "low" | "medium" | "high",
  "note": "one short sentence about portion/assumptions"
}

Rules:
- Identify the most likely dish (e.g. "Bowl of chili", "Chicken Caesar salad").
- Estimate the visible portion size (typical American serving).
- Macros are for the whole portion shown, not per 100g.
- Be realistic; prefer medium confidence when unsure.
- If the image is not food, return {"name":"","calories":0,"protein":0,"carbs":0,"fat":0,"confidence":"low","note":"No food detected"}.`

export async function handleFoodEstimateRequest(
  req: Request,
  env: { apiKey?: string; model?: string } = {},
): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const apiKey = env.apiKey || process.env.OPENROUTER_API_KEY || ''
  const model = (
    env.model ||
    process.env.OPENROUTER_MODEL ||
    process.env.GEMINI_MODEL ||
    DEFAULT_OPENROUTER_MODEL
  ).trim()

  if (!apiKey) {
    return json(
      { error: 'OPENROUTER_API_KEY is not configured. Add it to .env (local) or Vercel env vars.' },
      503,
    )
  }

  let body: { imageBase64?: string; mimeType?: string }
  try {
    body = (await req.json()) as { imageBase64?: string; mimeType?: string }
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const rawB64 = (body.imageBase64 || '').replace(/^data:[^;]+;base64,/, '').trim()
  if (!rawB64 || rawB64.length < 100) {
    return json({ error: 'Missing image' }, 400)
  }
  // ~4MB base64 ceiling
  if (rawB64.length > 5_500_000) {
    return json({ error: 'Image too large — try a closer photo' }, 413)
  }

  const mime = (body.mimeType || 'image/jpeg').split(';')[0].trim()
  const allowed = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
  if (!allowed.has(mime)) {
    return json({ error: 'Unsupported image type' }, 400)
  }

  const dataUrl = `data:${mime};base64,${rawB64}`

  let res: Response
  try {
    res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://katana-personal.vercel.app',
        'X-Title': process.env.OPENROUTER_APP_NAME || 'Katana Personal',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 400,
        messages: [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Estimate the meal in this photo for logging nutrition.',
              },
              {
                type: 'image_url',
                image_url: { url: dataUrl },
              },
            ],
          },
        ],
      }),
    })
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : 'Network error calling OpenRouter.' },
      502,
    )
  }

  const raw = (await res.json().catch(() => null)) as {
    error?: { message?: string }
    choices?: { message?: { content?: string | null } }[]
  } | null

  if (!res.ok) {
    return json(
      { error: raw?.error?.message || `OpenRouter error (${res.status}).` },
      res.status >= 400 && res.status < 600 ? res.status : 502,
    )
  }

  const text = raw?.choices?.[0]?.message?.content?.trim()
  if (!text) {
    return json({ error: 'Empty model reply' }, 502)
  }

  const estimate = parseEstimate(text)
  if (!estimate || !estimate.name) {
    return json({ error: 'Could not identify food in that photo' }, 422)
  }

  return json({ estimate, model })
}
