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
import { enableWebPush, firebaseConfigured, getDb, getFirebaseAuth } from '@/lib/firebase'
import {
  ensureCloudProfile,
  getCloudProfile,
  updateCloudProfile,
} from '@/lib/social/friends'
import { DEFAULT_SHARE_PREFS, type CloudProfile, type SharePrefs } from '@/lib/social/types'
import { publishStreaks } from '@/lib/social/streaks'
import { useAuth } from '@/contexts/AuthContext'

interface CloudAuthContextType {
  cloudEnabled: boolean
  cloudUser: User | null
  cloudProfile: CloudProfile | null
  cloudLoading: boolean
  signUpCloud: (email: string, password: string, displayName: string) => Promise<void>
  signInCloud: (email: string, password: string) => Promise<void>
  signInWithApple: () => Promise<void>
  signOutCloud: () => Promise<void>
  refreshCloudProfile: () => Promise<void>
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
        const profile = await ensureCloudProfile({
          uid: u.uid,
          email: u.email || '',
          displayName: u.displayName || localProfile?.display_name || 'Friend',
        })
        setCloudProfile(profile)
        if (profile.displayName && localProfile && !localProfile.display_name) {
          updateDisplayName(profile.displayName)
        }
      } catch (err) {
        console.warn('Cloud profile error', err)
      } finally {
        setCloudLoading(false)
      }
    })
    return () => unsub()
  }, [localProfile, updateDisplayName])

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
    const name =
      cred.user.displayName ||
      localProfile?.display_name ||
      cred.user.email?.split('@')[0] ||
      'Friend'
    if (!cred.user.displayName) {
      await updateProfile(cred.user, { displayName: name })
    }
    const profile = await ensureCloudProfile({
      uid: cred.user.uid,
      email: cred.user.email || '',
      displayName: name,
    })
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
      cloudUser,
      cloudProfile,
      cloudLoading,
      signUpCloud,
      signInCloud,
      signInWithApple,
      signOutCloud,
      refreshCloudProfile,
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
