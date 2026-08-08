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

function stepPrecision(step: number) {
  if (step >= 1) return 0
  return String(step).split('.')[1]?.length ?? 1
}

function buildFracOptions(step: number): number[] {
  if (step >= 1) return [0]
  const precision = stepPrecision(step)
  const out: number[] = []
  for (let v = 0; v < 1 - step / 1000; v += step) {
    out.push(Number(v.toFixed(precision)))
  }
  return out
}

function splitQuantity(n: number, step: number): { whole: number; frac: number } {
  const precision = stepPrecision(step)
  if (!Number.isFinite(n)) return { whole: 0, frac: 0 }
  const whole = Math.trunc(n)
  const frac = Number(Math.abs(n - whole).toFixed(precision))
  const fracs = buildFracOptions(step)
  return { whole, frac: nearestOption(frac, fracs) }
}

function combineQuantity(whole: number, frac: number, min: number, max: number, step: number): number {
  const precision = stepPrecision(step)
  const combined = Number((whole + frac).toFixed(precision))
  return Math.min(max, Math.max(min, combined))
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

type WheelColumnProps = {
  options: number[]
  selected: number
  format: (n: number) => string
  ariaLabel: string
  onPick: (n: number) => void
  open: boolean
}

function WheelColumn({ options, selected, format, ariaLabel, onPick, open }: WheelColumnProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const scrollTimer = useRef<number | null>(null)
  const selectedRef = useRef(selected)
  selectedRef.current = selected

  function scrollToIndex(idx: number, behavior: ScrollBehavior = 'auto') {
    const el = listRef.current
    if (!el || idx < 0) return
    el.scrollTo({ top: idx * ITEM_H, behavior })
  }

  useEffect(() => {
    if (!open) return
    const idx = options.indexOf(nearestOption(selectedRef.current, options))
    const t = window.setTimeout(() => scrollToIndex(Math.max(0, idx), 'auto'), 50)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on open
  }, [open])

  useEffect(() => {
    if (!open) return
    const idx = options.indexOf(nearestOption(selected, options))
    if (idx < 0) return
    const el = listRef.current
    if (!el) return
    const current = Math.round(el.scrollTop / ITEM_H)
    if (current !== idx) scrollToIndex(idx, 'smooth')
  }, [selected, options, open])

  function onWheelScroll() {
    const el = listRef.current
    if (!el) return
    if (scrollTimer.current) window.clearTimeout(scrollTimer.current)
    scrollTimer.current = window.setTimeout(() => {
      const idx = Math.round(el.scrollTop / ITEM_H)
      const clamped = Math.max(0, Math.min(options.length - 1, idx))
      const picked = options[clamped]
      if (picked == null) return
      onPick(picked)
      el.scrollTo({ top: clamped * ITEM_H, behavior: 'smooth' })
    }, 80)
  }

  return (
    <div className="relative min-w-0 flex-1">
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
        aria-label={ariaLabel}
      >
        {options.map((opt) => {
          const isSelected = nearestOption(selected, options) === opt
          return (
            <button
              key={opt}
              type="button"
              role="option"
              aria-selected={isSelected}
              className={cn(
                'flex w-full shrink-0 items-center justify-center text-lg tabular-nums transition-colors',
                isSelected ? 'font-semibold text-foreground' : 'text-muted-foreground',
              )}
              style={{ height: ITEM_H, scrollSnapAlign: 'center' }}
              onClick={() => {
                onPick(opt)
                const idx = options.indexOf(opt)
                scrollToIndex(idx, 'smooth')
              }}
            >
              {format(opt)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Typeable number field + scroll-snap wheel drawer for quick pick.
 * Typing always works; wheel is a faster alternate for common ranges.
 * Decimal steps use two columns: whole number + fraction (e.g. 150 · .2).
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
  const dual = step > 0 && step < 1
  const options = useMemo(() => buildOptions(min, max, step), [min, max, step])
  const wholeOptions = useMemo(() => {
    const start = Math.floor(min)
    const end = Math.floor(max)
    const out: number[] = []
    for (let i = start; i <= end; i++) out.push(i)
    return out
  }, [min, max])
  const fracOptions = useMemo(() => buildFracOptions(step), [step])
  const listRef = useRef<HTMLDivElement>(null)
  const scrollTimer = useRef<number | null>(null)

  const numeric = Number(value)
  const hasValue = value.trim() !== '' && Number.isFinite(numeric)
  const precision = stepPrecision(step)
  const parts = dual
    ? splitQuantity(hasValue ? numeric : (min + max) / 2, step)
    : { whole: 0, frac: 0 }

  function commitDual(whole: number, frac: number) {
    const next = combineQuantity(whole, frac, min, max, step)
    onChange(formatOption(next, step))
  }

  function scrollToValue(n: number, behavior: ScrollBehavior = 'auto') {
    const el = listRef.current
    if (!el) return
    const target = nearestOption(n, options)
    const idx = options.indexOf(target)
    if (idx < 0) return
    el.scrollTo({ top: idx * ITEM_H, behavior })
  }

  useEffect(() => {
    if (!open || dual) return
    const start = hasValue ? numeric : nearestOption((min + max) / 2, options)
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
              {dual
                ? `Scroll pounds and tenths${unit ? ` (${unit})` : ''}, or type exact.`
                : `Scroll to select${unit ? ` (${unit})` : ''}, or type exact.`}
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
                  if (Number.isFinite(n) && !dual) scrollToValue(n, 'smooth')
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

            {dual ? (
              <div className="relative flex items-stretch gap-1">
                <WheelColumn
                  open={open}
                  options={wholeOptions}
                  selected={parts.whole}
                  ariaLabel={`${title} whole`}
                  format={(n) => String(n)}
                  onPick={(whole) => commitDual(whole, parts.frac)}
                />
                <WheelColumn
                  open={open}
                  options={fracOptions}
                  selected={parts.frac}
                  ariaLabel={`${title} tenths`}
                  format={(n) => `.${n.toFixed(precision).replace(/^0\./, '')}`}
                  onPick={(frac) => commitDual(parts.whole, frac)}
                />
                {unit ? (
                  <div className="pointer-events-none flex h-48 w-8 shrink-0 items-center justify-center text-sm text-muted-foreground">
                    {unit}
                  </div>
                ) : null}
              </div>
            ) : (
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
                  const selected =
                    hasValue &&
                    nearestOption(numeric, options) === opt &&
                    Math.abs(numeric - opt) < step / 2 + 1e-9
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
                      {unit ? (
                        <span className="ml-1.5 text-sm font-normal text-muted-foreground">{unit}</span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            )}
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
  bodyWeightLb: { min: 80, max: 400, step: 0.1, unit: 'lb', label: 'Body weight' },
  liftWeightLb: { min: 0, max: 600, step: 2.5, unit: 'lb', label: 'Weight' },
  reps: { min: 0, max: 50, step: 1, unit: 'reps', label: 'Reps' },
} as const
