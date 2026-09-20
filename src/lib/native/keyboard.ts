import { Capacitor } from '@capacitor/core'
import { isNativeShell } from '@/lib/native/platform'

const INSET_VAR = '--keyboard-inset'

let lastInset = 0

function setInset(px: number) {
  if (typeof document === 'undefined') return
  const next = Math.max(0, Math.round(px))
  if (next === lastInset) return
  lastInset = next
  document.documentElement.style.setProperty(INSET_VAR, `${next}px`)
  document.documentElement.dataset.keyboardOpen = next > 0 ? 'true' : 'false'
}

/**
 * Keyboard + scroll setup for Capacitor / PWA.
 *
 * CRITICAL: never call `Keyboard.setScroll({ isDisabled: true })` — on iOS that
 * sets `webView.scrollView.scrollEnabled = NO` for the whole app (not just while
 * the keyboard is open), which freezes page scrolling.
 *
 * Native uses WebView resize (`native`) so the screen lifts with the keyboard.
 * Web/PWA tracks visualViewport into `--keyboard-inset` for bottom sheets.
 */
export async function initKeyboardInset(): Promise<void> {
  if (typeof window === 'undefined') return
  setInset(0)

  if (isNativeShell()) {
    try {
      const { Keyboard, KeyboardResize } = await import('@capacitor/keyboard')
      await Keyboard.setResizeMode({ mode: KeyboardResize.Native })
      // Heal builds that previously disabled WebView scrolling permanently.
      await Keyboard.setScroll({ isDisabled: false })

      // Keep CSS inset at 0 — native resize already shrinks the WebView.
      // Double-padding here caused blank bands after dismiss.
      await Keyboard.addListener('keyboardWillShow', () => setInset(0))
      await Keyboard.addListener('keyboardDidShow', () => {
        setInset(0)
        window.dispatchEvent(new CustomEvent('katana-keyboard', { detail: { phase: 'did-show' } }))
      })
      await Keyboard.addListener('keyboardWillHide', () => setInset(0))
      await Keyboard.addListener('keyboardDidHide', () => {
        setInset(0)
        window.dispatchEvent(new CustomEvent('katana-keyboard', { detail: { phase: 'did-hide' } }))
      })
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
    const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
    setInset(covered > 40 ? covered : 0)
  }

  window.visualViewport?.addEventListener('resize', syncFromViewport)
  window.visualViewport?.addEventListener('scroll', syncFromViewport)
  window.addEventListener('focusin', syncFromViewport)
  window.addEventListener('focusout', () => {
    window.setTimeout(syncFromViewport, 80)
  })
  syncFromViewport()
}

export function getKeyboardInset(): number {
  return lastInset
}

export function keyboardInsetSupported(): boolean {
  return Capacitor.isNativePlatform() || typeof window !== 'undefined'
}
