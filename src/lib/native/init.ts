import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'
import { patchNativeApiFetch } from '@/lib/api-origin'
import { initRevenueCat } from '@/lib/billing/revenuecat'
import { isNativeShell } from '@/lib/native/platform'

/** Status bar, splash, and Android back button for the Capacitor shell. */
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
}
