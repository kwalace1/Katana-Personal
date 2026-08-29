import { handleBillingCheckoutRequest } from './checkout-core'

export const config = { runtime: 'nodejs' }

/** POST /api/billing/checkout — Stripe Checkout for Katana Plus. */
export default async function handler(req: Request): Promise<Response> {
  return handleBillingCheckoutRequest(req)
}
