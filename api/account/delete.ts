import { handleAccountDeleteRequest } from './delete-core'

export const config = { runtime: 'nodejs' }

/** POST /api/account/delete — Together account deletion for App Store Guideline 5.1.1. */
export default async function handler(req: Request): Promise<Response> {
  return handleAccountDeleteRequest(req)
}
