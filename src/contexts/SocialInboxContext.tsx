import { createContext, useContext, type ReactNode } from 'react'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { useSocialInbox } from '@/hooks/useSocialInbox'

type SocialInboxValue = ReturnType<typeof useSocialInbox>

const SocialInboxContext = createContext<SocialInboxValue | null>(null)

/** One live inbox for the shell — bell badge + Friends page share it. */
export function SocialInboxProvider({ children }: { children: ReactNode }) {
  const { cloudUser } = useCloudAuth()
  const value = useSocialInbox(cloudUser?.uid)
  return <SocialInboxContext.Provider value={value}>{children}</SocialInboxContext.Provider>
}

export function useSharedSocialInbox(): SocialInboxValue {
  const ctx = useContext(SocialInboxContext)
  if (!ctx) {
    throw new Error('useSharedSocialInbox must be used within SocialInboxProvider')
  }
  return ctx
}
