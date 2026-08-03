/**
 * Vite dev middleware — /switch/* and /api/switch/* for local Switch integration
 */
import type { Plugin } from 'vite'
import { handleSwitchOAuthToken } from './lib/api/switch/oauth-token'
import { handleSwitchIngestFiles } from './lib/api/switch/ingest-files'
import { handleSwitchIngestRecords } from './lib/api/switch/ingest-records'
import { handleSwitchSchema } from './lib/api/switch/schema-handler'
import { handleSwitchHandoffOutbound } from './lib/api/switch/handoff-outbound'

type RouteHandler = (req: Request) => Promise<Response>

const ROUTES: Array<{ match: (path: string) => boolean; handler: RouteHandler }> = [
  { match: (p) => p.endsWith('/oauth/token'), handler: handleSwitchOAuthToken },
  { match: (p) => p.endsWith('/ingest/files'), handler: handleSwitchIngestFiles },
  { match: (p) => p.endsWith('/ingest/records'), handler: handleSwitchIngestRecords },
  { match: (p) => p.endsWith('/schema') || p === '/schema', handler: handleSwitchSchema },
  // Katana → Switch divert (outbound proxy); path stays under /api/switch/handoff
  { match: (p) => p.endsWith('/handoff'), handler: handleSwitchHandoffOutbound },
]

function normalizePath(url: string): string {
  const path = new URL(url, 'http://localhost').pathname
  return path.replace(/^\/api\/switch/, '/switch').replace(/\/$/, '')
}

async function readBody(req: import('http').IncomingMessage): Promise<string | undefined> {
  if (req.method !== 'POST') return undefined
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => { data += chunk })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

export function switchDevPlugin(): Plugin {
  return {
    name: 'switch-dev-api',
    configureServer(server) {
      const handle = (req: import('http').IncomingMessage, res: import('http').ServerResponse) => {
        const host = req.headers.host ?? 'localhost:3001'
        const pathOnly = (req.url ?? '').split('?')[0]
        const fullUrl = `http://${host}${req.url ?? ''}`
        const normalized = normalizePath(pathOnly)

        const route = ROUTES.find((r) => r.match(normalized))
        if (!route) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Switch route not found', code: 'NOT_FOUND' }))
          return
        }

        void (async () => {
          const headers = new Headers()
          for (const [key, value] of Object.entries(req.headers)) {
            if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
          }
          const body = await readBody(req)
          const response = await route.handler(
            new Request(fullUrl, { method: req.method ?? 'GET', headers, body }),
          )
          res.statusCode = response.status
          response.headers.forEach((v, k) => res.setHeader(k, v))
          res.end(Buffer.from(await response.arrayBuffer()))
        })().catch((e) => {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              error: e instanceof Error ? e.message : 'Switch dev error',
              code: 'INTERNAL_ERROR',
            }),
          )
        })
      }

      server.middlewares.use('/switch', handle)
      server.middlewares.use('/api/switch', handle)
    },
  }
}
