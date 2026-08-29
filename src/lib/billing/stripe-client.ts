/** Client-side Stripe checkout helper (web interim billing). */

export function billingConfigured(): boolean {
  return Boolean(import.meta.env.VITE_STRIPE_PRICE_ID)
}

export async function startPlusCheckout(options?: {
  email?: string
  uid?: string
}): Promise<{ url?: string; demo?: boolean; error?: string }> {
  const res = await fetch('/api/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options || {}),
  })

  const data = (await res.json()) as { url?: string; demo?: boolean; error?: string }
  if (!res.ok) return { error: data.error || 'Checkout unavailable', demo: data.demo }
  return data
}
