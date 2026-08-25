/** True when running as an installed home-screen app (iOS Safari PWA). */
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false
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

export async function showLocalNotification(
  title: string,
  body: string,
  tag: string,
  href = '/',
): Promise<boolean> {
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
          // iOS ignores unknown fields; Chrome uses this to re-alert on the same tag.
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
  return typeof Notification !== 'undefined' && Notification.permission === 'granted'
}
