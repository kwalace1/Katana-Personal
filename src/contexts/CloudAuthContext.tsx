import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  OAuthProvider,
  signInWithPopup,
  type User,
} from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { enableWebPush, firebaseConfigured, appleAuthEnabled, getDb, getFirebaseAuth } from '@/lib/firebase'
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

interface CloudAuthContextType {
  cloudEnabled: boolean
  /** Soft launch: Apple only when VITE_FIREBASE_APPLE_AUTH=true */
  appleSignInAvailable: boolean
  cloudUser: User | null
  cloudProfile: CloudProfile | null
  cloudLoading: boolean
  signUpCloud: (email: string, password: string, displayName: string) => Promise<void>
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

export function CloudAuthProvider({ children }: { children: React.ReactNode }) {
  const { user: localUser, profile: localProfile, updateDisplayName } = useAuth()
  const [cloudUser, setCloudUser] = useState<User | null>(null)
  const [cloudProfile, setCloudProfile] = useState<CloudProfile | null>(null)
  const [cloudLoading, setCloudLoading] = useState(firebaseConfigured)
  const localNameRef = React.useRef(localProfile?.display_name)
  localNameRef.current = localProfile?.display_name

  useEffect(() => {
    if (!firebaseConfigured) {
      setCloudLoading(false)
      return
    }
    const auth = getFirebaseAuth()
    const unsub = onAuthStateChanged(auth, async (u) => {
      setCloudUser(u)
      if (!u) {
        setCloudProfile(null)
        setCloudLoading(false)
        return
      }
      try {
        const email = u.email || ''
        const localName = localNameRef.current
        const seedName = pickBestDisplayName({
          authName: u.displayName,
          localName,
          email,
          fallback: 'Friend',
        })
        let profile = await ensureCloudProfile({
          uid: u.uid,
          email,
          displayName: seedName,
        })

        // Only upgrade placeholder cloud names (e.g. email local-part) to a real name
        const cloudUpgrade = upgradePlaceholderName(
          profile.displayName,
          pickBestDisplayName({ authName: u.displayName, localName, email }),
          email,
        )
        if (cloudUpgrade) {
          await updateCloudProfile(u.uid, { displayName: cloudUpgrade })
          profile = { ...profile, displayName: cloudUpgrade }
        }

        if (
          profile.displayName &&
          u.displayName !== profile.displayName &&
          (isPlaceholderDisplayName(u.displayName, email) || !u.displayName)
        ) {
          await updateProfile(u, { displayName: profile.displayName })
        }

        setCloudProfile(profile)

        const localUpgrade = upgradePlaceholderName(localName, profile.displayName, email)
        if (localUpgrade) {
          updateDisplayName(localUpgrade)
        }
      } catch (err) {
        console.warn('Cloud profile error', err)
      } finally {
        setCloudLoading(false)
      }
    })
    return () => unsub()
  }, [updateDisplayName])

  const signUpCloud = useCallback(async (email: string, password: string, displayName: string) => {
    const auth = getFirebaseAuth()
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
    await updateProfile(cred.user, { displayName: displayName.trim() || 'Friend' })
    const profile = await ensureCloudProfile({
      uid: cred.user.uid,
      email: email.trim(),
      displayName: displayName.trim() || 'Friend',
    })
    setCloudProfile(profile)
    updateDisplayName(profile.displayName)
  }, [updateDisplayName])

  const signInCloud = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password)
  }, [])

  const signInWithApple = useCallback(async () => {
    const auth = getFirebaseAuth()
    const provider = new OAuthProvider('apple.com')
    provider.addScope('email')
    provider.addScope('name')
    const cred = await signInWithPopup(auth, provider)
    const email = cred.user.email || ''
    const name = pickBestDisplayName({
      authName: cred.user.displayName,
      localName: localProfile?.display_name,
      email,
      fallback: 'Friend',
    })
    if (cred.user.displayName !== name) {
      await updateProfile(cred.user, { displayName: name })
    }
    let profile = await ensureCloudProfile({
      uid: cred.user.uid,
      email,
      displayName: name,
    })
    if (profile.displayName !== name && !isPlaceholderDisplayName(name, email)) {
      await updateCloudProfile(cred.user.uid, { displayName: name })
      profile = { ...profile, displayName: name }
    }
    setCloudProfile(profile)
    updateDisplayName(profile.displayName)
  }, [localProfile?.display_name, updateDisplayName])

  const signOutCloud = useCallback(async () => {
    if (!firebaseConfigured) return
    await firebaseSignOut(getFirebaseAuth())
    setCloudProfile(null)
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
      await updateProfile(cloudUser, { displayName: next })
      await updateCloudProfile(cloudUser.uid, { displayName: next })
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
    const token = await enableWebPush()
    if (!token) return false
    await setDoc(
      doc(getDb(), 'pushTokens', cloudUser.uid),
      {
        uid: cloudUser.uid,
        token,
        updatedAt: new Date().toISOString(),
        platform: 'web',
      },
      { merge: true },
    )
    return true
  }, [cloudUser])

  const value = useMemo(
    () => ({
      cloudEnabled: firebaseConfigured,
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
