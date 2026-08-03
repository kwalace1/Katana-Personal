import { handleSwitchIngestFiles } from '../../../lib/api/switch/ingest-files'

export default async function handler(req: Request): Promise<Response> {
  return handleSwitchIngestFiles(req)
}

export const config = { runtime: 'edge' }
