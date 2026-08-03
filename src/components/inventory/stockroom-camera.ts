import { useState, useCallback, useRef } from 'react'

export interface StockroomCamera {
  x: number
  y: number
  zoom: number
}

/** Pan/zoom + cinematic flyTo for the stockroom floor. */
export function useStockroomCamera() {
  const [camera, setCamera] = useState<StockroomCamera>({ x: 0, y: 0, zoom: 1 })
  const camRef = useRef<StockroomCamera>({ x: 0, y: 0, zoom: 1 })
  const rafRef = useRef<number | null>(null)
  const panState = useRef({ down: false, dragging: false, startX: 0, startY: 0, lastX: 0, lastY: 0 })
  const cleanupRef = useRef<(() => void) | null>(null)
  const flyRef = useRef<number | null>(null)

  const flush = useCallback(() => {
    rafRef.current = null
    setCamera({ ...camRef.current })
  }, [])

  const scheduleFlush = useCallback(() => {
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(flush)
  }, [flush])

  const surfaceRef = useCallback(
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
        camRef.current.zoom = Math.max(0.35, Math.min(2.5, camRef.current.zoom * factor))
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
        camRef.current = {
          ...camRef.current,
          x: camRef.current.x + (e.clientX - s.lastX),
          y: camRef.current.y + (e.clientY - s.lastY),
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
        if (flyRef.current != null) cancelAnimationFrame(flyRef.current)
      }
    },
    [scheduleFlush],
  )

  const resetCamera = useCallback(() => {
    camRef.current = { x: 0, y: 0, zoom: 1 }
    setCamera({ x: 0, y: 0, zoom: 1 })
  }, [])

  const zoomBy = useCallback(
    (factor: number) => {
      camRef.current.zoom = Math.max(0.35, Math.min(2.5, camRef.current.zoom * factor))
      scheduleFlush()
    },
    [scheduleFlush],
  )

  const flyTo = useCallback(
    (worldX: number, worldY: number, targetZoom = 1.35, durationMs = 1400): Promise<void> => {
      if (flyRef.current != null) cancelAnimationFrame(flyRef.current)

      const start = { ...camRef.current }
      const target = { x: -worldX * targetZoom, y: -worldY * targetZoom, zoom: targetZoom }
      const t0 = performance.now()

      return new Promise((resolve) => {
        const tick = (now: number) => {
          const t = Math.min(1, (now - t0) / durationMs)
          const ease = 1 - Math.pow(1 - t, 3)
          camRef.current = {
            x: start.x + (target.x - start.x) * ease,
            y: start.y + (target.y - start.y) * ease,
            zoom: start.zoom + (target.zoom - start.zoom) * ease,
          }
          scheduleFlush()
          if (t < 1) {
            flyRef.current = requestAnimationFrame(tick)
          } else {
            flyRef.current = null
            resolve()
          }
        }
        flyRef.current = requestAnimationFrame(tick)
      })
    },
    [scheduleFlush],
  )

  const cancelFly = useCallback(() => {
    if (flyRef.current != null) {
      cancelAnimationFrame(flyRef.current)
      flyRef.current = null
    }
  }, [])

  return { surfaceRef, camera, resetCamera, zoomBy, flyTo, cancelFly }
}
