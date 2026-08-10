import { useEffect } from 'react'

const FIELD = 'input, textarea, select, [contenteditable="true"]'

function isEditable(el: EventTarget | null): el is HTMLElement {
  return (
    el instanceof HTMLElement &&
    el.matches(FIELD) &&
    !el.closest('[data-ignore-keyboard-scroll]')
  )
}

/**
 * Keep focused fields above the on-screen keyboard (esp. iOS PWA).
 * First focus often opens the keyboard before the visual viewport settles —
 * re-scrolling on visualViewport resize/scroll fixes the “covers then works on 2nd tap” bug.
 *
 * Skips overlays/sheets: those manage their own layout, and auto-focus + scroll
 * was yanking the keyboard open over comments.
 */
export function useKeepInputVisible() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    let timers: number[] = []

    const clearTimers = () => {
      for (const id of timers) window.clearTimeout(id)
      timers = []
    }

    const shouldHandle = (el: HTMLElement) => {
      // Dialogs / bottom sheets: don’t scroll the page under them.
      if (el.closest('[data-slot="sheet-content"], [data-slot="dialog-content"], [role="dialog"]')) {
        return false
      }
      return true
    }

    const reveal = (el: HTMLElement) => {
      try {
        el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' })
      } catch {
        el.scrollIntoView(true)
      }
    }

    const scheduleReveal = (el: HTMLElement) => {
      if (!shouldHandle(el)) return
      clearTimers()
      // iOS keyboard animation is staggered — nudge a few times.
      for (const ms of [16, 120, 280, 450]) {
        timers.push(window.setTimeout(() => reveal(el), ms))
      }
    }

    const onFocusIn = (e: FocusEvent) => {
      if (!isEditable(e.target)) return
      scheduleReveal(e.target)
    }

    const onViewportChange = () => {
      const active = document.activeElement
      if (!isEditable(active) || !shouldHandle(active)) return
      reveal(active)
    }

    document.addEventListener('focusin', onFocusIn)
    const vv = window.visualViewport
    vv?.addEventListener('resize', onViewportChange)
    vv?.addEventListener('scroll', onViewportChange)

    return () => {
      clearTimers()
      document.removeEventListener('focusin', onFocusIn)
      vv?.removeEventListener('resize', onViewportChange)
      vv?.removeEventListener('scroll', onViewportChange)
    }
  }, [])
}
