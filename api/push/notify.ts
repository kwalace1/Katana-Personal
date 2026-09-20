import { handlePushNotifyUserRequest } from './push-core'

export const config = { runtime: 'nodejs' }

/** POST /api/push/notify — fan-out a social/Together notification to another user. */
export default async function handler(req: Request): Promise<Response> {
  return handlePushNotifyUserRequest(req)
}
