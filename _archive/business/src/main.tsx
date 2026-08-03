import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@/components/theme-provider'
import { AuthProvider } from '@/contexts/AuthContext'
import { ModuleAccessProvider } from '@/contexts/ModuleAccessContext'
import { PasswordGate } from '@/components/PasswordGate'
import App from './App'
import 'sonner/dist/styles.css'
import './index.css'
import './styles/office.css'

// Error boundary for production debugging
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

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('React Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
          <h1>Something went wrong.</h1>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error && this.state.error.toString()}
          </details>
        </div>
      )
    }

    return this.props.children
  }
}

const root = document.getElementById('root')
if (!root) {
  throw new Error('Root element not found')
}

ReactDOM.createRoot(root).render(
  <ErrorBoundary>
    <PasswordGate>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <ThemeProvider 
          attribute="class" 
          defaultTheme="system" 
          enableSystem
          storageKey="katana-theme"
          disableTransitionOnChange={false}
        >
          <AuthProvider>
            <ModuleAccessProvider>
              <App />
            </ModuleAccessProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </PasswordGate>
  </ErrorBoundary>,
)