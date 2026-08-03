/**
 * Vite dev middleware — POST /api/kyc-summary and /api/kyc-coach for local development
 */
import type { Plugin } from 'vite'
import { buildTemplateCoachResponse } from './src/lib/kyc-account-coach'
import {
  buildTemplateClientSummary,
  type KycSummaryContext,
} from './src/lib/kyc-client-summary'

function readJsonBody(req: import('http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

export function kycSummaryDevPlugin(): Plugin {
  return {
    name: 'kyc-summary-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/kyc-summary', (req, res, next) => {
        if (req.method !== 'POST') return next()

        void readJsonBody(req)
          .then((body) => {
            const parsed = JSON.parse(body || '{}') as Record<string, unknown>
            const context = parsed.context as KycSummaryContext | undefined
            if (!context?.client_name) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'context with client_name is required' }))
              return
            }

            const summary = buildTemplateClientSummary(context)
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                summary,
                source: 'template',
                generated_at: new Date().toISOString(),
                persisted: false,
              }),
            )
          })
          .catch((e) => {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'Summary failed' }))
          })
      })

      server.middlewares.use('/api/kyc-coach', (req, res, next) => {
        if (req.method !== 'POST') return next()

        void readJsonBody(req)
          .then((body) => {
            const parsed = JSON.parse(body || '{}') as Record<string, unknown>
            const context = parsed.context as KycSummaryContext | undefined
            if (!context?.client_name) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'context with client_name is required' }))
              return
            }

            const response = buildTemplateCoachResponse(context)
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                response,
                source: 'template',
                generated_at: new Date().toISOString(),
                persisted: false,
              }),
            )
          })
          .catch((e) => {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'Coach failed' }))
          })
      })
    },
  }
}
