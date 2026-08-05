import { useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'

type HueWheelProps = {
  hue: number
  onChange: (hue: number) => void
  onCommit?: (hue: number) => void
  className?: string
  size?: number
}

function hueFromPointer(clientX: number, clientY: number, rect: DOMRect) {
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const angle = Math.atan2(clientY - cy, clientX - cx)
  // 0° at top, clockwise — map to CSS hue (0 red at right → adjust)
  let deg = (angle * 180) / Math.PI
  deg = (deg + 90 + 360) % 360
  return Math.round(deg)
}

/** Circular hue picker — drag around the ring to pick an accent. */
export function HueWheel({ hue, onChange, onCommit, className, size = 168 }: HueWheelProps) {
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const updateFromEvent = useCallback(
    (clientX: number, clientY: number, commit: boolean) => {
      const el = ref.current
      if (!el) return
      const next = hueFromPointer(clientX, clientY, el.getBoundingClientRect())
      onChange(next)
      if (commit) onCommit?.(next)
    },
    [onChange, onCommit],
  )

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    updateFromEvent(e.clientX, e.clientY, false)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    updateFromEvent(e.clientX, e.clientY, false)
  }

  const endDrag = (e: React.PointerEvent) => {
    if (!dragging.current) return
    dragging.current = false
    updateFromEvent(e.clientX, e.clientY, true)
  }

  const markerAngle = hue - 90
  const r = size / 2
  const markerR = r * 0.78
  const mx = r + markerR * Math.cos((markerAngle * Math.PI) / 180)
  const my = r + markerR * Math.sin((markerAngle * Math.PI) / 180)

  return (
    <div
      ref={ref}
      role="slider"
      aria-label="Accent color hue"
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={hue}
      tabIndex={0}
      className={cn('relative touch-none select-none rounded-full', className)}
      style={{ width: size, height: size }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={(e) => {
        let next = hue
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = (hue + 5) % 360
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = (hue - 5 + 360) % 360
        else return
        e.preventDefault()
        onChange(next)
        onCommit?.(next)
      }}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(from 0deg, hsl(0 80% 50%), hsl(60 80% 50%), hsl(120 80% 50%), hsl(180 80% 50%), hsl(240 80% 50%), hsl(300 80% 50%), hsl(360 80% 50%))`,
        }}
      />
      <div className="absolute inset-[18%] rounded-full bg-background shadow-inner" />
      <div
        className="absolute inset-[28%] rounded-full border border-border/40"
        style={{ background: `hsl(${hue} 48% 40%)` }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
        style={{
          left: mx,
          top: my,
          background: `hsl(${hue} 80% 50%)`,
        }}
      />
    </div>
  )
}
