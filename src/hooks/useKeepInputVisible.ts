import { useEffect } from 'react'

const FIELD = 'input, textarea, select, [contenteditable="true"]'

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

function reveal(el: HTMLElement) {
  try {
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' })
  } catch {
    el.scrollIntoView(true)
  }

  // Also nudge the nearest scroll parent (drawers / dialogs / Ask transcript).
  const scroller = scrollableAncestor(el)
  if (!scroller) return
  const rect = el.getBoundingClientRect()
  const parentRect = scroller.getBoundingClientRect()
  const pad = 24
  if (rect.bottom > parentRect.bottom - pad) {
    scroller.scrollTop += rect.bottom - parentRect.bottom + pad
  } else if (rect.top < parentRect.top + pad) {
    scroller.scrollTop -= parentRect.top + pad - rect.top
  }
}

/**
 * Keep focused fields above the on-screen keyboard (iOS Capacitor + PWA).
 * Re-scrolls when the visual viewport / native keyboard settles so the first
 * tap doesn’t leave the caret under the keyboard.
 */
export function useKeepInputVisible() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    let timers: number[] = []

    const clearTimers = () => {
      for (const id of timers) window.clearTimeout(id)
      timers = []
    }

    const scheduleReveal = (el: HTMLElement) => {
      clearTimers()
      for (const ms of [16, 100, 250, 420, 700]) {
        timers.push(window.setTimeout(() => reveal(el), ms))
      }
    }

    const onFocusIn = (e: FocusEvent) => {
      if (!isEditable(e.target)) return
      scheduleReveal(e.target)
    }

    const onViewportChange = () => {
      const active = document.activeElement
      if (!isEditable(active)) return
      reveal(active)
    }

    document.addEventListener('focusin', onFocusIn)
    const vv = window.visualViewport
    vv?.addEventListener('resize', onViewportChange)
    vv?.addEventListener('scroll', onViewportChange)
    window.addEventListener('keyboardDidShow', onViewportChange as EventListener)
    window.addEventListener('keyboardWillShow', onViewportChange as EventListener)

    return () => {
      clearTimers()
      document.removeEventListener('focusin', onFocusIn)
      vv?.removeEventListener('resize', onViewportChange)
      vv?.removeEventListener('scroll', onViewportChange)
      window.removeEventListener('keyboardDidShow', onViewportChange as EventListener)
      window.removeEventListener('keyboardWillShow', onViewportChange as EventListener)
    }
  }, [])
}
