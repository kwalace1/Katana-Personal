import { handleFoodSearchRequest } from './food-search-core'

export const config = { runtime: 'edge' }

/** GET /api/food-search — proxies Open Food Facts (search + barcode). */
export default async function handler(req: Request): Promise<Response> {
  return handleFoodSearchRequest(req)
}
