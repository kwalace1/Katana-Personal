import type { Plugin } from 'vite'
import { handleFoodSearchRequest } from './api/food-search-core'
import { handleSupplementBarcodeRequest } from './api/supplement-barcode-core'

/** Local food search and supplement barcode lookup during `vite`. */
export function foodSearchDevPlugin(): Plugin {
  return {
    name: 'katana-food-search-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0]
        const supplement = path === '/api/supplement-barcode'
        if (path !== '/api/food-search' && !supplement) {
          next()
          return
        }

        try {
          const host = req.headers.host || 'localhost:3001'
          const url = `http://${host}${req.url || path}`
          const headers = new Headers()
          for (const [key, value] of Object.entries(req.headers)) {
            if (typeof value === 'string') headers.set(key, value)
            else if (Array.isArray(value)) headers.set(key, value.join(','))
          }

          const request = new Request(url, { method: req.method || 'GET', headers })
          const response = supplement
            ? await handleSupplementBarcodeRequest(request)
            : await handleFoodSearchRequest(request)

          res.statusCode = response.status
          response.headers.forEach((value, key) => {
            res.setHeader(key, value)
          })
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : 'Food search middleware failed',
            }),
          )
        }
      })
    },
  }
}
