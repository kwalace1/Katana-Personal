import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { cloudEmailRedirectTo, mapCloudAuthError } from '@/lib/auth-callback'
import {
  appleAuthEnabled,
  getSupabase,
  supabaseConfigured,
  toCloudUser,
  type CloudUser,
} from '@/lib/supabase'
import {
  ensureCloudProfile,
  getCloudProfile,
  updateCloudProfile,
} from '@/lib/social/friends'
import { isPlaceholderDisplayName, pickBestDisplayName, upgradePlaceholderName } from '@/lib/social/display-name'
import { DEFAULT_SHARE_PREFS, type CloudProfile, type SharePrefs } from '@/lib/social/types'
import { publishActivity, publishStreaks } from '@/lib/social/streaks'
import { registerActivityPing, registerStreakSync } from '@/lib/social/streak-sync'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { urlBase64ToUint8Array } from '@/lib/web-notify'

interface CloudAuthContextType {
  cloudEnabled: boolean
  /** Soft launch: Apple only when VITE_SUPABASE_APPLE_AUTH=true */
  appleSignInAvailable: boolean
  cloudUser: CloudUser | null
  cloudProfile: CloudProfile | null
  cloudLoading: boolean
  signUpCloud: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<{ needsEmailConfirmation: boolean }>
  signInCloud: (email: string, password: string) => Promise<void>
  signInWithApple: () => Promise<void>
  signOutCloud: () => Promise<void>
  refreshCloudProfile: () => Promise<void>
  saveDisplayName: (name: string) => Promise<void>
  saveSharePrefs: (prefs: SharePrefs) => Promise<void>
  syncStreaksToCloud: () => Promise<void>
  enablePushNotifications: () => Promise<boolean>
}

const CloudAuthContext = createContext<CloudAuthContextType | undefined>(undefined)

async function loadOrCreateProfile(
  cloudUser: CloudUser,
  localName: string | undefined,
  updateDisplayName: (name: string) => void,
): Promise<CloudProfile> {
  const email = cloudUser.email || ''
  const seedName = pickBestDisplayName({
    authName: cloudUser.displayName,
    localName,
    email,
    fallback: 'Friend',
  })
  let profile = await ensureCloudProfile({
    uid: cloudUser.uid,
    email,
    displayName: seedName,
  })

  const cloudUpgrade = upgradePlaceholderName(
    profile.displayName,
    pickBestDisplayName({ authName: cloudUser.displayName, localName, email }),
    email,
  )
  if (cloudUpgrade) {
    await updateCloudProfile(cloudUser.uid, { displayName: cloudUpgrade })
    profile = { ...profile, displayName: cloudUpgrade }
  }

  if (
    profile.displayName &&
    cloudUser.displayName !== profile.displayName &&
    (isPlaceholderDisplayName(cloudUser.displayName, email) || !cloudUser.displayName)
  ) {
    await getSupabase().auth.updateUser({
      data: { display_name: profile.displayName },
    })
  }

  const localUpgrade = upgradePlaceholderName(localName, profile.displayName, email)
  if (localUpgrade) {
    updateDisplayName(localUpgrade)
  }

  return profile
}

