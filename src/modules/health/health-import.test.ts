import { describe, expect, it } from 'vitest'
import { parseAppleHealthWorkoutsXml } from './health-import'

describe('parseAppleHealthWorkoutsXml', () => {
  it('parses Workout tags from export.xml', () => {
    const xml = `<?xml version="1.0"?>
<HealthData>
  <Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="32" durationUnit="min" startDate="2026-08-28 07:00:00 -0400" endDate="2026-08-28 07:32:00 -0400" />
</HealthData>`
    const rows = parseAppleHealthWorkoutsXml(xml)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.activity.toLowerCase()).toMatch(/running/)
    expect(rows[0]?.duration_minutes).toBe(32)
    expect(rows[0]?.date).toBe('2026-08-28')
  })
})
