import type { Plugin } from 'vite'
import { loadEnv } from 'vite'
import {
  handleGoogleOAuthRequest,
  handleGoogleSyncRequest,
  handleIcsFetchRequest,
} from './api/integrations/google-oauth-core'
import {
  handleFitbitOAuthRequest,
  handleFitbitSyncRequest,
  handleStravaOAuthRequest,
  handleStravaSyncRequest,
} from './api/integrations/health-oauth-core'

const INTEGRATION_PATHS = new Set([
  '/api/integrations/google',
  '/api/integrations/google/sync',
  '/api/integrations/ics',
  '/api/integrations/fitbit',
  '/api/integrations/fitbit/sync',
  '/api/integrations/strava',
  '/api/integrations/strava/sync',
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
        const healthEnv = {
          fitbitClientId: env.FITBIT_CLIENT_ID || env.VITE_FITBIT_CLIENT_ID || '',
          fitbitClientSecret: env.FITBIT_CLIENT_SECRET || '',
          stravaClientId: env.STRAVA_CLIENT_ID || env.VITE_STRAVA_CLIENT_ID || '',
          stravaClientSecret: env.STRAVA_CLIENT_SECRET || '',
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

          let response: Response
          if (path === '/api/integrations/google/sync') {
            response = await handleGoogleSyncRequest(request, googleEnv)
          } else if (path === '/api/integrations/ics') {
            response = await handleIcsFetchRequest(request)
          } else if (path === '/api/integrations/fitbit/sync') {
            response = await handleFitbitSyncRequest(request, healthEnv)
          } else if (path === '/api/integrations/fitbit') {
            response = await handleFitbitOAuthRequest(request, healthEnv)
          } else if (path === '/api/integrations/strava/sync') {
            response = await handleStravaSyncRequest(request, healthEnv)
          } else if (path === '/api/integrations/strava') {
            response = await handleStravaOAuthRequest(request, healthEnv)
          } else {
            response = await handleGoogleOAuthRequest(request, googleEnv)
          }

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
