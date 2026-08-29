export type BillingEnv = {
  stripeSecretKey: string
  stripePriceId: string
  appUrl: string
}

export function readBillingEnv(): BillingEnv {
  return {
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
    stripePriceId: process.env.STRIPE_PRICE_ID || '',
    appUrl: process.env.VITE_APP_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3001',
  }
}

export function billingConfigured(env: BillingEnv = readBillingEnv()): boolean {
  return Boolean(env.stripeSecretKey && env.stripePriceId)
}

function baseUrl(req: Request): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3001'
  const proto = req.headers.get('x-forwarded-proto') || 'http'
  return `${proto}://${host}`
}

/** Create a Stripe Checkout session for Katana Plus (web interim billing). */
export async function handleBillingCheckoutRequest(req: Request, env: BillingEnv = readBillingEnv()): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  if (!billingConfigured(env)) {
    return Response.json(
      {
        error: 'Stripe not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID, or use demo unlock.',
        demo: true,
      },
      { status: 503 },
    )
  }

  let body: { email?: string; uid?: string }
  try {
    body = (await req.json()) as { email?: string; uid?: string }
  } catch {
    body = {}
  }

  const origin = baseUrl(req)
  const params = new URLSearchParams()
  params.set('mode', 'subscription')
  params.set('success_url', `${origin}/settings#plus?checkout=success`)
  params.set('cancel_url', `${origin}/settings#plus?checkout=cancel`)
  params.set('line_items[0][price]', env.stripePriceId)
  params.set('line_items[0][quantity]', '1')
  if (body.email) params.set('customer_email', body.email)
  if (body.uid) params.set('client_reference_id', body.uid)
  params.set('metadata[product]', 'katana-plus')

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  const data = (await res.json()) as { url?: string; error?: { message?: string } }
  if (!res.ok) {
    return Response.json({ error: data.error?.message || 'Checkout failed' }, { status: 502 })
  }

  return Response.json({ url: data.url })
}
