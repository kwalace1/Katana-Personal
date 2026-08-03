/**
 * Vite dev middleware — /api/finance-plaid for local Plaid development
 */
import type { Plugin } from 'vite'
import { handleFinancePlaidRequest } from './lib/api/finance-plaid-handlers'

export function financePlaidDevPlugin(): Plugin {
  return {
    name: 'finance-plaid-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/finance-plaid', (req, res) => {
        const host = req.headers.host ?? 'localhost:3001'
        const url = `http://${host}${req.url ?? ''}`
        const headers = new Headers()
        for (const [key, value] of Object.entries(req.headers)) {
          if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
        }

        void (async () => {
          let body: string | undefined
          if (req.method === 'POST') {
            body = await new Promise<string>((resolve, reject) => {
              let data = ''
              req.on('data', (chunk) => { data += chunk })
              req.on('end', () => resolve(data))
              req.on('error', reject)
            })
          }

          const response = await handleFinancePlaidRequest(
            new Request(url, { method: req.method ?? 'GET', headers, body }),
          )
          res.statusCode = response.status
          response.headers.forEach((v, k) => res.setHeader(k, v))
          res.end(Buffer.from(await response.arrayBuffer()))
        })().catch((e) => {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'Plaid dev error' }))
        })
      })
    },
  }
}
