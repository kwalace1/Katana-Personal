import { describe, expect, it } from 'vitest'
import { convertWaterAmount, formatWater, mlFromAmount, waterGoalMl, waterMl } from './water'

describe('water volume', () => {
  it('converts common units into milliliters', () => {
    expect(mlFromAmount(250, 'ml')).toBe(250)
    expect(mlFromAmount(1, 'l')).toBe(1000)
    expect(mlFromAmount(8, 'floz')).toBeCloseTo(236.6, 0)
    expect(mlFromAmount(1, 'cup')).toBeCloseTo(236.6, 0)
  })

  it('reads legacy glass logs as 250 mL each', () => {
    expect(waterMl({ glasses: 3 })).toBe(750)
    expect(waterMl({ glasses: 1, ml: 400 })).toBe(400)
  })

  it('formats a total in the selected unit', () => {
    expect(formatWater(1500, 'ml')).toBe(`${(1500).toLocaleString()} mL`)
    expect(formatWater(500, 'l')).toBe('0.5 L')
    expect(formatWater(236.5882365, 'cup')).toBe('1 cup')
  })

  it('keeps the same volume when the goal unit changes', () => {
    expect(convertWaterAmount(2000, 'ml', 'l')).toBe(2)
    expect(waterGoalMl({ amount: 2, unit: 'l' })).toBe(2000)
  })
})