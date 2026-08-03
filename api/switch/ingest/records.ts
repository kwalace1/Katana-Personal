import { handleSwitchIngestRecords } from '../../../lib/api/switch/ingest-records'

export default async function handler(req: Request): Promise<Response> {
  return handleSwitchIngestRecords(req)
}

export const config = { runtime: 'edge' }
