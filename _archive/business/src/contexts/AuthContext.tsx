import React, { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { supabase, isSupabaseConfigured, getSupabaseProjectUrl } from '@/lib/supabase'
import { clearOrgCache, DEFAULT_POST_LOGIN_PATH, touchLastLoginAt } from '@/lib/auth-helpers'
import { applyTrialExpiryIfNeeded } from '@/lib/trial-check'
import {
  activateDevBypass,
  clearDevBypass,
  createDevAuthState,
  hasDevCredentials,
  isDevAuthBypassEnabled,
  isDevBypassActive,
  signInWithDevCredentials,
} from '@/lib/dev-auth-bypass'
import type { User, Session, AuthError } from '@supabase/supabase-js'

// Types
export interface UserProfile {
  id: string
  organization_id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: 'owner' | 'admin' | 'member' | 'viewer'
  department: string | null
  job_title: string | null
  is_active: boolean
  last_login_at: string | null
  training_tour_completed_at?: string | null
  training_tour_progress?: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface Organization {
  id: string
  name: string
  domain: string | null
  slug: string
  subscription_tier: 'free' | 'starter' | 'professional' | 'enterprise'
  subscription_status: 'active' | 'trial' | 'suspended' | 'cancelled'
  max_users: number
  settings: Record<string, any>
  created_at: string
  updated_at: string
  trial_start_at?: string | null
  trial_end_at?: string | null
  trial_duration_days?: number | null
  /** Explicit module entitlements; when null, derived from tier or settings. */
  enabled_modules?: string[] | null
}

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  organization: Organization | null
  loading: boolean
  signInWithMicrosoft: () => Promise<void>
  signInWithDevBypass: () => Promise<void>
  isDevAuthBypassAvailable: boolean
  signUpWithEmail: (email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: (userId?: string) => Promise<void>
  hasRole: (role: string | string[]) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const initialLoadCompleteRef = useRef(false)
  const clockSkewDetectedRef = useRef(false)

  // Fetch user profile and organization
  const fetchUserData = async (userId: string, session?: Session | null) => {
    try {
      console.log('🔍 Fetching user data for:', userId)
      
      // Use provided session or get current session
      let currentSession = session
      if (!currentSession) {
        const { data: { session: fetchedSession }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) {
          console.error('❌ Session error:', sessionError)
          
          // Handle clock skew errors
          if (sessionError.message?.includes('clock') || sessionError.message?.includes('future') || sessionError.message?.includes('skew')) {
            console.error('❌ Clock skew error - device clock is out of sync')
            console.error('💡 Please sync your device clock and refresh the page')
          }
          
          setProfile(null)
          setOrganization(null)
          return
        }
        currentSession = fetchedSession
      }
      
      if (!currentSession) {
        console.error('❌ No active session')
        setProfile(null)
        setOrganization(null)
        return
      }
      
      // Ensure session access token is available
      if (!currentSession.access_token) {
        console.error('❌ No access token in session')
        setProfile(null)
        setOrganization(null)
        return
      }
      
      console.log('✅ Session active:', currentSession.user.email)

      // Fetch user profile with simpler timeout
      const { data: profileData, error: profileError } = await Promise.race([
        supabase
          .from('user_profiles')
          .select('*')
          .eq('id', userId)
          .single(),
        new Promise<{ data: null, error: { code: string, message: string } }>((resolve) => 
          setTimeout(() => resolve({ 
            data: null, 
            error: { code: 'TIMEOUT', message: 'Profile query timeout' } 
          }), 3000)
        )
      ])

      if (profileError) {
        if (profileError.code === 'PGRST116') {
          console.warn('⚠️ Profile not found - user may need to complete onboarding')
          setProfile(null)
          setOrganization(null)
          return
        }
        if (profileError.code === 'TIMEOUT' || profileError.message?.includes('timeout')) {
          console.error('❌ Profile query timed out - keeping existing data')
          return
        }
        console.error('❌ Profile fetch error:', profileError)
        return
      }

      if (!profileData) {
        console.warn('⚠️ Profile data is null')
        setProfile(null)
        setOrganization(null)
        return
      }

      console.log('✅ Profile loaded:', profileData?.email)
      setProfile(profileData as UserProfile)
      void touchLastLoginAt(userId, (profileData as UserProfile).last_login_at)

      // Fetch organization with simpler timeout
      if (profileData?.organization_id) {
        const { data: orgData, error: orgError } = await Promise.race([
          supabase
            .from('organizations')
            .select('*')
            .eq('id', profileData.organization_id)
            .single(),
          new Promise<{ data: null, error: { code: string, message: string } }>((resolve) => 
            setTimeout(() => resolve({ 
              data: null, 
              error: { code: 'TIMEOUT', message: 'Organization query timeout' } 
            }), 3000)
          )
        ])

        if (orgError) {
          if (orgError.code === 'TIMEOUT') {
            console.error('❌ Organization query timed out - keeping existing data')
          } else {
            console.error('❌ Organization fetch error:', orgError)
          }
        } else if (orgData) {
          console.log('✅ Organization loaded:', orgData?.name)
          setOrganization(orgData as Organization)
          const oid = (orgData as { id?: string }).id
          if (oid) void applyTrialExpiryIfNeeded(oid)
        } else {
          setOrganization(null)
        }
      } else {
        console.warn('⚠️ No organization_id in profile')
        setOrganization(null)
      }
    } catch (error) {
      console.error('❌ Error fetching user data:', error)
    }
  }

  // Initialize auth state - simplified version
  useEffect(() => {
    console.log('🚀 AuthContext initializing...')
    let isMounted = true
    
    // Reset flags
    initialLoadCompleteRef.current = false
    clockSkewDetectedRef.current = false
    
    const applyDevBypassSession = () => {
      const dev = createDevAuthState()
      setSession(dev.session)
      setUser(dev.user)
      setProfile(dev.profile)
      setOrganization(dev.organization)
      setLoading(false)
      initialLoadCompleteRef.current = true
    }

    const initAuth = async () => {
      try {
        console.log('⏱️ Starting getSession...')
        const { data: { session }, error } = await supabase.auth.getSession()
        console.log('✅ getSession completed', session?.user?.email || 'no session')
        
        if (!isMounted) return
        
        if (error) {
          console.error('❌ Error getting session:', error)
          // Clear state on error
          setSession(null)
          setUser(null)
          setProfile(null)
          setOrganization(null)
          setLoading(false)
          initialLoadCompleteRef.current = true
          return
        }
        
        if (session?.user) {
          console.log('✅ Session found:', session.user.email)
          setSession(session)
          setUser(session.user)
          
          // Fetch user profile data
          try {
            await fetchUserData(session.user.id, session)
          } catch (fetchError) {
            console.error('❌ Error fetching user data:', fetchError)
          }
        } else {
          console.log('⚠️ No session found')
          setSession(null)
          setUser(null)
        }
        
        setLoading(false)
        initialLoadCompleteRef.current = true
      } catch (error) {
        console.error('❌ Error in initAuth:', error)
        if (isMounted) {
          setSession(null)
          setUser(null)
          setProfile(null)
          setOrganization(null)
          setLoading(false)
          initialLoadCompleteRef.current = true
        }
      }
    }

    if (isDevAuthBypassEnabled() && isDevBypassActive() && hasDevCredentials()) {
      void (async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) {
            const err = await signInWithDevCredentials()
            if (err) console.error('Dev sign-in failed:', err.message)
          }
        } catch (e) {
          console.error('Dev sign-in error:', e)
        }
        if (isMounted) await initAuth()
      })()
    } else if (isDevAuthBypassEnabled() && isDevBypassActive()) {
      console.warn('⚠️ Dev auth bypass — mock session only. Set VITE_DEV_EMAIL/PASSWORD for database access.')
      applyDevBypassSession()
    } else if (!isSupabaseConfigured) {
      console.warn('⚠️ Database not configured - skipping auth')
      setLoading(false)
      initialLoadCompleteRef.current = true
    } else {
      initAuth()
    }

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return
      
      console.log('🔄 Auth state changed:', event, session?.user?.email)
      
      // Handle SIGNED_OUT event immediately
      if (event === 'SIGNED_OUT') {
        console.log('⚠️ User signed out - clearing state')
        setSession(null)
        setUser(null)
        setProfile(null)
        setOrganization(null)
        setLoading(false)
        initialLoadCompleteRef.current = true
        return
      }
      
      // Handle sign-in / sign-up (email password or OAuth callback)
      if ((event === 'SIGNED_IN' || (event as string) === 'SIGNED_UP') && session?.user) {
        console.log('✅ User authenticated:', event, session.user.email)
        setSession(session)
        setUser(session.user)
        
        try {
          await fetchUserData(session.user.id, session)
        } catch (fetchError) {
          console.error('❌ Error fetching user data on sign in:', fetchError)
        }
        
        // Fetch Microsoft avatar using Edge Function (app credentials)
        const userMetadata = session.user.user_metadata
        if (userMetadata?.custom_claims?.oid) {
          console.log('📸 Fetching Microsoft avatar via Edge Function...')
          fetchAndSaveMicrosoftAvatar(session.user.id, userMetadata)
            .catch(err => console.error('❌ Background avatar fetch failed:', err))
        }
        
        setLoading(false)
        initialLoadCompleteRef.current = true
        return
      }
      
      // Handle TOKEN_REFRESHED event — update session ref but avoid re-render if user is the same
      if (event === 'TOKEN_REFRESHED' && session) {
        console.log('✅ Token refreshed')
        setSession((prev) => {
          if (prev?.access_token === session.access_token) return prev
          return session
        })
        setUser((prev) => {
          if (prev?.id === session.user.id && prev?.updated_at === session.user.updated_at) return prev
          return session.user
        })
        return
      }
      
      // Handle INITIAL_SESSION - only if we haven't completed initial load yet
      if (event === 'INITIAL_SESSION') {
        // This is already handled by initAuth(), so skip if we already processed it
        if (initialLoadCompleteRef.current) {
          return
        }
        
        if (session?.user) {
          setSession(session)
          setUser(session.user)
          try {
            await fetchUserData(session.user.id, session)
          } catch (fetchError) {
            console.error('❌ Error fetching user data:', fetchError)
          }
        } else {
          setSession(null)
          setUser(null)
        }
        
        setLoading(false)
        initialLoadCompleteRef.current = true
        return
      }
      
      // For USER_UPDATED, refresh profile data (e.g. metadata changed)
      if (event === 'USER_UPDATED' && session?.user) {
        setSession((prev) => {
          if (prev?.access_token === session.access_token) return prev
          return session
        })
        setUser((prev) => {
          if (prev?.id === session.user.id && prev?.updated_at === session.user.updated_at) return prev
          return session.user
        })
        try {
          await fetchUserData(session.user.id, session)
        } catch (fetchError) {
          console.error('❌ Error fetching user data on USER_UPDATED:', fetchError)
        }
        return
      }

      // Ignore all other events (MFA_CHALLENGE_VERIFIED, PASSWORD_RECOVERY, etc.)
      // to avoid unnecessary re-renders and data refetches
      console.log('ℹ️ Ignoring auth event:', event)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  // Fetch Microsoft profile photo via Edge Function (uses app credentials)
  const fetchAndSaveMicrosoftAvatar = async (userId: string, userMetadata: any) => {
    try {
      console.log('📸 Fetching Microsoft profile photo via Edge Function...')
      
      // Get the Microsoft OID and Tenant ID from user metadata
      const microsoftOid = userMetadata?.custom_claims?.oid
      const tenantId = userMetadata?.custom_claims?.tid
      
      if (!microsoftOid || !tenantId) {
        console.warn('⚠️ Missing Microsoft OID or Tenant ID in user metadata')
        console.log('User metadata:', userMetadata)
        return null
      }
      
      console.log('📸 Microsoft OID:', microsoftOid)
      console.log('📸 Tenant ID:', tenantId)
      
      // Call the Edge Function
      const { data, error } = await supabase.functions.invoke('fetch-microsoft-avatar', {
        body: {
          user_id: userId,
          microsoft_oid: microsoftOid,
          tenant_id: tenantId,
        },
      })
      
      if (error) {
        console.error('❌ Edge Function error:', error)
        // Try to get more details
        if (error.context) {
          try {
            const errorBody = await error.context.json()
            console.error('❌ Error details:', errorBody)
          } catch (e) {
            console.error('❌ Could not parse error body')
          }
        }
        return null
      }
      
      if (data?.success && data?.avatar_url) {
        console.log('✅ Avatar fetched successfully:', data.avatar_url)
        // Update local profile state
        setProfile(prev => prev ? { ...prev, avatar_url: data.avatar_url } : null)
        return data.avatar_url
      } else if (data?.message) {
        console.log('ℹ️', data.message)
        return null
      } else {
        console.error('❌ Unexpected response:', data)
        return null
      }
    } catch (error) {
      console.error('❌ Error fetching Microsoft avatar:', error)
      return null
    }
  }

  const signInWithDevBypass = useCallback(async () => {
    if (!isDevAuthBypassEnabled()) return

    activateDevBypass()
    clearOrgCache()

    if (hasDevCredentials()) {
      const err = await signInWithDevCredentials()
      if (err) {
        clearDevBypass()
        throw new Error(err.message)
      }
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setSession(session)
        setUser(session.user)
        await fetchUserData(session.user.id, session)
        setLoading(false)
        initialLoadCompleteRef.current = true
      }
      return
    }

    console.warn('⚠️ Dev bypass: no VITE_DEV_EMAIL/PASSWORD — UI only, database writes disabled.')
    const dev = createDevAuthState()
    setSession(dev.session)
    setUser(dev.user)
    setProfile(dev.profile)
    setOrganization(dev.organization)
    setLoading(false)
    initialLoadCompleteRef.current = true
  }, [])

  const signInWithMicrosoft = useCallback(async () => {
    if (!isSupabaseConfigured) {
      const projectUrl = getSupabaseProjectUrl()
      const message = projectUrl.includes('your-project-ref')
        ? 'Sign-in is using a placeholder Supabase URL. Hard-refresh this page (Cmd+Shift+R) or open a new tab at http://localhost:3001 after updating .env and restarting npm run dev.'
        : 'Sign-in is not configured. Copy .env.example to .env and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the dev server.'
      console.error(message, { projectUrl })
      throw new Error(message)
    }
    try {
      // skipBrowserRedirect + assign: clearer errors if OAuth URL is missing,
      // and avoids relying solely on the SDK's implicit navigation.
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          scopes: 'email openid profile User.Read',
          redirectTo: `${window.location.origin}${DEFAULT_POST_LOGIN_PATH}`,
          skipBrowserRedirect: true,
          queryParams: {
            prompt: 'select_account',
          },
        },
      })
      if (error) throw error
      if (!data?.url) {
        throw new Error('Microsoft sign-in did not return an authorize URL. Check Azure is enabled in Supabase Auth → Providers.')
      }
      window.location.assign(data.url)
    } catch (error) {
      console.error('Error signing in with Microsoft:', error)
      throw error
    }
  }, [])

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.origin + DEFAULT_POST_LOGIN_PATH },
      })
      if (error) throw error

      if (data.session?.user) {
        setSession(data.session)
        setUser(data.session.user)
        await fetchUserData(data.session.user.id, data.session)
        setLoading(false)
        initialLoadCompleteRef.current = true
        return { needsEmailConfirmation: false }
      }

      return { needsEmailConfirmation: true }
    } catch (error) {
      console.error('Error signing up with email:', error)
      throw error
    }
  }, [])

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) throw error

      if (data.session?.user) {
        setSession(data.session)
        setUser(data.session.user)
        await fetchUserData(data.session.user.id, data.session)
        setLoading(false)
        initialLoadCompleteRef.current = true
      }
    } catch (error) {
      console.error('Error signing in with email:', error)
      throw error
    }
  }, [])

  const signOut = useCallback(async () => {
    if (isDevBypassActive()) {
      clearDevBypass()
      clearOrgCache()
      if (hasDevCredentials()) {
        await supabase.auth.signOut()
      }
      setUser(null)
      setSession(null)
      setProfile(null)
      setOrganization(null)
      return
    }
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      clearOrgCache()
      setUser(null)
      setSession(null)
      setProfile(null)
      setOrganization(null)
    } catch (error) {
      console.error('Error signing out:', error)
      throw error
    }
  }, [])

  const refreshProfile = useCallback(async (userId?: string) => {
    const id = userId ?? user?.id
    if (id) {
      await fetchUserData(id)
    }
  }, [user])

  const hasRole = useCallback((role: string | string[]): boolean => {
    if (!profile) return false
    if (Array.isArray(role)) return role.includes(profile.role)
    return profile.role === role
  }, [profile])

  const value = useMemo<AuthContextType>(() => ({
    user,
    session,
    profile,
    organization,
    loading,
    signInWithMicrosoft,
    signInWithDevBypass,
    isDevAuthBypassAvailable: isDevAuthBypassEnabled(),
    signUpWithEmail,
    signInWithEmail,
    signOut,
    refreshProfile,
    hasRole,
  }), [user, session, profile, organization, loading, signInWithMicrosoft, signInWithDevBypass, signUpWithEmail, signInWithEmail, signOut, refreshProfile, hasRole])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Protected route component
interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: string | string[]
  fallback?: React.ReactNode
}

export function ProtectedRoute({ children, requiredRole, fallback }: ProtectedRouteProps) {
  const { user, profile, loading, hasRole } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user) {
    return fallback || (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
          <p className="text-muted-foreground mb-4">Please sign in to access this page.</p>
        </div>
      </div>
    )
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return fallback || (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

