/**
 * Meal photo estimate + Nutrition Facts label OCR via OpenRouter (Gemini Flash vision).
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

/** Values from a Nutrition Facts label (per serving, as printed). */
export type NutritionLabelEstimate = {
  name: string
  servingSizeLabel?: string
  servingGrams?: number
  calories: number
  protein: number
  carbs: number
  fat: number
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

function parseConfidence(raw: unknown): 'low' | 'medium' | 'high' | undefined {
  const confidenceRaw = String(raw || '').toLowerCase()
  return confidenceRaw === 'low' || confidenceRaw === 'medium' || confidenceRaw === 'high'
    ? confidenceRaw
    : undefined
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  try {
    return JSON.parse(cleaned) as Record<string, unknown>
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      return JSON.parse(match[0]) as Record<string, unknown>
    } catch {
      return null
    }
  }
}

function parseEstimate(text: string): MealEstimate | null {
  const raw = parseJsonObject(text)
  if (!raw) return null
  const name = String(raw.name || raw.meal || '').trim()
  if (!name) return null
  const calories = clampNonNeg(Math.round(num(raw.calories)))
  const protein = clampNonNeg(Math.round(num(raw.protein) * 10) / 10)
  const carbs = clampNonNeg(Math.round(num(raw.carbs) * 10) / 10)
  const fat = clampNonNeg(Math.round(num(raw.fat) * 10) / 10)
  if (calories <= 0 && protein <= 0 && carbs <= 0 && fat <= 0) return null
  const estimatedGrams = clampNonNeg(Math.round(num(raw.estimatedGrams ?? raw.grams, 0))) || undefined
  const note = String(raw.note || raw.assumptions || '').trim() || undefined
  return {
    name,
    calories,
    protein,
    carbs,
    fat,
    estimatedGrams,
    confidence: parseConfidence(raw.confidence),
    note,
  }
}

function parseLabel(text: string): NutritionLabelEstimate | null {
  const raw = parseJsonObject(text)
  if (!raw) return null
  const name = String(raw.name || raw.productName || raw.product || 'Packaged food').trim()
  const calories = clampNonNeg(Math.round(num(raw.calories ?? raw.caloriesPerServing)))
  const protein = clampNonNeg(Math.round(num(raw.protein ?? raw.proteinPerServing) * 10) / 10)
  const carbs = clampNonNeg(Math.round(num(raw.carbs ?? raw.carbohydrates) * 10) / 10)
  const fat = clampNonNeg(Math.round(num(raw.fat ?? raw.totalFat) * 10) / 10)
  if (calories <= 0 && protein <= 0 && carbs <= 0 && fat <= 0) return null
  const servingGrams =
    clampNonNeg(Math.round(num(raw.servingGrams ?? raw.serving_quantity ?? raw.grams, 0))) ||
    undefined
  const servingSizeLabel =
    String(raw.servingSizeLabel || raw.servingSize || raw.serving_size || '').trim() || undefined
  const note = String(raw.note || '').trim() || undefined
  return {
    name: name || 'Packaged food',
    servingSizeLabel,
    servingGrams,
    calories,
    protein,
    carbs,
    fat,
    confidence: parseConfidence(raw.confidence),
    note,
  }
}

const MEAL_SYSTEM = `You estimate nutrition for a meal photo for a personal health app used by people in the United States.

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

const LABEL_SYSTEM = `You read US Nutrition Facts labels from photos for a personal health app.

Return ONLY valid JSON (no markdown) with this shape:
{
  "name": "product name if visible, else a short guess",
  "servingSizeLabel": "e.g. 1 cup (240g) or 2 cookies (28g)",
  "servingGrams": number or null,
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "confidence": "low" | "medium" | "high",
  "note": "one short note if anything was unclear"
}

Rules:
- Read calories, protein (g), total carbohydrate (g), and total fat (g) for ONE serving as printed.
- Prefer numbers from the Nutrition Facts panel, not marketing claims.
- Parse serving size grams into servingGrams when the label includes grams (e.g. 28g → 28).
- If the image is not a nutrition label, return zeros with note "No nutrition label detected".`

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

  let body: { imageBase64?: string; mimeType?: string; mode?: string }
  try {
    body = (await req.json()) as { imageBase64?: string; mimeType?: string; mode?: string }
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const mode = body.mode === 'label' ? 'label' : 'meal'
  const rawB64 = (body.imageBase64 || '').replace(/^data:[^;]+;base64,/, '').trim()
  if (!rawB64 || rawB64.length < 100) {
    return json({ error: 'Missing image' }, 400)
  }
  if (rawB64.length > 5_500_000) {
    return json({ error: 'Image too large — try a closer photo' }, 413)
  }

  const mime = (body.mimeType || 'image/jpeg').split(';')[0].trim()
  const allowed = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
  if (!allowed.has(mime)) {
    return json({ error: 'Unsupported image type' }, 400)
  }

  const dataUrl = `data:${mime};base64,${rawB64}`
  const system = mode === 'label' ? LABEL_SYSTEM : MEAL_SYSTEM
  const userText =
    mode === 'label'
      ? 'Read the Nutrition Facts label in this photo and extract per-serving macros.'
      : 'Estimate the meal in this photo for logging nutrition.'

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
        temperature: 0.1,
        max_tokens: 400,
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: [
              { type: 'text', text: userText },
              { type: 'image_url', image_url: { url: dataUrl } },
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

  if (mode === 'label') {
    const label = parseLabel(text)
    if (!label) {
      return json({ error: 'Could not read that nutrition label — try a clearer photo' }, 422)
    }
    return json({ label, model })
  }

  const estimate = parseEstimate(text)
  if (!estimate || !estimate.name) {
    return json({ error: 'Could not identify food in that photo' }, 422)
  }

  return json({ estimate, model })
}
