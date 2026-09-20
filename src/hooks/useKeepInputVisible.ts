import { useEffect } from 'react'
import { getKeyboardInset } from '@/lib/native/keyboard'

const FIELD = 'input, textarea, select, [contenteditable="true"]'

type KeyboardDetail = { phase: string; height: number }

function isEditable(el: EventTarget | null): el is HTMLElement {
  return (
    el instanceof HTMLElement &&
    el.matches(FIELD) &&
    !el.closest('[data-ignore-keyboard-scroll]')
  )
}

function scrollableAncestor(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node)
    const overflowY = style.overflowY
    const canScroll =
      (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
      node.scrollHeight > node.clientHeight + 4
    if (canScroll) return node
    node = node.parentElement
  }
  return null
}

/** Instant reveal — smooth scrolling fights the keyboard animation and looks glitchy. */
function reveal(el: HTMLElement) {
  const keyboard = getKeyboardInset()
  const visibleBottom = window.innerHeight - keyboard - 12
  const rect = el.getBoundingClientRect()

  if (rect.bottom <= visibleBottom && rect.top >= 12) {
    // Already clear of the keyboard.
  } else {
    try {
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' })
    } catch {
      el.scrollIntoView(false)
    }
  }

  const scroller = scrollableAncestor(el)
  if (!scroller) return
  const next = el.getBoundingClientRect()
  const parentRect = scroller.getBoundingClientRect()
  const pad = 20
  const limitBottom = Math.min(parentRect.bottom, visibleBottom) - pad
  if (next.bottom > limitBottom) {
    scroller.scrollTop += next.bottom - limitBottom
  } else if (next.top < parentRect.top + pad) {
    scroller.scrollTop -= parentRect.top + pad - next.top
  }
}

/**
 * Keep focused fields above the soft keyboard without delayed “catch-up” scrolls.
 * Relies on `--keyboard-inset` from `initKeyboardInset` (keyboardWillShow).
 */
export function useKeepInputVisible() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    let raf = 0

    const revealActive = () => {
      const active = document.activeElement
      if (!isEditable(active)) return
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => reveal(active))
    }

    const onFocusIn = (e: FocusEvent) => {
      if (!isEditable(e.target)) return
      // One frame after focus — inset may already be set from a prior show.
      revealActive()
    }

    const onKatanaKeyboard = (e: Event) => {
      const detail = (e as CustomEvent<KeyboardDetail>).detail
      if (!detail) return
      if (detail.phase === 'will-show' || detail.phase === 'did-show') {
        revealActive()
      }
    }

    document.addEventListener('focusin', onFocusIn)
    window.addEventListener('katana-keyboard', onKatanaKeyboard as EventListener)

    return () => {
      if (raf) cancelAnimationFrame(raf)
      document.removeEventListener('focusin', onFocusIn)
      window.removeEventListener('katana-keyboard', onKatanaKeyboard as EventListener)
    }
  }, [])
}
