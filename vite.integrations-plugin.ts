import type { Plugin } from 'vite'
import { loadEnv } from 'vite'
import {
  handleGoogleOAuthRequest,
  handleGoogleSyncRequest,
  handleIcsFetchRequest,
} from './api/integrations/google-oauth-core'

const INTEGRATION_PATHS = new Set([
  '/api/integrations/google',
  '/api/integrations/google/sync',
  '/api/integrations/ics',
])

/** Local integration API routes during `vite` dev. */
export function integrationsDevPlugin(): Plugin {
  return {
    name: 'katana-integrations-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0]
        if (!path || !INTEGRATION_PATHS.has(path)) {
          next()
          return
        }

        const env = loadEnv(server.config.mode, server.config.root, '')
        const googleEnv = {
          clientId: env.GOOGLE_CLIENT_ID || env.VITE_GOOGLE_CLIENT_ID || '',
          clientSecret: env.GOOGLE_CLIENT_SECRET || '',
        }

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

          const response =
            path === '/api/integrations/google/sync'
              ? await handleGoogleSyncRequest(request, googleEnv)
              : path === '/api/integrations/ics'
                ? await handleIcsFetchRequest(request)
                : await handleGoogleOAuthRequest(request, googleEnv)

          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          const buf = Buffer.from(await response.arrayBuffer())
          res.end(buf)
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Integration middleware failed' }))
        }
      })
    },
  }
}
