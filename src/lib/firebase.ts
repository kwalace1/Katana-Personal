import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getMessaging, getToken, isSupported, type Messaging } from 'firebase/messaging'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}

export const firebaseConfigured = Boolean(
  config.apiKey &&
    config.authDomain &&
    config.projectId &&
    config.appId &&
    !config.apiKey.includes('your') &&
    config.apiKey.length > 10,
)

export const fcmVapidKey = (import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined) || ''

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null
let messaging: Messaging | null = null

if (firebaseConfigured) {
  app = initializeApp(config as Required<typeof config>)
  auth = getAuth(app)
  db = getFirestore(app)
}

export function getFirebaseAuth(): Auth {
  if (!auth) throw new Error('Cloud account isn’t set up yet. Add Firebase keys to .env — see FIREBASE_SETUP.md')
  return auth
}

export function getDb(): Firestore {
  if (!db) throw new Error('Cloud account isn’t set up yet. Add Firebase keys to .env — see FIREBASE_SETUP.md')
  return db
}

export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (!app || !firebaseConfigured) return null
  const ok = await isSupported().catch(() => false)
  if (!ok) return null
  if (!messaging) messaging = getMessaging(app)
  return messaging
}

/** Request browser permission and return an FCM token when VAPID is configured. */
export async function enableWebPush(): Promise<string | null> {
  if (!fcmVapidKey) {
    throw new Error('Add VITE_FIREBASE_VAPID_KEY to .env (Firebase Console → Project settings → Cloud Messaging).')
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null
  const msg = await getFirebaseMessaging()
  if (!msg) return null
  let reg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js')
  if (!reg) {
    reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
  }
  await navigator.serviceWorker.ready
  const token = await getToken(msg, { vapidKey: fcmVapidKey, serviceWorkerRegistration: reg })
  return token || null
}

export { app, auth, db }
