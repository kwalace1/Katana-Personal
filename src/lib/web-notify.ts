import { Capacitor } from '@capacitor/core'
import { isNativeShell } from '@/lib/native/platform'

/** Cached iOS/Android local-notification grant (WKWebView has no reliable Notification API). */
let nativeNotifGranted: boolean | null = null

/** True when running as an installed home-screen app (iOS Safari PWA) or Capacitor. */
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false
  if (Capacitor.isNativePlatform()) return true
  const nav = window.navigator as Navigator & { standalone?: boolean }
  if (nav.standalone) return true
  return window.matchMedia('(display-mode: standalone)').matches
}

export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function notificationIdFromTag(tag: string): number {
  let hash = 0
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) | 0
  const id = Math.abs(hash) % 2_000_000_000
  return id === 0 ? 1 : id
}

export async function refreshNativeNotificationPermission(): Promise<boolean> {
  if (!isNativeShell()) return canShowLocalNotification()
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const status = await LocalNotifications.checkPermissions()
    nativeNotifGranted = status.display === 'granted'
    return nativeNotifGranted
  } catch {
    nativeNotifGranted = false
    return false
  }
}

/** Request device permission — Capacitor Local Notifications on iOS, web Notification elsewhere. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (isNativeShell()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      let status = await LocalNotifications.checkPermissions()
      if (status.display !== 'granted') {
        status = await LocalNotifications.requestPermissions()
      }
      nativeNotifGranted = status.display === 'granted'
      return nativeNotifGranted
    } catch {
      nativeNotifGranted = false
      return false
    }
  }

  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export async function showLocalNotification(
  title: string,
  body: string,
  tag: string,
  href = '/',
): Promise<boolean> {
  if (isNativeShell()) {
    const granted = nativeNotifGranted ?? (await refreshNativeNotificationPermission())
    if (!granted) return false
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notificationIdFromTag(tag),
            title,
            body,
            extra: { href, tag },
            schedule: { at: new Date(Date.now() + 250) },
          },
        ],
      })
      return true
    } catch {
      return false
    }
  }

  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false

  const options: NotificationOptions = {
    body,
    tag,
    silent: false,
    icon: '/icons/katana-192.png',
    data: { href },
  }

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready
      await reg.showNotification(title, {
        ...options,
        ...({ renotify: true } as NotificationOptions),
      })
      return true
    }
  } catch {
    // Fall through to the page Notification constructor.
  }

  try {
    new Notification(title, options)
    return true
  } catch {
    return false
  }
}

export function canShowLocalNotification(): boolean {
  if (isNativeShell()) return nativeNotifGranted === true
  return typeof Notification !== 'undefined' && Notification.permission === 'granted'
}
