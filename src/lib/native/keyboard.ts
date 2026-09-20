import { Capacitor } from '@capacitor/core'
import { isNativeShell } from '@/lib/native/platform'

const INSET_VAR = '--keyboard-inset'

function setInset(px: number) {
  if (typeof document === 'undefined') return
  const next = Math.max(0, Math.round(px))
  document.documentElement.style.setProperty(INSET_VAR, `${next}px`)
  document.documentElement.dataset.keyboardOpen = next > 0 ? 'true' : 'false'
}

/**
 * Track on-screen keyboard height into `--keyboard-inset`.
 *
 * Native Capacitor uses `Keyboard.resize = native` so the WebView itself shrinks —
 * we keep `--keyboard-inset` at 0 there to avoid double-padding, and fire the
 * usual keyboard events so `useKeepInputVisible` can re-scroll focused fields.
 *
 * Web / PWA uses visualViewport to pad bottom sheets and composers.
 */
export async function initKeyboardInset(): Promise<void> {
  if (typeof window === 'undefined') return
  setInset(0)

  if (isNativeShell()) {
    try {
      const { Keyboard, KeyboardResize } = await import('@capacitor/keyboard')
      await Keyboard.setResizeMode({ mode: KeyboardResize.Native })
      await Keyboard.setScroll({ isDisabled: false })

      // Native WebView already shrinks — don't also pad the document.
      await Keyboard.addListener('keyboardWillShow', () => setInset(0))
      await Keyboard.addListener('keyboardWillHide', () => setInset(0))
      await Keyboard.addListener('keyboardDidHide', () => setInset(0))
      return
    } catch {
      // Fall through to visualViewport
    }
  }

  const syncFromViewport = () => {
    const vv = window.visualViewport
    if (!vv) {
      setInset(0)
      return
    }
    // When the keyboard is up, layout viewport is taller than the visual viewport.
    const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
    setInset(covered > 40 ? covered : 0)
  }

  window.visualViewport?.addEventListener('resize', syncFromViewport)
  window.visualViewport?.addEventListener('scroll', syncFromViewport)
  window.addEventListener('focusin', syncFromViewport)
  window.addEventListener('focusout', () => {
    window.setTimeout(syncFromViewport, 50)
  })
  syncFromViewport()
}

/** True when running in Capacitor (for callers that need a cheap check). */
export function keyboardInsetSupported(): boolean {
  return Capacitor.isNativePlatform() || typeof window !== 'undefined'
}
