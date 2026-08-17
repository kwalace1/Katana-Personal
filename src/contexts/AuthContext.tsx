import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createId } from '@/lib/id'
import { broadcastLocalRefresh } from '@/hooks/useLocalRefresh'
import {
  decideCloudWorkspaceAdopt,
  markFreshCloudWorkspace,
  readCloudWorkspaceMap,
  rememberBoundSession,
} from '@/lib/cloud-workspace'
import { ensureUserLoaded, initLocalDb, localDb } from '@/lib/local-db'
import { localWorkspaceHasData } from '@/lib/workspace-sync'

const LOCAL_SESSION_KEY = 'katana-personal:local-session'
const ONBOARDING_KEY = 'katana-personal:onboarding-done'
const RITUAL_STEP_KEY = 'katana-personal:ritual-step'
const CAPTURED_KEY = 'katana-personal:captured-once'

/** Returning users (data, prior capture, or restored session) should never be locked in First Minute. */
export function inferOnboardingComplete(userId: string | null | undefined): boolean {
  try {
    if (localStorage.getItem(ONBOARDING_KEY) === '1') return true
    if (localStorage.getItem(CAPTURED_KEY) === '1') return true
  } catch {
    // ignore
  }
  if (!userId) return false
  try {
    return localWorkspaceHasData(userId)
  } catch {
    return false
  }
}


export interface UserProfile {
  id: string
  display_name: string
  preferences: Record<string, unknown>
  created_at: string
  updated_at: string
  bound_cloud_uid?: string
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
  adoptCloudWorkspace: (
    cloudUid: string,
    displayName?: string,
    options?: { forceBind?: boolean; forceFresh?: boolean },
  ) => Promise<'noop' | 'restore' | 'bind-current' | 'create-fresh' | 'pending-bind'>
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
  bound_cloud_uid?: string
}

function toProfile(raw: StoredSession): UserProfile {
  const now = new Date().toISOString()
  return {
    id: raw.id,
    display_name: raw.display_name || 'You',
    preferences: raw.preferences || {},
    created_at: raw.created_at || now,
    updated_at: raw.updated_at || now,
    bound_cloud_uid: raw.bound_cloud_uid,
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
  const sessionRef = useRef<StoredSession | null>(null)

  const applySession = useCallback((session: StoredSession | null) => {
    sessionRef.current = session
    if (!session) {
      setUser(null)
      setProfile(null)
      return
    }
    persist(session)
    rememberBoundSession(session)
    setUser({ id: session.id })
    setProfile(toProfile(session))
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        await initLocalDb()
        const raw = localStorage.getItem(LOCAL_SESSION_KEY)
        let userId: string | null = null
        if (raw) {
          const parsed = JSON.parse(raw) as StoredSession
          await ensureUserLoaded(parsed.id)
          if (!mounted) return
          userId = parsed.id
          sessionRef.current = parsed
          setUser({ id: parsed.id })
          setProfile(toProfile(parsed))
        }
        if (mounted) {
          const done = inferOnboardingComplete(userId)
          if (done) {
            try {
              localStorage.setItem(ONBOARDING_KEY, '1')
              localStorage.removeItem(RITUAL_STEP_KEY)
            } catch {
              // ignore
            }
          }
          setOnboardingDone(done)
        }
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

  // After cloud pull / later data lands, escape First Minute for returning accounts.
  useEffect(() => {
    if (!user?.id || onboardingDone || loading) return
    if (!inferOnboardingComplete(user.id)) return
    try {
      localStorage.setItem(ONBOARDING_KEY, '1')
      localStorage.removeItem(RITUAL_STEP_KEY)
    } catch {
      // ignore
    }
    setOnboardingDone(true)
  }, [user?.id, onboardingDone, loading])

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
      await ensureUserLoaded(session.id)
      applySession(session)
    },
    [applySession],
  )

  const adoptCloudWorkspace = useCallback(
    async (
      cloudUid: string,
      displayName?: string,
      options?: { forceBind?: boolean; forceFresh?: boolean },
    ) => {
      const current = sessionRef.current
      const map = readCloudWorkspaceMap()
      const mapped = map[cloudUid] ?? null
      const action = options?.forceFresh
        ? 'create-fresh'
        : options?.forceBind
          ? current
            ? 'bind-current'
            : 'create-fresh'
          : decideCloudWorkspaceAdopt({ cloudUid, current, mapped })

      if (action === 'bind-current' && current && !options?.forceBind && localWorkspaceHasData(current.id)) {
        return 'pending-bind' as const
      }

      if (action === 'noop') {
        if (current && current.bound_cloud_uid !== cloudUid) {
          applySession({ ...current, bound_cloud_uid: cloudUid, updated_at: new Date().toISOString() })
        }
        return action
      }

      if (action === 'restore' && mapped) {
        rememberBoundSession(current)
        await ensureUserLoaded(mapped.id)
        applySession({ ...mapped, bound_cloud_uid: cloudUid })
        broadcastLocalRefresh()
        return action
      }

      if (action === 'bind-current' && current) {
        applySession({
          ...current,
          bound_cloud_uid: cloudUid,
          updated_at: new Date().toISOString(),
        })
        return action
      }

      rememberBoundSession(current)
      markFreshCloudWorkspace(cloudUid)
      const now = new Date().toISOString()
      const session: StoredSession = {
        id: createId(),
        display_name: displayName?.trim() || 'You',
        preferences: {},
        created_at: now,
        updated_at: now,
        bound_cloud_uid: cloudUid,
      }
      await ensureUserLoaded(session.id)
      applySession(session)
      try {
        localStorage.removeItem(ONBOARDING_KEY)
        localStorage.removeItem(RITUAL_STEP_KEY)
      } catch {
        // ignore
      }
      setOnboardingDone(false)
      broadcastLocalRefresh()
      return 'create-fresh' as const
    },
    [applySession],
  )

  const updateDisplayName = useCallback(
    (name: string) => {
      const current = sessionRef.current
      if (!current) return
      applySession({
        ...current,
        display_name: name.trim() || 'You',
        updated_at: new Date().toISOString(),
      })
    },
    [applySession],
  )

  const updatePreferences = useCallback(
    (patch: Record<string, unknown>) => {
      const current = sessionRef.current
      if (!current) return
      applySession({
        ...current,
        preferences: { ...current.preferences, ...patch },
        updated_at: new Date().toISOString(),
      })
    },
    [applySession],
  )

  const markOnboardingDone = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, '1')
    localStorage.removeItem(RITUAL_STEP_KEY)
    setOnboardingDone(true)
  }, [])

  const resetOnboarding = useCallback(() => {
    localStorage.removeItem(ONBOARDING_KEY)
    localStorage.removeItem(RITUAL_STEP_KEY)
    setOnboardingDone(false)
  }, [])

  const signOut = useCallback(async () => {
    await localDb.flush()
    rememberBoundSession(sessionRef.current)
    localStorage.removeItem(LOCAL_SESSION_KEY)
    sessionRef.current = null
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
      adoptCloudWorkspace,
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
      adoptCloudWorkspace,
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
