/** Free weather via Open-Meteo — no API key required. */

export type WeatherSnapshot = {
  tempC: number
  tempF: number
  windKph: number
  windMph: number
  code: number
  label: string
  outdoorHint: string
  fetchedAt: string
  lat: number
  lon: number
}

export type GeolocationPermissionState = 'granted' | 'prompt' | 'denied' | 'unknown'

const CACHE_KEY = 'katana-personal:weather-cache'
const OPTED_IN_KEY = 'katana-personal:weather-location-ok'
const CACHE_MS = 20 * 60_000
/** Hard cap — iOS PWAs sometimes never fire getCurrentPosition after Allow on first paint. */
const GEO_TIMEOUT_MS = 8_000

const WMO: Record<number, { label: string; outdoor: string }> = {
  0: { label: 'Clear', outdoor: 'Great for a run or walk' },
  1: { label: 'Mostly clear', outdoor: 'Nice conditions outside' },
  2: { label: 'Partly cloudy', outdoor: 'Fine for outdoor cardio' },
  3: { label: 'Overcast', outdoor: 'Cooler — still workable outside' },
  45: { label: 'Foggy', outdoor: 'Low visibility — keep routes familiar' },
  48: { label: 'Icy fog', outdoor: 'Slippery — consider indoor cardio' },
  51: { label: 'Light drizzle', outdoor: 'Light rain — jacket recommended' },
  53: { label: 'Drizzle', outdoor: 'Wet out — tread carefully' },
  55: { label: 'Heavy drizzle', outdoor: 'Wet — maybe shorten the route' },
  61: { label: 'Light rain', outdoor: 'Rainy — waterproof or treadmill' },
  63: { label: 'Rain', outdoor: 'Rainy — indoor option is smarter' },
  65: { label: 'Heavy rain', outdoor: 'Stay in if you can' },
  71: { label: 'Light snow', outdoor: 'Cold — watch footing' },
  73: { label: 'Snow', outdoor: 'Snowy — short outdoor or indoor' },
  75: { label: 'Heavy snow', outdoor: 'Skip outdoor cardio' },
  80: { label: 'Rain showers', outdoor: 'Showers — timing matters' },
  81: { label: 'Showers', outdoor: 'Wet windows — plan around them' },
  82: { label: 'Heavy showers', outdoor: 'Better indoors today' },
  95: { label: 'Thunderstorm', outdoor: 'Stay inside' },
  96: { label: 'Storm + hail', outdoor: 'Stay inside' },
  99: { label: 'Severe storm', outdoor: 'Stay inside' },
}

function describeCode(code: number): { label: string; outdoor: string } {
  return WMO[code] ?? { label: 'Mixed skies', outdoor: 'Check conditions before you head out' }
}

export function readWeatherCache(): WeatherSnapshot | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as WeatherSnapshot
    if (!parsed.fetchedAt) return null
    const age = Date.now() - new Date(parsed.fetchedAt).getTime()
    if (age > CACHE_MS) return null
    return parsed
  } catch {
    return null
  }
}

function writeCache(snap: WeatherSnapshot) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(snap))
  } catch {
    // ignore
  }
}

export function weatherLocationOptedIn(): boolean {
  try {
    return localStorage.getItem(OPTED_IN_KEY) === '1'
  } catch {
    return false
  }
}

export function setWeatherLocationOptedIn(on: boolean) {
  try {
    if (on) localStorage.setItem(OPTED_IN_KEY, '1')
    else localStorage.removeItem(OPTED_IN_KEY)
  } catch {
    // ignore
  }
}

export async function queryGeolocationPermission(): Promise<GeolocationPermissionState> {
  try {
    if (!navigator.permissions?.query) return 'unknown'
    const result = await navigator.permissions.query({ name: 'geolocation' })
    if (result.state === 'granted' || result.state === 'prompt' || result.state === 'denied') {
      return result.state
    }
    return 'unknown'
  } catch {
    // Safari often throws for geolocation permission queries.
    return 'unknown'
  }
}

function getPosition(forceFresh = false): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new WeatherGeoError('unavailable', 'Location isn’t available in this browser'))
      return
    }

    let settled = false
    const timer = window.setTimeout(() => {
      if (settled) return
      settled = true
      reject(
        new WeatherGeoError(
          'timeout',
          'Location timed out. Tap Allow location — then approve the system prompt.',
        ),
      )
    }, GEO_TIMEOUT_MS)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (settled) return
        settled = true
        window.clearTimeout(timer)
        resolve(pos)
      },
      (err) => {
        if (settled) return
        settled = true
        window.clearTimeout(timer)
        if (err.code === err.PERMISSION_DENIED) {
          reject(
            new WeatherGeoError(
              'denied',
              'Location permission denied',
            ),
          )
        } else if (err.code === err.TIMEOUT) {
          reject(new WeatherGeoError('timeout', 'Location timed out. Tap Allow location.'))
        } else {
          reject(new WeatherGeoError('unknown', err.message || 'Couldn’t read location'))
        }
      },
      {
        enableHighAccuracy: false,
        timeout: GEO_TIMEOUT_MS - 500,
        maximumAge: forceFresh ? 0 : 10 * 60_000,
      },
    )
  })
}

export class WeatherGeoError extends Error {
  kind: 'denied' | 'timeout' | 'unavailable' | 'unknown'
  constructor(kind: WeatherGeoError['kind'], message: string) {
    super(message)
    this.name = 'WeatherGeoError'
    this.kind = kind
  }
}

export async function fetchWeatherSnapshot(force = false): Promise<WeatherSnapshot> {
  if (!force) {
    const cached = readWeatherCache()
    if (cached) return cached
  }

  const pos = await getPosition(force)
  const lat = pos.coords.latitude
  const lon = pos.coords.longitude
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lon))
  url.searchParams.set('current', 'temperature_2m,weather_code,wind_speed_10m')
  url.searchParams.set('temperature_unit', 'celsius')
  url.searchParams.set('wind_speed_unit', 'kmh')
  url.searchParams.set('timezone', 'auto')

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error('Weather request failed')
  const json = (await res.json()) as {
    current?: { temperature_2m?: number; weather_code?: number; wind_speed_10m?: number }
  }
  const tempC = Number(json.current?.temperature_2m)
  const code = Number(json.current?.weather_code ?? 0)
  const windKph = Number(json.current?.wind_speed_10m ?? 0)
  if (!Number.isFinite(tempC)) throw new Error('Weather data incomplete')

  const { label, outdoor } = describeCode(code)
  const snap: WeatherSnapshot = {
    tempC,
    tempF: tempC * (9 / 5) + 32,
    windKph,
    windMph: windKph * 0.621371,
    code,
    label,
    outdoorHint: outdoor,
    fetchedAt: new Date().toISOString(),
    lat,
    lon,
  }
  writeCache(snap)
  setWeatherLocationOptedIn(true)
  return snap
}

export function formatTemp(snap: WeatherSnapshot, useFahrenheit = true): string {
  const n = useFahrenheit ? snap.tempF : snap.tempC
  const unit = useFahrenheit ? '°F' : '°C'
  return `${Math.round(n)}${unit}`
}
