import { handleFoodEstimateRequest } from './food-estimate-core'

export const config = { runtime: 'edge' }

/** POST /api/food-estimate — meal photo → macro estimate (Gemini via OpenRouter). */
export default async function handler(req: Request): Promise<Response> {
  return handleFoodEstimateRequest(req)
}
