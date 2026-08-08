import { useCallback, useMemo, useRef } from 'react'
import { cn } from '@/lib/utils'

type HueWheelProps = {
  hue: number
  onChange: (hue: number) => void
  onCommit?: (hue: number) => void
  className?: string
  size?: number
}

/** Smooth full-spectrum conic gradient (every 15°). */
function spectrumConic() {
  const stops: string[] = []
  for (let h = 0; h <= 360; h += 15) {
    stops.push(`hsl(${h} 90% 52%)`)
  }
  return `conic-gradient(from 0deg, ${stops.join(', ')})`
}

function hueFromPointer(clientX: number, clientY: number, rect: DOMRect) {
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const angle = Math.atan2(clientY - cy, clientX - cx)
  // 0° at top (matches CSS conic-gradient from 0deg), clockwise
  let deg = (angle * 180) / Math.PI
  deg = (deg + 90 + 360) % 360
  return Math.round(deg)
}

/** Full circular hue picker — continuous spectrum, not a short strip of swatches. */
export function HueWheel({ hue, onChange, onCommit, className, size = 200 }: HueWheelProps) {
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const spectrum = useMemo(() => spectrumConic(), [])

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
  const markerR = r * 0.82
  const mx = r + markerR * Math.cos((markerAngle * Math.PI) / 180)
  const my = r + markerR * Math.sin((markerAngle * Math.PI) / 180)

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div
        ref={ref}
        role="slider"
        aria-label="Accent color hue"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={hue}
        tabIndex={0}
        className="relative touch-none select-none rounded-full shadow-[0_0_0_1px_hsl(var(--border)/0.5)]"
        style={{ width: size, height: size }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={(e) => {
          let next = hue
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = (hue + 1) % 360
          else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = (hue - 1 + 360) % 360
          else if (e.key === 'PageUp') next = (hue + 15) % 360
          else if (e.key === 'PageDown') next = (hue - 15 + 360) % 360
          else return
          e.preventDefault()
          onChange(next)
          onCommit?.(next)
        }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: spectrum }}
        />
        {/* Soft ring mask — keep a wide color band so every hue is easy to hit */}
        <div className="absolute inset-[14%] rounded-full bg-background shadow-inner" />
        <div
          className="absolute inset-[22%] rounded-full border border-border/40"
          style={{ background: `hsl(${hue} 55% 42%)` }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute size-[1.125rem] -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-white shadow-md ring-1 ring-black/15"
          style={{
            left: mx,
            top: my,
            background: `hsl(${hue} 90% 50%)`,
          }}
        />
      </div>

      <label className="flex w-full max-w-[12.5rem] flex-col gap-1.5">
        <span className="text-center text-[0.7rem] text-muted-foreground">
          Drag the circle or slide for any hue
        </span>
        <input
          type="range"
          min={0}
          max={359}
          step={1}
          value={hue}
          aria-label="Fine-tune accent hue"
          className="h-2 w-full cursor-pointer appearance-none rounded-full"
          style={{
            background: spectrum.replace('conic-gradient(from 0deg,', 'linear-gradient(to right,'),
          }}
          onChange={(e) => onChange(Number(e.target.value))}
          onPointerUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
          onKeyUp={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') {
              onCommit?.(hue)
            }
          }}
        />
      </label>
    </div>
  )
}
