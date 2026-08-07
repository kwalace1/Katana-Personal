import { handleAskLlmRequest } from './ask-llm-core'

export const config = { runtime: 'edge' }

/** POST /api/ask-llm — Gemini Flash proxy for open-ended Ask questions. */
export default async function handler(req: Request): Promise<Response> {
  return handleAskLlmRequest(req)
}
