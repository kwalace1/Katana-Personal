/** Native shell detection — Capacitor / HealthKit path (Phase 4 milestone). */

import { Capacitor } from '@capacitor/core'

export function isNativeShell(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

export function nativePlatform(): 'ios' | 'android' | 'web' {
  if (!isNativeShell()) return 'web'
  const p = Capacitor.getPlatform()
  if (p === 'ios') return 'ios'
  if (p === 'android') return 'android'
  return 'web'
}

export type HealthKitSyncResult = {
  ok: boolean
  sleepAdded?: number
  workoutsAdded?: number
  message?: string
}

/** Live HealthKit sync — requires native shell (Capacitor + @capacitor-community/health). */
export async function syncHealthKitLive(_userId: string): Promise<HealthKitSyncResult> {
  if (!isNativeShell()) {
    return {
      ok: false,
      message: 'HealthKit live sync needs the native Katana app. Use Apple Health export until then.',
    }
  }
  return {
    ok: false,
    message: 'Native HealthKit plugin not wired yet — see docs/NATIVE_MOBILE.md.',
  }
}
