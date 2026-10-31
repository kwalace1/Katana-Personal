import { handleSupplementBarcodeRequest } from './supplement-barcode-core'

export const config = { runtime: 'edge' }

/** GET /api/supplement-barcode — NIH DSLD lookup by UPC/EAN. */
export default async function handler(req: Request): Promise<Response> {
  return handleSupplementBarcodeRequest(req)
}
