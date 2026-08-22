import type { Plugin } from 'vite'
import { loadEnv } from 'vite'
import { handleAskLlmRequest } from './api/ask-llm-core'
import { handleFoodEstimateRequest } from './api/food-estimate-core'

/** Local `/api/ask-llm` + `/api/food-estimate` during `vite` without `vercel dev`. */
export function geminiAskDevPlugin(): Plugin {
  return {
    name: 'katana-gemini-ask-dev',
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, '')
      const openRouterEnv = {
        apiKey: env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY,
        model: env.OPENROUTER_MODEL || process.env.OPENROUTER_MODEL || env.GEMINI_MODEL,
      }

      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0]
        if (url !== '/api/ask-llm' && url !== '/api/food-estimate') {
          next()
          return
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

          const request = new Request(`http://localhost${req.url || url}`, {
            method: req.method || 'POST',
            headers,
            body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
          })

          const response =
            url === '/api/food-estimate'
              ? await handleFoodEstimateRequest(request, openRouterEnv)
              : await handleAskLlmRequest(request, openRouterEnv)

          res.statusCode = response.status
          response.headers.forEach((value, key) => {
            res.setHeader(key, value)
          })

          // Pipe SSE / streaming bodies without buffering the whole response.
          if (response.body) {
            const reader = response.body.getReader()
            try {
              while (true) {
                const { done, value } = await reader.read()
                if (done) break
                if (value) res.write(Buffer.from(value))
              }
              res.end()
            } catch (err) {
              if (!res.headersSent) {
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(
                  JSON.stringify({
                    error: err instanceof Error ? err.message : 'Stream pipe failed',
                  }),
                )
              } else {
                res.end()
              }
            }
            return
          }

          const buf = Buffer.from(await response.arrayBuffer())
          res.end(buf)
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : 'OpenRouter middleware failed',
            }),
          )
        }
      })
    },
  }
}
