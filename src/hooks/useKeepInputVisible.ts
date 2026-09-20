import { useEffect } from 'react'

const FIELD = 'input, textarea, select, [contenteditable="true"]'

function isEditable(el: EventTarget | null): el is HTMLElement {
  return (
    el instanceof HTMLElement &&
    el.matches(FIELD) &&
    !el.closest('[data-ignore-keyboard-scroll]')
  )
}

/** One gentle scroll so the focused field isn’t trapped under the keyboard. */
function reveal(el: HTMLElement) {
  try {
    el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' })
  } catch {
    el.scrollIntoView(false)
  }
}

/**
 * Keep focused fields visible above the soft keyboard.
 * Intentionally light — no multi-delay scrolls (those felt glitchy) and no
 * Capacitor setScroll(disabled) (that froze all page scrolling on iOS).
 */
export function useKeepInputVisible() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    let timer = 0

    const revealActive = () => {
      const active = document.activeElement
      if (!isEditable(active)) return
      reveal(active)
    }

    const onFocusIn = (e: FocusEvent) => {
      if (!isEditable(e.target)) return
      window.clearTimeout(timer)
      // Short delay so native WebView resize can settle first.
      timer = window.setTimeout(revealActive, 120)
    }

    const onKatanaKeyboard = (e: Event) => {
      const phase = (e as CustomEvent<{ phase?: string }>).detail?.phase
      if (phase === 'did-show') revealActive()
    }

    document.addEventListener('focusin', onFocusIn)
    window.addEventListener('katana-keyboard', onKatanaKeyboard as EventListener)

    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('focusin', onFocusIn)
      window.removeEventListener('katana-keyboard', onKatanaKeyboard as EventListener)
    }
  }, [])
}
