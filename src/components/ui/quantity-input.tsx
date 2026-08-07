import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { cn } from '@/lib/utils'

const ITEM_H = 40

function buildOptions(min: number, max: number, step: number): number[] {
  const out: number[] = []
  const precision = step < 1 ? (String(step).split('.')[1]?.length ?? 1) : 0
  for (let v = min; v <= max + step / 1000; v += step) {
    out.push(Number(v.toFixed(precision)))
  }
  return out
}

function nearestOption(value: number, options: number[]): number {
  if (!options.length) return value
  let best = options[0]!
  let bestDist = Math.abs(best - value)
  for (const opt of options) {
    const d = Math.abs(opt - value)
    if (d < bestDist) {
      best = opt
      bestDist = d
    }
  }
  return best
}

function formatOption(n: number, step: number) {
  if (step >= 1) return String(Math.round(n))
  const precision = String(step).split('.')[1]?.length ?? 1
  return n.toFixed(precision)
}

export type QuantityInputProps = {
  value: string
  onChange: (next: string) => void
  min: number
  max: number
  step: number
  unit?: string
  label?: string
  placeholder?: string
  className?: string
  inputClassName?: string
  'aria-label'?: string
  disabled?: boolean
}

/**
 * Typeable number field + scroll-snap wheel drawer for quick pick.
 * Typing always works; wheel is a faster alternate for common ranges.
 */
export function QuantityInput({
  value,
  onChange,
  min,
  max,
  step,
  unit,
  label,
  placeholder,
  className,
  inputClassName,
  'aria-label': ariaLabel,
  disabled,
}: QuantityInputProps) {
  const [open, setOpen] = useState(false)
  const options = useMemo(() => buildOptions(min, max, step), [min, max, step])
  const listRef = useRef<HTMLDivElement>(null)
  const scrollTimer = useRef<number | null>(null)

  const numeric = Number(value)
  const hasValue = value.trim() !== '' && Number.isFinite(numeric)

  function scrollToValue(n: number, behavior: ScrollBehavior = 'auto') {
    const el = listRef.current
    if (!el) return
    const target = nearestOption(n, options)
    const idx = options.indexOf(target)
    if (idx < 0) return
    el.scrollTo({ top: idx * ITEM_H, behavior })
  }

  useEffect(() => {
    if (!open) return
    const start = hasValue ? numeric : nearestOption((min + max) / 2, options)
    // Wait for drawer layout
    const t = window.setTimeout(() => scrollToValue(start, 'auto'), 50)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on open
  }, [open])

  function onWheelScroll() {
    const el = listRef.current
    if (!el) return
    if (scrollTimer.current) window.clearTimeout(scrollTimer.current)
    scrollTimer.current = window.setTimeout(() => {
      const idx = Math.round(el.scrollTop / ITEM_H)
      const clamped = Math.max(0, Math.min(options.length - 1, idx))
      const picked = options[clamped]
      if (picked == null) return
      onChange(formatOption(picked, step))
      // Snap cleanly
      el.scrollTo({ top: clamped * ITEM_H, behavior: 'smooth' })
    }, 80)
  }

  const title = label || ariaLabel || 'Quantity'

  return (
    <div className={cn('flex min-w-0 gap-1.5', className)}>
      <Input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        aria-label={ariaLabel || label}
        className={cn('min-w-0 flex-1', inputClassName)}
        onChange={(e) => onChange(e.target.value)}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-10 w-10 shrink-0"
        disabled={disabled}
        aria-label={`Scroll to pick ${title}`}
        onClick={() => setOpen(true)}
      >
        <ChevronsUpDown className="h-4 w-4" />
      </Button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <DrawerHeader className="pb-2 text-left">
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>
              Scroll to select{unit ? ` (${unit})` : ''}, or type exact.
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 pb-2">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="decimal"
                min={min}
                max={max}
                step={step}
                value={value}
                placeholder={placeholder}
                aria-label={`${title} typed`}
                className="min-h-11 flex-1"
                onChange={(e) => {
                  onChange(e.target.value)
                  const n = Number(e.target.value)
                  if (Number.isFinite(n)) scrollToValue(n, 'smooth')
                }}
              />
              {unit ? <span className="shrink-0 text-sm text-muted-foreground">{unit}</span> : null}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-sm px-4">
            <div
              className="pointer-events-none absolute inset-x-4 top-1/2 z-10 h-10 -translate-y-1/2 rounded-xl border border-primary/30 bg-primary/5"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-16 bg-gradient-to-b from-background to-transparent"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-16 bg-gradient-to-t from-background to-transparent"
              aria-hidden
            />
            <div
              ref={listRef}
              onScroll={onWheelScroll}
              className="h-48 overflow-y-auto overscroll-contain scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{
                scrollSnapType: 'y mandatory',
                paddingTop: ITEM_H * 2,
                paddingBottom: ITEM_H * 2,
              }}
              role="listbox"
              aria-label={`${title} wheel`}
            >
              {options.map((opt) => {
                const selected = hasValue && nearestOption(numeric, options) === opt && Math.abs(numeric - opt) < step / 2 + 1e-9
                return (
                  <button
                    key={opt}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={cn(
                      'flex w-full shrink-0 items-center justify-center text-lg tabular-nums transition-colors',
                      selected ? 'font-semibold text-foreground' : 'text-muted-foreground',
                    )}
                    style={{ height: ITEM_H, scrollSnapAlign: 'center' }}
                    onClick={() => {
                      onChange(formatOption(opt, step))
                      scrollToValue(opt, 'smooth')
                    }}
                  >
                    {formatOption(opt, step)}
                    {unit ? <span className="ml-1.5 text-sm font-normal text-muted-foreground">{unit}</span> : null}
                  </button>
                )
              })}
            </div>
          </div>

          <DrawerFooter>
            <Button type="button" className="min-h-12" onClick={() => setOpen(false)}>
              Done
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

/** Sensible defaults for Health lift / bodyweight fields. */
export const QUANTITY = {
  bodyWeightLb: { min: 80, max: 400, step: 0.5, unit: 'lb', label: 'Body weight' },
  liftWeightLb: { min: 0, max: 600, step: 2.5, unit: 'lb', label: 'Weight' },
  reps: { min: 0, max: 50, step: 1, unit: 'reps', label: 'Reps' },
} as const
