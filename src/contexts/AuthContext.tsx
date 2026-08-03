import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { createId } from '@/lib/id'
import { ensureUserLoaded, initLocalDb, localDb } from '@/lib/local-db'

const LOCAL_SESSION_KEY = 'katana-personal:local-session'
const ONBOARDING_KEY = 'katana-personal:onboarding-done'

export interface UserProfile {
  id: string
  display_name: string
  preferences: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface LocalUser {
  id: string
}

interface AuthContextType {
  user: LocalUser | null
  profile: UserProfile | null
  loading: boolean
  isLocalMode: true
  onboardingDone: boolean
  startWorkspace: (displayName?: string, options?: { id?: string; preferences?: Record<string, unknown> }) => Promise<void>
  updateDisplayName: (name: string) => void
  updatePreferences: (patch: Record<string, unknown>) => void
  markOnboardingDone: () => void
  resetOnboarding: () => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface StoredSession {
  id: string
  display_name: string
  preferences?: Record<string, unknown>
  created_at?: string
  updated_at?: string
}

function toProfile(raw: StoredSession): UserProfile {
  const now = new Date().toISOString()
  return {
    id: raw.id,
    display_name: raw.display_name || 'You',
    preferences: raw.preferences || {},
    created_at: raw.created_at || now,
    updated_at: raw.updated_at || now,
  }
}

function persist(session: StoredSession) {
  localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(session))
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [onboardingDone, setOnboardingDone] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        await initLocalDb()
        const raw = localStorage.getItem(LOCAL_SESSION_KEY)
        if (raw) {
          const parsed = JSON.parse(raw) as StoredSession
          await ensureUserLoaded(parsed.id)
          if (!mounted) return
          setUser({ id: parsed.id })
          setProfile(toProfile(parsed))
        }
        if (mounted) setOnboardingDone(localStorage.getItem(ONBOARDING_KEY) === '1')
      } catch (err) {
        console.warn('Could not open local storage', err)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const startWorkspace = useCallback(
    async (displayName?: string, options?: { id?: string; preferences?: Record<string, unknown> }) => {
      const now = new Date().toISOString()
      const session: StoredSession = {
        id: options?.id || createId(),
        display_name: displayName?.trim() || 'You',
        preferences: options?.preferences || {},
        created_at: now,
        updated_at: now,
      }
      persist(session)
      await ensureUserLoaded(session.id)
      setUser({ id: session.id })
      setProfile(toProfile(session))
    },
    [],
  )

  const updateDisplayName = useCallback(
    (name: string) => {
      if (!profile) return
      const next: StoredSession = {
        id: profile.id,
        display_name: name.trim() || 'You',
        preferences: profile.preferences,
        created_at: profile.created_at,
        updated_at: new Date().toISOString(),
      }
      persist(next)
      setProfile(toProfile(next))
    },
    [profile],
  )

  const updatePreferences = useCallback(
    (patch: Record<string, unknown>) => {
      if (!profile) return
      const next: StoredSession = {
        id: profile.id,
        display_name: profile.display_name,
        preferences: { ...profile.preferences, ...patch },
        created_at: profile.created_at,
        updated_at: new Date().toISOString(),
      }
      persist(next)
      setProfile(toProfile(next))
    },
    [profile],
  )

  const markOnboardingDone = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, '1')
    setOnboardingDone(true)
  }, [])

  const resetOnboarding = useCallback(() => {
    localStorage.removeItem(ONBOARDING_KEY)
    setOnboardingDone(false)
  }, [])

  const signOut = useCallback(async () => {
    await localDb.flush()
    localStorage.removeItem(LOCAL_SESSION_KEY)
    setUser(null)
    setProfile(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      isLocalMode: true as const,
      onboardingDone,
      startWorkspace,
      updateDisplayName,
      updatePreferences,
      markOnboardingDone,
      resetOnboarding,
      signOut,
    }),
    [
      user,
      profile,
      loading,
      onboardingDone,
      startWorkspace,
      updateDisplayName,
      updatePreferences,
      markOnboardingDone,
      resetOnboarding,
      signOut,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function useUserId(): string | null {
  const { user } = useAuth()
  return user?.id ?? null
}
