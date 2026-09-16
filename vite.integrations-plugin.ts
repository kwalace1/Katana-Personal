import type { Plugin } from 'vite'
import { loadEnv } from 'vite'
import {
  handleGoogleOAuthRequest,
  handleGoogleSyncRequest,
  handleIcsFetchRequest,
} from './api/integrations/google-oauth-core'
import {
  handleGoogleTasksOAuthRequest,
  handleGoogleTasksSyncRequest,
} from './api/integrations/google-tasks-oauth-core'
import {
  handleFitbitOAuthRequest,
  handleFitbitSyncRequest,
  handleStravaOAuthRequest,
  handleStravaSyncRequest,
} from './api/integrations/health-oauth-core'
import {
  handleOutlookOAuthRequest,
  handleOutlookSyncRequest,
} from './api/integrations/outlook-oauth-core'
import {
  handleTodoistOAuthRequest,
  handleTodoistSyncRequest,
} from './api/integrations/todoist-oauth-core'

const INTEGRATION_PATHS = new Set([
  '/api/integrations/google',
  '/api/integrations/google/sync',
  '/api/integrations/google-tasks',
  '/api/integrations/google-tasks/sync',
  '/api/integrations/outlook',
  '/api/integrations/outlook/sync',
  '/api/integrations/todoist',
  '/api/integrations/todoist/sync',
  '/api/integrations/ics',
  '/api/integrations/fitbit',
  '/api/integrations/fitbit/sync',
  '/api/integrations/strava',
  '/api/integrations/strava/sync',
])

function withInferredAction(request: Request): Request {
  const url = new URL(request.url)
  if (!url.searchParams.get('action')) {
    url.searchParams.set(
      'action',
      url.searchParams.get('code') || url.searchParams.get('error') ? 'callback' : 'start',
    )
    return new Request(url.toString(), request)
  }
  return request
}

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
        const googleTasksEnv = {
          clientId:
            env.GOOGLE_CLIENT_ID || env.VITE_GOOGLE_TASKS_CLIENT_ID || env.VITE_GOOGLE_CLIENT_ID || '',
          clientSecret: env.GOOGLE_CLIENT_SECRET || '',
        }
        const msEnv = {
          clientId: env.MS_CLIENT_ID || env.VITE_MS_CLIENT_ID || env.VITE_OUTLOOK_CLIENT_ID || '',
          clientSecret: env.MS_CLIENT_SECRET || '',
        }
        const todoistEnv = {
          clientId: env.TODOIST_CLIENT_ID || env.VITE_TODOIST_CLIENT_ID || '',
          clientSecret: env.TODOIST_CLIENT_SECRET || '',
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

          const rawRequest = new Request(`http://localhost${req.url || path}`, {
            method: req.method || 'GET',
            headers,
            body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
          })
          const request = withInferredAction(rawRequest)

          let response: Response
          if (path === '/api/integrations/google/sync') {
            response = await handleGoogleSyncRequest(request, googleEnv)
          } else if (path === '/api/integrations/google-tasks/sync') {
            response = await handleGoogleTasksSyncRequest(request, googleTasksEnv)
          } else if (path === '/api/integrations/google-tasks') {
            response = await handleGoogleTasksOAuthRequest(request, googleTasksEnv)
          } else if (path === '/api/integrations/outlook/sync') {
            response = await handleOutlookSyncRequest(request, msEnv)
          } else if (path === '/api/integrations/outlook') {
            response = await handleOutlookOAuthRequest(request, msEnv)
          } else if (path === '/api/integrations/todoist/sync') {
            response = await handleTodoistSyncRequest(request, todoistEnv)
          } else if (path === '/api/integrations/todoist') {
            response = await handleTodoistOAuthRequest(request, todoistEnv)
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
