import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'
import { patchNativeApiFetch } from '@/lib/api-origin'
import { initRevenueCat } from '@/lib/billing/revenuecat'
import { parseOAuthDeepLink } from '@/lib/integrations/oauth-popup'
import { isNativeShell } from '@/lib/native/platform'
import { refreshNativeNotificationPermission } from '@/lib/web-notify'
import { initKeyboardInset } from '@/lib/native/keyboard'

export const OAUTH_PENDING_KEY = 'katana-oauth-pending'

/** Status bar, splash, deep-link OAuth return, and Android back button. */
export async function initNativeShell() {
  if (!isNativeShell()) return

  patchNativeApiFetch()
  void initRevenueCat()
  void refreshNativeNotificationPermission()
  void initKeyboardInset()

  try {
    await SplashScreen.hide()
  } catch {
    // optional on web
  }

  try {
    if (Capacitor.getPlatform() === 'ios' || Capacitor.getPlatform() === 'android') {
      // Overlay so the WebView fills under the status bar (no native black gap).
      await StatusBar.setOverlaysWebView({ overlay: true })
      await StatusBar.setBackgroundColor({ color: '#F4F8F9' })
      await StatusBar.setStyle({ style: Style.Light })
    }
  } catch {
    // Simulator / older OS builds may not support status bar tweaks
  }

  try {
    if (isNativeShell()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      await LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
        const href = (event.notification.extra as { href?: string } | undefined)?.href
        if (href && typeof href === 'string' && href.startsWith('/')) {
          window.location.assign(href)
        }
      })
    }
  } catch {
    // Plugin may be missing until `cap sync`
  }

  CapApp.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back()
    else void CapApp.exitApp()
  })

  CapApp.addListener('appUrlOpen', ({ url }) => {
    void handleOAuthDeepLink(url)
  })

  // Cold start from a deep link
  try {
    const launch = await CapApp.getLaunchUrl()
    if (launch?.url) void handleOAuthDeepLink(launch.url)
  } catch {
    // ignore
  }
}

async function handleOAuthDeepLink(url: string) {
  const payload = parseOAuthDeepLink(url)
  if (!payload) return

  try {
    const { Browser } = await import('@capacitor/browser')
    await Browser.close()
  } catch {
    // Browser may already be closed
  }

  try {
    sessionStorage.setItem(OAUTH_PENDING_KEY, JSON.stringify(payload))
  } catch {
    // ignore
  }

  const path = window.location.pathname
  if (path.startsWith('/settings/connections')) {
    window.dispatchEvent(new CustomEvent('katana-oauth-pending'))
  } else {
    window.location.assign('/settings/connections')
  }
}
