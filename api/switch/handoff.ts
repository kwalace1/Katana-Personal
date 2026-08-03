/**
 * POST /api/switch/handoff — Katana → Switch import divert proxy
 */
import { handleSwitchHandoffOutbound } from '../../lib/api/switch/handoff-outbound'

export const config = { runtime: 'nodejs' }

export default async function handler(req: Request): Promise<Response> {
  return handleSwitchHandoffOutbound(req)
}