export function CloudAuthProvider({ children }: { children: React.ReactNode }) {
  const { user: localUser, profile: localProfile, updateDisplayName, adoptCloudWorkspace } = useAuth()
  const [cloudUser, setCloudUser] = useState<CloudUser | null>(null)
  const [cloudProfile, setCloudProfile] = useState<CloudProfile | null>(null)
  const [cloudLoading, setCloudLoading] = useState(supabaseConfigured)
  const localNameRef = React.useRef(localProfile?.display_name)
  const prevCloudUserRef = React.useRef<CloudUser | null | undefined>(undefined)
  localNameRef.current = localProfile?.display_name

  useEffect(() => {
    if (cloudLoading) return
    if (prevCloudUserRef.current === undefined) {
      prevCloudUserRef.current = cloudUser
      return
    }
    if (!prevCloudUserRef.current && cloudUser) {
      toast.success('Connected', {
        description: 'Only what you choose to share. Private life stays on this device.',
      })
    }
    prevCloudUserRef.current = cloudUser
  }, [cloudUser, cloudLoading])

  useEffect(() => {
    if (!supabaseConfigured) {
      setCloudLoading(false)
      return
    }
    const supabase = getSupabase()

    void supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session
      if (!session?.user) {
        setCloudUser(null)
        setCloudProfile(null)
        setCloudLoading(false)
        return
      }
      const cu = toCloudUser(session.user)
      await adoptCloudWorkspace(cu.uid, cu.displayName || undefined)
      setCloudUser(cu)
      try {
        const profile = await loadOrCreateProfile(cu, cu.displayName || localNameRef.current, updateDisplayName)
        setCloudProfile(profile)
      } catch (err) {
        console.warn('Cloud profile error', err)
      } finally {
        setCloudLoading(false)
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') return
      if (!session?.user) {
        setCloudUser(null)
        setCloudProfile(null)
        setCloudLoading(false)
        return
      }
      const cu = toCloudUser(session.user)
      await adoptCloudWorkspace(cu.uid, cu.displayName || undefined)
      setCloudUser(cu)
      try {
        const profile = await loadOrCreateProfile(cu, cu.displayName || localNameRef.current, updateDisplayName)
        setCloudProfile(profile)
      } catch (err) {
        console.warn('Cloud profile error', err)
      } finally {
        setCloudLoading(false)
      }
    })

    return () => {
      sub.subscription.unsubscribe()
    }
  }, [adoptCloudWorkspace, updateDisplayName])

  const signUpCloud = useCallback(async (email: string, password: string, displayName: string) => {
    const supabase = getSupabase()
    const name = displayName.trim() || 'Friend'
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { display_name: name },
        emailRedirectTo: cloudEmailRedirectTo(),
      },
    })
    if (error) throw new Error(mapCloudAuthError(error))
    if (!data.user) throw new Error('Sign-up failed.')
    // Existing accounts get a fake user with no identities; a real new user always has one.
    if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error('This email already has an account. Use Sign in instead.')
    }
    // Confirm-email is on: user exists but there is no session yet. Profile insert
    // requires auth, so wait until they open the email link.
    if (!data.session) {
      return { needsEmailConfirmation: true }
    }
    const cu = toCloudUser({ ...data.user, user_metadata: { display_name: name } })
    const adopted = await adoptCloudWorkspace(cu.uid, name)
    const profile = await ensureCloudProfile({
      uid: cu.uid,
      email: email.trim(),
      displayName: name,
    })
    setCloudUser(cu)
    setCloudProfile(profile)
    if (adopted !== 'pending-bind') {
      updateDisplayName(profile.displayName)
    }
    return { needsEmailConfirmation: false }
  }, [adoptCloudWorkspace, updateDisplayName])

  const signInCloud = useCallback(async (email: string, password: string) => {
    const { data, error } = await getSupabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) throw new Error(mapCloudAuthError(error))
    if (data.user) {
      const cu = toCloudUser(data.user)
      await adoptCloudWorkspace(cu.uid, cu.displayName || undefined)
    }
  }, [adoptCloudWorkspace])

  const signInWithApple = useCallback(async () => {
    const { error } = await getSupabase().auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    })
    if (error) throw error
  }, [])

  const signOutCloud = useCallback(async () => {
    if (!supabaseConfigured) return
    await getSupabase().auth.signOut()
    setCloudProfile(null)
    setCloudUser(null)
  }, [])

  const refreshCloudProfile = useCallback(async () => {
    if (!cloudUser) return
    const profile = await getCloudProfile(cloudUser.uid)
    if (profile) setCloudProfile(profile)
  }, [cloudUser])

  const saveDisplayName = useCallback(
    async (raw: string) => {
      const next = raw.trim() || 'Friend'
      updateDisplayName(next)
      if (!cloudUser) return
      await getSupabase().auth.updateUser({ data: { display_name: next } })
      await updateCloudProfile(cloudUser.uid, { displayName: next })
      setCloudUser((u) => (u ? { ...u, displayName: next } : u))
      setCloudProfile((p) => (p ? { ...p, displayName: next } : p))
    },
    [cloudUser, updateDisplayName],
  )

  const saveSharePrefs = useCallback(
    async (prefs: SharePrefs) => {
      if (!cloudUser) throw new Error('Sign in to the cloud first.')
      await updateCloudProfile(cloudUser.uid, { sharePrefs: prefs })
      setCloudProfile((p) => (p ? { ...p, sharePrefs: prefs } : p))
    },
    [cloudUser],
  )

  const syncStreaksToCloud = useCallback(async () => {
    if (!cloudUser || !cloudProfile || !localUser) return
    await publishStreaks({
      cloudUid: cloudUser.uid,
      localUserId: localUser.id,
      displayName: cloudProfile.displayName,
      sharePrefs: cloudProfile.sharePrefs || DEFAULT_SHARE_PREFS,
    })
  }, [cloudUser, cloudProfile, localUser])

  useEffect(() => {
    if (!cloudUser || !cloudProfile || !localUser) {
      registerStreakSync(null)
      registerActivityPing(null)
      return
    }
    registerStreakSync(syncStreaksToCloud)
    registerActivityPing(async (message) => {
      const prefs = cloudProfile.sharePrefs || DEFAULT_SHARE_PREFS
      if (!prefs.activityFeed) return
      await publishActivity(cloudUser.uid, message)
    })
    return () => {
      registerStreakSync(null)
      registerActivityPing(null)
    }
  }, [cloudUser, cloudProfile, localUser, syncStreaksToCloud])

  const enablePushNotifications = useCallback(async () => {
    if (!cloudUser) throw new Error('Sign in to the cloud first.')
    if (typeof Notification === 'undefined') {
      throw new Error('This browser doesn’t support notifications.')
    }
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return false

    let token = `web-opt-in:${cloudUser.uid}:${Date.now()}`
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready
        const vapid = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim()
        if (vapid && 'pushManager' in reg) {
          const existing = await reg.pushManager.getSubscription()
          const sub =
            existing ||
            (await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
            }))
          token = JSON.stringify(sub.toJSON())
        }
      }
    } catch {
      // Local notifications still work from the home-screen app without a push subscription.
    }

    const { error } = await getSupabase().from('push_tokens').upsert({
      uid: cloudUser.uid,
      token,
      platform: 'web',
      updated_at: new Date().toISOString(),
    })
    if (error) throw error
    return true
  }, [cloudUser])

  const value = useMemo(
    () => ({
      cloudEnabled: supabaseConfigured,
      appleSignInAvailable: appleAuthEnabled,
      cloudUser,
      cloudProfile,
      cloudLoading,
      signUpCloud,
      signInCloud,
      signInWithApple,
      signOutCloud,
      refreshCloudProfile,
      saveDisplayName,
      saveSharePrefs,
      syncStreaksToCloud,
      enablePushNotifications,
    }),
    [
      cloudUser,
      cloudProfile,
      cloudLoading,
      signUpCloud,
      signInCloud,
      signInWithApple,
      signOutCloud,
      refreshCloudProfile,
      saveDisplayName,
      saveSharePrefs,
      syncStreaksToCloud,
      enablePushNotifications,
    ],
  )

  return <CloudAuthContext.Provider value={value}>{children}</CloudAuthContext.Provider>
}

export function useCloudAuth() {
  const ctx = useContext(CloudAuthContext)
  if (!ctx) throw new Error('useCloudAuth must be used within CloudAuthProvider')
  return ctx
}
