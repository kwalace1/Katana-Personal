import { handlePushCronRequest, handlePushScheduleRequest, handlePushSendRequest } from './push-core'

export const config = { runtime: 'nodejs' }

/** POST /api/push/send — deliver a push to the signed-in user's subscription. */
export default async function handler(req: Request): Promise<Response> {
  return handlePushSendRequest(req)
}
