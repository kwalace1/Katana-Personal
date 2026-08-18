import { describe, expect, it } from 'vitest'
import { hoursBetweenTimes, parseAppleHealthSleepXml, parseFitbitSleepCsv } from './sleep-import'

describe('sleep import', () => {
  it('reads Apple Health SleepAnalysis records', () => {
    const xml = `
      <HealthData>
        <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Watch"
          startDate="2026-08-16 22:30:00 -0400" endDate="2026-08-17 06:30:00 -0400"
          value="HKCategoryValueSleepAnalysisAsleepCore"/>
      </HealthData>`
    const nights = parseAppleHealthSleepXml(xml)
    expect(nights).toHaveLength(1)
    expect(nights[0]?.date).toBe('2026-08-17')
    expect(nights[0]?.hours).toBe(8)
  })

  it('reads a Fitbit-style CSV', () => {
    const csv = `Start Time,End Time,Minutes Asleep
"2026-08-16 10:30PM","2026-08-17 6:30AM",480`
    const nights = parseFitbitSleepCsv(csv)
    expect(nights[0]?.hours).toBeGreaterThan(7)
  })

  it('computes overnight hours', () => {
    expect(hoursBetweenTimes('22:30', '06:30')).toBe(8)
    expect(hoursBetweenTimes('00:00', '07:15')).toBe(7.3)
  })
})
