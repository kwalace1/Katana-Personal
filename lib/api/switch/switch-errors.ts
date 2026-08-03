/**
 * Switch integration — standardized error responses
 */

export type SwitchErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INVALID_REQUEST'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'INGEST_FAILED'
  | 'FILE_FETCH_FAILED'
  | 'ENTITY_MAPPING_ERROR'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'NOT_CONFIGURED'

export interface SwitchErrorBody {
  error: string
  code: SwitchErrorCode
  details?: Array<{ field?: string; message: string; external_id?: string }>
  ingest_job_id?: string
}

export function switchError(
  status: number,
  code: SwitchErrorCode,
  message: string,
  extras?: Pick<SwitchErrorBody, 'details' | 'ingest_job_id'>,
): Response {
  const body: SwitchErrorBody = { error: message, code, ...extras }
  return Response.json(body, { status })
}

export function switchJson<T extends Record<string, unknown>>(data: T, status = 200): Response {
  return Response.json(data, { status })
}

export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

export function withCors(res: Response): Response {
  const headers = new Headers(res.headers)
  for (const [k, v] of Object.entries(corsHeaders())) headers.set(k, v)
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
}
