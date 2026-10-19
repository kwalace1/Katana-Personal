/** Legacy logs stored a glass count. One of those glasses is 250 mL. */
export const GLASS_ML = 250

const FL_OZ_ML = 29.5735295625
const CUP_ML = 236.5882365

export const WATER_UNITS = [
  { id: 'ml', label: 'mL', defaultAmount: 250, step: 50 },
  { id: 'floz', label: 'fl oz', defaultAmount: 8, step: 1 },
  { id: 'cup', label: 'cup', defaultAmount: 1, step: 0.25 },
  { id: 'l', label: 'L', defaultAmount: 0.5, step: 0.1 },
] as const

export type WaterUnit = (typeof WATER_UNITS)[number]['id']

const UNIT_KEY = 'katana-personal:water-unit'
const GOAL_KEY = 'katana-personal:water-goal'

export type WaterGoal = { amount: number; unit: WaterUnit }

const DEFAULT_GOAL: WaterGoal = { amount: 2000, unit: 'ml' }

export function waterUnitMeta(unit: WaterUnit) {
  return WATER_UNITS.find((item) => item.id === unit) ?? WATER_UNITS[0]
}

export function readWaterUnit(): WaterUnit {
  try {
    const raw = localStorage.getItem(UNIT_KEY)
    if (raw === 'glass') return 'ml'
    if (WATER_UNITS.some((item) => item.id === raw)) return raw as WaterUnit
  } catch {
    /* private mode */
  }
  return 'ml'
}

export function writeWaterUnit(unit: WaterUnit) {
  try {
    localStorage.setItem(UNIT_KEY, unit)
  } catch {
    /* private mode */
  }
}

export function readWaterGoal(): WaterGoal {
  try {
    const raw = localStorage.getItem(GOAL_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { amount?: unknown; unit?: unknown }
      const amount = parsed.unit === 'glass' ? Number(parsed.amount) * GLASS_ML : Number(parsed.amount)
      const unit = parsed.unit === 'glass' ? 'ml' : parsed.unit
      if (WATER_UNITS.some((item) => item.id === unit) && Number.isFinite(amount) && amount > 0) {
        return { amount, unit: unit as WaterUnit }
      }
    }
  } catch {
    /* private mode or bad json */
  }
  return { ...DEFAULT_GOAL }
}

export function writeWaterGoal(goal: WaterGoal) {
  if (!Number.isFinite(goal.amount) || goal.amount <= 0) return
  try {
    localStorage.setItem(GOAL_KEY, JSON.stringify({ amount: goal.amount, unit: goal.unit }))
  } catch {
    /* private mode */
  }
}

export function waterGoalMl(goal: WaterGoal = readWaterGoal()): number {
  return Math.max(0, mlFromAmount(goal.amount, goal.unit))
}

export function mlFromAmount(amount: number, unit: WaterUnit): number {
  if (!Number.isFinite(amount)) return 0
  switch (unit) {
    case 'ml':
      return amount
    case 'l':
      return amount * 1000
    case 'floz':
      return amount * FL_OZ_ML
    case 'cup':
      return amount * CUP_ML
    default:
      return 0
  }
}

export function amountFromMl(ml: number, unit: WaterUnit): number {
  const safe = Math.max(0, ml)
  switch (unit) {
    case 'ml':
      return safe
    case 'l':
      return safe / 1000
    case 'floz':
      return safe / FL_OZ_ML
    case 'cup':
      return safe / CUP_ML
    default:
      return safe
  }
}

export function convertWaterAmount(amount: number, from: WaterUnit, to: WaterUnit): number {
  const digits = to === 'ml' ? 0 : to === 'floz' ? 1 : 2
  return Number(amountFromMl(mlFromAmount(amount, from), to).toFixed(digits))
}

/** Stored milliliters, or the legacy glass count converted at 250 mL each. */
export function waterMl(row: { glasses?: number | null; ml?: number | null }): number {
  if (row.ml != null && Number.isFinite(Number(row.ml))) return Math.max(0, Number(row.ml))
  return Math.max(0, (Number(row.glasses) || 0) * GLASS_ML)
}

export function glassesFromMl(ml: number): number {
  if (!Number.isFinite(ml) || ml <= 0) return 0
  return Math.floor(ml / GLASS_ML)
}

function trimNumber(n: number, digits: number): string {
  if (digits <= 0) return Math.round(n).toLocaleString()
  return String(Number(n.toFixed(digits)))
}

export function formatWater(ml: number, unit: WaterUnit): string {
  const text = trimNumber(amountFromMl(ml, unit), unit === 'ml' ? 0 : unit === 'floz' ? 1 : 2)
  const n = Number(text.replace(/,/g, ''))
  if (unit === 'ml') return `${text} mL`
  if (unit === 'l') return `${text} L`
  if (unit === 'floz') return `${text} fl oz`
  return `${text} ${n === 1 ? 'cup' : 'cups'}`
}
