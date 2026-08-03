/**
 * Vite dev middleware — POST /api/kyc-enrich for local development
 */
import type { Plugin } from 'vite'
import { enrichCompanyFromPublicSources } from './src/lib/kyc-enrichment'

export function kycEnrichDevPlugin(): Plugin {
  return {
    name: 'kyc-enrich-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/kyc-enrich', (req, res, next) => {
        if (req.method !== 'POST') return next()

        let body = ''
        req.on('data', (chunk) => {
          body += chunk
        })
        req.on('end', () => {
          void (async () => {
            try {
              const parsed = JSON.parse(body || '{}') as Record<string, unknown>
              const companyName = String(parsed.company_name ?? '').trim()
              if (!companyName) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'company_name is required' }))
                return
              }

              const result = await enrichCompanyFromPublicSources({
                name: companyName,
                state: parsed.state ? String(parsed.state) : null,
                country: parsed.country ? String(parsed.country) : null,
              })

              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(
                JSON.stringify({
                  external_signals: result.external_signals,
                  enrichment: result.enrichment,
                  payload: result.payload,
                  persisted: false,
                }),
              )
            } catch (e) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'Enrichment failed' }))
            }
          })()
        })
      })
    },
  }
}
