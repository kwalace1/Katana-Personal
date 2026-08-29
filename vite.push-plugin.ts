import type { Plugin } from 'vite'
import { loadEnv } from 'vite'
import {
  handlePushCronRequest,
  handlePushScheduleRequest,
  handlePushSendRequest,
} from './api/push/push-core'
import { handleBillingCheckoutRequest } from './api/billing/checkout-core'

const PUSH_PATHS = new Map([
  ['/api/push/send', handlePushSendRequest],
  ['/api/push/schedule', handlePushScheduleRequest],
  ['/api/push/cron', handlePushCronRequest],
  ['/api/billing/checkout', handleBillingCheckoutRequest],
])

/** Local push API routes during `vite` dev. */
export function pushDevPlugin(): Plugin {
  return {
    name: 'katana-push-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0]
        const handler = path ? PUSH_PATHS.get(path) : undefined
        if (!handler) {
          next()
          return
        }

        const env = loadEnv(server.config.mode, server.config.root, '')

        try {
          const chunks: Buffer[] = []
          for await (const chunk of req) {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
          }
          const body = Buffer.concat(chunks)
          const headers = new Headers()
          for (const [key, value] of Object.entries(req.headers)) {
            if (typeof value === 'string') headers.set(key, value)
            else if (Array.isArray(value)) headers.set(key, value.join(','))
          }

          const request = new Request(`http://localhost${req.url || path}`, {
            method: req.method || 'GET',
            headers,
            body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
          })

          const pushEnv = {
            vapidPublicKey: env.VITE_VAPID_PUBLIC_KEY || env.VAPID_PUBLIC_KEY || '',
            vapidPrivateKey: env.VAPID_PRIVATE_KEY || '',
            vapidSubject: env.VAPID_SUBJECT || 'mailto:support@katana.app',
            supabaseUrl: env.VITE_SUPABASE_URL || '',
            supabaseServiceKey: env.SUPABASE_SERVICE_ROLE_KEY || '',
            cronSecret: env.CRON_SECRET || '',
          }

          const response =
            path === '/api/billing/checkout'
              ? await handleBillingCheckoutRequest(request, {
                  stripeSecretKey: env.STRIPE_SECRET_KEY || '',
                  stripePriceId: env.STRIPE_PRICE_ID || '',
                  appUrl: 'http://localhost:3001',
                })
              : await handler(request, pushEnv)

          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          const buf = Buffer.from(await response.arrayBuffer())
          res.end(buf)
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Push middleware failed' }))
        }
      })
    },
  }
}
