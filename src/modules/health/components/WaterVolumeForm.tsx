import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { healthApi } from '../api'
import {
  convertWaterAmount,
  formatWater,
  mlFromAmount,
  readWaterGoal,
  readWaterUnit,
  WATER_UNITS,
  waterUnitMeta,
  writeWaterGoal,
  writeWaterUnit,
  type WaterGoal,
  type WaterUnit,
} from '../water'

/** Light fill that used to sit inside each glass. */
const WATER_FILL = 'rgb(45 212 191 / 0.7)'

export function useWaterGoal() {
  const [goal, setGoalState] = useState<WaterGoal>(readWaterGoal)
  function setGoal(next: WaterGoal) {
    if (!Number.isFinite(next.amount) || next.amount <= 0) return
    writeWaterGoal(next)
    setGoalState(next)
  }
  return [goal, setGoal] as const
}

export function WaterGoalBar({
  loggedMl,
  goal,
  onGoalChange,
}: {
  loggedMl: number
  goal: WaterGoal
  onGoalChange: (goal: WaterGoal) => void
}) {
  const [draft, setDraft] = useState(() => String(goal.amount))
  const goalMl = Math.max(mlFromAmount(goal.amount, goal.unit), 1)
  const progress = Math.min(1, Math.max(0, loggedMl / goalMl))

  function commitDraft() {
    const amount = Number(draft)
    if (!Number.isFinite(amount) || amount <= 0) {
      setDraft(String(goal.amount))
      return
    }
    if (amount !== goal.amount) onGoalChange({ amount, unit: goal.unit })
  }

  function changeUnit(next: WaterUnit) {
    const pending = Number(draft)
    const base = Number.isFinite(pending) && pending > 0 ? pending : goal.amount
    const amount = convertWaterAmount(base, goal.unit, next)
    setDraft(String(amount))
    onGoalChange({ amount, unit: next })
  }

  return (
    <div>
      <p className="font-display text-lg tracking-tight">
        {formatWater(loggedMl, goal.unit)}
        <span className="ml-1 font-sans text-sm font-medium text-muted-foreground">
          / {formatWater(goalMl, goal.unit)}
        </span>
      </p>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-primary/20"
        role="progressbar"
        aria-label="Water toward your goal"
        aria-valuemin={0}
        aria-valuemax={Math.round(goalMl)}
        aria-valuenow={Math.round(Math.min(loggedMl, goalMl))}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${progress * 100}%`, backgroundColor: WATER_FILL }}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="w-14 text-xs text-muted-foreground">Goal</span>
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          step={waterUnitMeta(goal.unit).step}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              event.currentTarget.blur()
            }
          }}
          aria-label="Water goal"
          className="h-9 w-24"
        />
        <Select value={goal.unit} onValueChange={(value) => changeUnit(value as WaterUnit)}>
          <SelectTrigger size="sm" className="!h-9 w-[6.75rem]" aria-label="Goal unit">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WATER_UNITS.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

export function WaterVolumeForm({
  userId,
  date,
  onLogged,
  onUnitChange,
  className,
}: {
  userId: string
  date?: string
  onLogged?: () => void
  onUnitChange?: (unit: WaterUnit) => void
  className?: string
}) {
  const [unit, setUnit] = useState<WaterUnit>(readWaterUnit)
  const [amount, setAmount] = useState(() => String(waterUnitMeta(readWaterUnit()).defaultAmount))

  function changeUnit(next: WaterUnit) {
    setUnit(next)
    writeWaterUnit(next)
    setAmount(String(waterUnitMeta(next).defaultAmount))
    onUnitChange?.(next)
  }

  function apply(event: { preventDefault(): void }, sign: 1 | -1) {
    event.preventDefault()
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) return
    healthApi.addVolume(userId, value * sign, unit, date)
    onLogged?.()
  }

  return (
    <form onSubmit={(event) => apply(event, 1)} className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className="w-14 text-xs text-muted-foreground">Add</span>
      <Input
        type="number"
        inputMode="decimal"
        min={0}
        step={waterUnitMeta(unit).step}
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        aria-label="Water amount"
        className="h-9 w-24"
      />
      <Select value={unit} onValueChange={(value) => changeUnit(value as WaterUnit)}>
        <SelectTrigger size="sm" className="!h-9 w-[6.75rem]" aria-label="Water unit">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {WATER_UNITS.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit" className="h-9">
        Add
      </Button>
      <Button type="button" variant="outline" className="h-9" onClick={(event) => apply(event, -1)}>
        Remove
      </Button>
    </form>
  )
}
