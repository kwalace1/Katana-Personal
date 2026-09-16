import { beforeEach, describe, expect, it } from 'vitest'
import { formatTemp, readWeatherCache, type WeatherSnapshot } from './open-meteo'

describe('weather helpers', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('formats fahrenheit by default', () => {
    const snap = {
      tempC: 10,
      tempF: 50,
      windKph: 0,
      windMph: 0,
      code: 0,
      label: 'Clear',
      outdoorHint: 'Nice',
      fetchedAt: new Date().toISOString(),
      lat: 0,
      lon: 0,
    } satisfies WeatherSnapshot
    expect(formatTemp(snap)).toBe('50°F')
    expect(formatTemp(snap, false)).toBe('10°C')
  })

  it('returns null for missing cache', () => {
    expect(readWeatherCache()).toBeNull()
  })

  it('returns cached snapshot when fresh', () => {
    const snap: WeatherSnapshot = {
      tempC: 20,
      tempF: 68,
      windKph: 5,
      windMph: 3,
      code: 1,
      label: 'Mostly clear',
      outdoorHint: 'Nice',
      fetchedAt: new Date().toISOString(),
      lat: 1,
      lon: 2,
    }
    localStorage.setItem('katana-personal:weather-cache', JSON.stringify(snap))
    expect(readWeatherCache()?.label).toBe('Mostly clear')
  })

  it('ignores stale cache', () => {
    const snap: WeatherSnapshot = {
      tempC: 20,
      tempF: 68,
      windKph: 5,
      windMph: 3,
      code: 1,
      label: 'Mostly clear',
      outdoorHint: 'Nice',
      fetchedAt: new Date(Date.now() - 60 * 60_000).toISOString(),
      lat: 1,
      lon: 2,
    }
    localStorage.setItem('katana-personal:weather-cache', JSON.stringify(snap))
    expect(readWeatherCache()).toBeNull()
  })
})
