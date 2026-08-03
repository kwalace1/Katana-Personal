/**
 * Agent Office module boot: React Query client, Katana→office auth bridge,
 * and the SwarmClaw bootstrap (agents, sessions, settings, WebSocket).
 *
 * The office backend (SwarmClaw, reached via /api/office) is an internal
 * engine — every user-facing surface here is Katana-native.
 */
import { createContext, useContext, useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Loader2, RefreshCw, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppBootstrap } from '@/hooks/office/use-app-bootstrap'
import { useKatanaOfficeAuth } from '@/lib/office/katana-bridge'
import { useAppStore } from '@/stores/office/use-app-store'
import type { NavMode } from '@/lib/office/app/nav-access'

interface OfficeContextValue {
  /** 'full' for owners/admins (management surfaces), 'katana' for members. */
  navMode: NavMode
  currentUser: string | null
  /** Signed-in user's avatar (Microsoft photo), shown on their chat messages. */
  userAvatarUrl: string | null
  /** Signed-in user's display name, for avatar fallback initials. */
  userName: string | null
}

const OfficeContext = createContext<OfficeContextValue>({
  navMode: 'katana', currentUser: null, userAvatarUrl: null, userName: null,
})

export function useOffice(): OfficeContextValue {
  return useContext(OfficeContext)
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  })
}

function BootState({ children, compact }: { children: React.ReactNode; compact?: boolean }) {
  const { navMode, katanaUserName, katanaUserId, katanaAvatarUrl } = useKatanaOfficeAuth()
  const setUserId = useAppStore((s) => s.setUserId)
  const {
    hydrated,
    authChecked,
    authenticated,
    currentUser,
    userReady,
    agentReady,
  } = useAppBootstrap(katanaUserName)

  // Keep the office's stable owner id in sync with the signed-in Katana user so
  // new chat threads are created under (and filtered to) this user.
  useEffect(() => {
    setUserId(katanaUserId)
  }, [katanaUserId, setUserId])

  if (!hydrated || !authChecked || (authenticated && (!userReady || !agentReady))) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className={compact ? 'h-5 w-5 animate-spin text-primary' : 'h-6 w-6 animate-spin text-primary'} />
        <p className={compact ? 'text-xs' : 'text-sm'}>Connecting to your agents…</p>
      </div>
    )
  }

  if (!authenticated) {
    if (compact) {
      return (
        <div className="flex-1 h-full flex flex-col items-center justify-center gap-3 px-5 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <p className="text-xs text-muted-foreground">
            Couldn't reach the agent service. Try again in a moment.
          </p>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-1.5 h-3 w-3" />
            Retry
          </Button>
        </div>
      )
    }
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
          <Bot className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Agent Office unavailable</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Could not reach the agent service. Check that it is running and the access key is
            configured, then try again.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <OfficeContext.Provider
      value={{ navMode, currentUser, userAvatarUrl: katanaAvatarUrl, userName: katanaUserName }}
    >
      {children}
    </OfficeContext.Provider>
  )
}

export function OfficeProvider({
  children,
  variant = 'full',
}: {
  children: React.ReactNode
  /** 'compact' renders small loading/error states for the floating chat popup. */
  variant?: 'full' | 'compact'
}) {
  const [queryClient] = useState(makeQueryClient)
  return (
    <QueryClientProvider client={queryClient}>
      <BootState compact={variant === 'compact'}>{children}</BootState>
    </QueryClientProvider>
  )
}
