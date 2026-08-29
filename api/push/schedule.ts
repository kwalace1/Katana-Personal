import { handlePushScheduleRequest } from './push-core'

export const config = { runtime: 'nodejs' }

/** POST /api/push/schedule — upsert next server-delivered nudge. */
export default async function handler(req: Request): Promise<Response> {
  return handlePushScheduleRequest(req)
}
