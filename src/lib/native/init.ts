import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'
import { patchNativeApiFetch } from '@/lib/api-origin'
import { initRevenueCat } from '@/lib/billing/revenuecat'
import { parseOAuthDeepLink } from '@/lib/integrations/oauth-popup'
import { isNativeShell } from '@/lib/native/platform'

export const OAUTH_PENDING_KEY = 'katana-oauth-pending'

/** Status bar, splash, deep-link OAuth return, and Android back button. */
export async function initNativeShell() {
  if (!isNativeShell()) return

  patchNativeApiFetch()
  void initRevenueCat()

  try {
    await SplashScreen.hide()
  } catch {
    // optional on web
  }

  try {
    if (Capacitor.getPlatform() === 'ios' || Capacitor.getPlatform() === 'android') {
      await StatusBar.setStyle({ style: Style.Light })
    }
  } catch {
    // Simulator / older OS builds may not support status bar tweaks
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
