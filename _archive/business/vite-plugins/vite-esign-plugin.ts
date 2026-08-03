/**
 * Vite dev middleware — /api/esign for local e-sign token flows
 */
import type { Plugin } from 'vite'
import { loadEnv } from 'vite'

export function esignDevPlugin(): Plugin {
  return {
    name: 'esign-dev-api',
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.envDir || process.cwd(), '')
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) process.env[key] = value
      }

      server.middlewares.use('/api/esign', (req, res) => {
        const host = req.headers.host ?? 'localhost:3001'
        const url = `http://${host}/api/esign${req.url ?? ''}`
        const headers = new Headers()
        for (const [key, value] of Object.entries(req.headers)) {
          if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
        }

        void (async () => {
          // Load handler after env is injected so service role / URL resolve correctly.
          const { handleEsignRequest } = await import('./lib/api/esign-handlers')

          let body: string | undefined
          if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
            body = await new Promise<string>((resolve, reject) => {
              let data = ''
              req.on('data', (chunk) => {
                data += chunk
              })
              req.on('end', () => resolve(data))
              req.on('error', reject)
            })
          }

          const response = await handleEsignRequest(
            new Request(url, { method: req.method ?? 'GET', headers, body }),
          )
          res.statusCode = response.status
          response.headers.forEach((v, k) => res.setHeader(k, v))
          res.end(Buffer.from(await response.arrayBuffer()))
        })().catch((e) => {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'E-Sign dev error' }))
        })
      })
    },
  }
}
