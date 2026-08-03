/**
 * Vite dev middleware — POST /api/automation-browser for local development
 */
import type { Plugin } from 'vite'
import {
  runAutomationBrowserTool,
  type AutomationBrowserRequest,
} from './src/lib/automation-browser'

export function automationBrowserDevPlugin(): Plugin {
  return {
    name: 'automation-browser-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/automation-browser', (req, res, next) => {
        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
          res.end()
          return
        }
        if (req.method !== 'POST') return next()

        let body = ''
        req.on('data', (chunk) => {
          body += chunk
        })
        req.on('end', () => {
          void (async () => {
            try {
              const parsed = JSON.parse(body || '{}') as Record<string, unknown>
              const tool = String(parsed.tool || '')
              const url = String(parsed.url || '').trim()
              if (!tool || !url) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'tool and url are required' }))
                return
              }

              const request: AutomationBrowserRequest = {
                tool: tool as AutomationBrowserRequest['tool'],
                url,
                selector: parsed.selector ? String(parsed.selector) : undefined,
                timeoutMs: typeof parsed.timeoutMs === 'number' ? parsed.timeoutMs : undefined,
                viewportWidth:
                  typeof parsed.viewportWidth === 'number' ? parsed.viewportWidth : undefined,
                viewportHeight:
                  typeof parsed.viewportHeight === 'number' ? parsed.viewportHeight : undefined,
                formData:
                  parsed.formData &&
                  typeof parsed.formData === 'object' &&
                  !Array.isArray(parsed.formData)
                    ? Object.fromEntries(
                        Object.entries(parsed.formData as Record<string, unknown>).map(
                          ([k, v]) => [k, String(v ?? '')],
                        ),
                      )
                    : undefined,
                clickSequence: Array.isArray(parsed.clickSequence)
                  ? parsed.clickSequence.map((s) => String(s)).filter(Boolean)
                  : undefined,
              }

              const result = await runAutomationBrowserTool(request)
              res.statusCode = result.ok ? 200 : 422
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(result))
            } catch (e) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(
                JSON.stringify({
                  error: e instanceof Error ? e.message : 'Browser tool failed',
                }),
              )
            }
          })()
        })
      })
    },
  }
}
