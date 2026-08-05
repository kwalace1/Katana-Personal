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
          <div className="kp-surface max-w-md p-6">
            <h1 className="font-display text-2xl">Something went wrong</h1>
            <p className="mt-2 text-sm text-muted-foreground">{this.state.error?.message}</p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // Pick up new deploys without waiting for a long idle period
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

