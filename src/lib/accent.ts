/** Accent hue helpers — recolor primary CSS tokens while keeping light/dark templates. */

export const DEFAULT_ACCENT_HUE = 172
export const ACCENT_HUE_KEY = 'katana-personal:accent-hue'

const ACCENT_PROPS = [
  '--primary',
  '--primary-foreground',
  '--accent',
  '--accent-foreground',
  '--ring',
  '--kp-glow',
] as const

export function normalizeHue(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return ((Math.round(value) % 360) + 360) % 360
}

export function readStoredAccentHue(): number | null {
  try {
    const raw = localStorage.getItem(ACCENT_HUE_KEY)
    if (raw == null || raw === '') return null
    return normalizeHue(Number(raw))
  } catch {
    return null
  }
}

export function writeStoredAccentHue(hue: number | null) {
  try {
    if (hue == null) localStorage.removeItem(ACCENT_HUE_KEY)
    else localStorage.setItem(ACCENT_HUE_KEY, String(hue))
  } catch {
    // ignore quota / private mode
  }
}

export function resolveAccentHue(prefs?: Record<string, unknown>): number | null {
  const fromPrefs = normalizeHue(prefs?.accent_hue)
  if (fromPrefs != null) return fromPrefs
  return readStoredAccentHue()
}

export function applyAccentHue(hue: number, dark: boolean) {
  const root = document.documentElement
  const h = normalizeHue(hue) ?? DEFAULT_ACCENT_HUE
  if (dark) {
    root.style.setProperty('--primary', `${h} 42% 48%`)
    root.style.setProperty('--primary-foreground', '200 25% 8%')
    root.style.setProperty('--accent', `${h} 18% 14%`)
    root.style.setProperty('--accent-foreground', `${h} 40% 78%`)
    root.style.setProperty('--ring', `${h} 42% 48%`)
    root.style.setProperty('--kp-glow', `${h} 30% 28%`)
  } else {
    root.style.setProperty('--primary', `${h} 48% 28%`)
    root.style.setProperty('--primary-foreground', '0 0% 100%')
    root.style.setProperty('--accent', `${h} 32% 92%`)
    root.style.setProperty('--accent-foreground', `${h} 48% 22%`)
    root.style.setProperty('--ring', `${h} 48% 28%`)
    root.style.setProperty('--kp-glow', `${h} 40% 70%`)
  }
}

export function clearAccentHueOverrides() {
  const root = document.documentElement
  for (const prop of ACCENT_PROPS) {
    root.style.removeProperty(prop)
  }
}

/** Apply custom hue, or clear overrides when resetting to stock teal. */
export function syncAccentToDocument(hue: number | null, dark: boolean) {
  if (hue == null) {
    clearAccentHueOverrides()
    return
  }
  applyAccentHue(hue, dark)
}
