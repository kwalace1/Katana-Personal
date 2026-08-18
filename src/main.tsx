import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/components/theme-provider'
import { AccentProvider } from '@/components/AccentProvider'
import { AuthProvider } from '@/contexts/AuthContext'
import { CloudAuthProvider } from '@/contexts/CloudAuthContext'
import { Toaster } from '@/components/ui/sonner'
import { ReminderHost } from '@/components/ReminderHost'
import { Analytics } from '@vercel/analytics/react'
import App from './App'
import 'sonner/dist/styles.css'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="kp-surface max-w-md space-y-3 p-6">
            <h1 className="font-display text-2xl">Something went wrong</h1>
            <p className="mt-2 text-sm text-muted-foreground">{this.state.error?.message}</p>
            <button
              type="button"
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.assign('/dashboard')
              }}
            >
              Back to Today
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const APP_BUILD = '2026-08-17-calendar-grid'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void (async () => {
      try {
        const prev = localStorage.getItem('katana-sw-build')
        if (prev !== APP_BUILD) {
          const regs = await navigator.serviceWorker.getRegistrations()
          await Promise.all(regs.map((r) => r.unregister()))
          if ('caches' in window) {
            const keys = await caches.keys()
            await Promise.all(keys.map((k) => caches.delete(k)))
          }
          localStorage.setItem('katana-sw-build', APP_BUILD)
          // Hard reload once so the home-screen app drops the old shell
          window.location.reload()
          return
        }
      } catch {
        // ignore
      }

      void navigator.serviceWorker
        .register(`/sw.js?v=${APP_BUILD}`)
        .then((reg) => {
          void reg.update()
          setInterval(() => void reg.update(), 60_000)
          reg.addEventListener('updatefound', () => {
            const worker = reg.installing
            if (!worker) return
            worker.addEventListener('statechange', () => {
              if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                worker.postMessage('SKIP_WAITING')
              }
            })
          })
        })
        .catch(() => {
          // Offline shell is optional in local development
        })

      let refreshing = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return
        refreshing = true
        window.location.reload()
      })
    })()
  })
}

window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    void import('@/lib/local-db').then(({ localDb }) => localDb.flush())
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <ThemeProvider attribute="class" defaultTheme="system" storageKey="katana-personal-theme" enableSystem>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <AuthProvider>
            <AccentProvider>
              <CloudAuthProvider>
                <ReminderHost />
                <App />
                <Toaster />
                <Analytics />
              </CloudAuthProvider>
            </AccentProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>,
)

