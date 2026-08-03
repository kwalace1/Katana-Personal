import { useState, useCallback, useRef } from 'react'

/** Throttled pan/zoom for network SVG canvases — avoids React re-render on every wheel/mousemove tick. */
export function useMapViewport() {
  const [zoomK, setZoomK] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const zoomRef = useRef(1)
  const panRef = useRef({ x: 0, y: 0 })
  const rafRef = useRef<number | null>(null)
  const panState = useRef({ down: false, dragging: false, startX: 0, startY: 0, lastX: 0, lastY: 0 })
  const cleanupRef = useRef<(() => void) | null>(null)

  const flush = useCallback(() => {
    rafRef.current = null
    setZoomK(zoomRef.current)
    setPanOffset({ x: panRef.current.x, y: panRef.current.y })
  }, [])

  const scheduleFlush = useCallback(() => {
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(flush)
  }, [flush])

  const mapContainerRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (cleanupRef.current) {
        cleanupRef.current()
        cleanupRef.current = null
      }
      if (!el) return

      const onWheel = (e: WheelEvent) => {
        e.preventDefault()
        e.stopPropagation()
        const factor = Math.exp(-e.deltaY * 0.002)
        zoomRef.current = Math.max(0.25, Math.min(3, zoomRef.current * factor))
        scheduleFlush()
      }

      const onMouseDown = (e: MouseEvent) => {
        if (e.button !== 0) return
        panState.current = {
          down: true,
          dragging: false,
          startX: e.clientX,
          startY: e.clientY,
          lastX: e.clientX,
          lastY: e.clientY,
        }
      }

      const onMouseMove = (e: MouseEvent) => {
        const s = panState.current
        if (!s.down) return
        if (!s.dragging) {
          if (Math.abs(e.clientX - s.startX) + Math.abs(e.clientY - s.startY) < 5) return
          s.dragging = true
          el.style.cursor = 'grabbing'
        }
        panRef.current = {
          x: panRef.current.x + (e.clientX - s.lastX),
          y: panRef.current.y + (e.clientY - s.lastY),
        }
        s.lastX = e.clientX
        s.lastY = e.clientY
        scheduleFlush()
      }

      const onMouseUp = () => {
        panState.current.down = false
        panState.current.dragging = false
        el.style.cursor = ''
      }

      el.addEventListener('wheel', onWheel, { passive: false })
      el.addEventListener('mousedown', onMouseDown)
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
      cleanupRef.current = () => {
        el.removeEventListener('wheel', onWheel)
        el.removeEventListener('mousedown', onMouseDown)
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      }
    },
    [scheduleFlush],
  )

  const resetViewport = useCallback(() => {
    zoomRef.current = 1
    panRef.current = { x: 0, y: 0 }
    setZoomK(1)
    setPanOffset({ x: 0, y: 0 })
  }, [])

  return { mapContainerRef, zoomK, panOffset, resetViewport }
}
