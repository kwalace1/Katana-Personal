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

/** Clamp page scroll after the keyboard closes so a blank band doesn’t linger. */
function clampScrollAfterKeyboard() {
  if (typeof window === 'undefined') return
  const root = document.documentElement
  const maxY = Math.max(0, root.scrollHeight - window.innerHeight)
  if (window.scrollY > maxY + 1) {
    window.scrollTo(0, maxY)
  }
  // iOS can leave the visual viewport offset after dismiss.
  try {
    window.scrollTo(window.scrollX, Math.min(window.scrollY, maxY))
  } catch {
    // ignore
  }
}

function dispatchKeyboardFrame(phase: 'will-show' | 'did-show' | 'will-hide' | 'did-hide', height: number) {
  window.dispatchEvent(
    new CustomEvent('katana-keyboard', {
      detail: { phase, height },
    }),
  )
}

/**
 * Drive layout from the keyboard itself (no laggy WebView resize).
 *
 * Native: `resize: none` + pad with the height from `keyboardWillShow` so content
 * moves in sync with the keyboard animation (instead of covering, then catching up).
 * Web/PWA: visualViewport → `--keyboard-inset`.
 */
export async function initKeyboardInset(): Promise<void> {
  if (typeof window === 'undefined') return
  setInset(0)

  if (isNativeShell()) {
    try {
      const { Keyboard, KeyboardResize } = await import('@capacitor/keyboard')
      // We own layout via --keyboard-inset. Native WebView resize races the
      // keyboard animation and causes the “cover then jump” glitch.
      await Keyboard.setResizeMode({ mode: KeyboardResize.None })
      // Disable plugin auto-scroll — we reveal the focused field ourselves once.
      await Keyboard.setScroll({ isDisabled: true })

      await Keyboard.addListener('keyboardWillShow', (info) => {
        const height = info.keyboardHeight || 0
        setInset(height)
        dispatchKeyboardFrame('will-show', height)
      })
      await Keyboard.addListener('keyboardDidShow', (info) => {
        const height = info.keyboardHeight || lastInset
        setInset(height)
        dispatchKeyboardFrame('did-show', height)
      })
      await Keyboard.addListener('keyboardWillHide', () => {
        setInset(0)
        dispatchKeyboardFrame('will-hide', 0)
      })
      await Keyboard.addListener('keyboardDidHide', () => {
        setInset(0)
        clampScrollAfterKeyboard()
        dispatchKeyboardFrame('did-hide', 0)
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
    const next = covered > 40 ? covered : 0
    const prev = lastInset
    setInset(next)
    if (next > 0 && prev === 0) dispatchKeyboardFrame('will-show', next)
    if (next === 0 && prev > 0) {
      clampScrollAfterKeyboard()
      dispatchKeyboardFrame('did-hide', 0)
    }
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

/** True when running in Capacitor (for callers that need a cheap check). */
export function keyboardInsetSupported(): boolean {
  return Capacitor.isNativePlatform() || typeof window !== 'undefined'
}
