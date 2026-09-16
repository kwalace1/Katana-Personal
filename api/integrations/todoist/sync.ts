import { handleTodoistSyncRequest } from '../todoist-oauth-core'

export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  return handleTodoistSyncRequest(req)
}
