import type { GeoPoint } from '@/modules/health/types'

const EARTH_M = 6371000

export function haversineMeters(a: Pick<GeoPoint, 'lat' | 'lng'>, b: Pick<GeoPoint, 'lat' | 'lng'>): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function pathDistanceMeters(path: Pick<GeoPoint, 'lat' | 'lng'>[]): number {
  let sum = 0
  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1]
    const cur = path[i]
    if (!prev || !cur) continue
    sum += haversineMeters(prev, cur)
  }
  return sum
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return '0 m'
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(meters >= 10000 ? 1 : 2)} km`
}

/** min/km from meters + seconds */
export function formatPace(meters: number, durationSeconds: number): string {
  if (!Number.isFinite(meters) || meters < 20 || durationSeconds <= 0) return '—'
  const secPerKm = durationSeconds / (meters / 1000)
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')} /km`
}

export function formatClock(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}
