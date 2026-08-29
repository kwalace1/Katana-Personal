import { handlePushCronRequest } from './push-core'

export const config = { runtime: 'nodejs' }

/** GET/POST /api/push/cron — Vercel cron fires due scheduled nudges. */
export default async function handler(req: Request): Promise<Response> {
  return handlePushCronRequest(req)
}
