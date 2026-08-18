import { describe, expect, it } from 'vitest'
import { formatClock, formatDistance, formatPace, haversineMeters, pathDistanceMeters } from './geo'

describe('geo', () => {
  it('measures a ~1km north-south step', () => {
    const m = haversineMeters({ lat: 40, lng: -74 }, { lat: 40.009, lng: -74 })
    expect(m).toBeGreaterThan(900)
    expect(m).toBeLessThan(1100)
  })

  it('sums a path', () => {
    const d = pathDistanceMeters([
      { lat: 0, lng: 0 },
      { lat: 0, lng: 0.01 },
      { lat: 0, lng: 0.02 },
    ])
    expect(d).toBeGreaterThan(2000)
  })

  it('formats distance and pace', () => {
    expect(formatDistance(420)).toBe('420 m')
    expect(formatDistance(2450)).toMatch(/2\.45 km/)
    expect(formatPace(5000, 1500)).toBe('5:00 /km')
    expect(formatClock(75)).toBe('1:15')
  })
})
