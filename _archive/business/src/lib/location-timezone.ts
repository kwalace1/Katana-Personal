/** Use Vite proxy in dev to avoid CORS; direct URL in production. */
function geoUrl(path: string) {
  return import.meta.env.DEV
    ? `/api/geocode${path}`
    : `https://geocoding-api.open-meteo.com${path}`
}
function tzUrl(path: string) {
  return import.meta.env.DEV
    ? `/api/timezone${path}`
    : `https://api.open-meteo.com${path}`
}

/**
 * Resolve timezone (e.g. America/New_York) from a location string like "Philadelphia, Pennsylvania".
 * Uses Open-Meteo geocoding API (free, no key required); results include timezone.
 */
export async function getTimezoneFromLocation(location: string): Promise<string | null> {
  const trimmed = (location ?? "").trim()
  if (!trimmed) return null

  try {
    const geoRes = await fetch(
      geoUrl(`/v1/search?name=${encodeURIComponent(trimmed)}&count=1&language=en`)
    )
    if (!geoRes.ok) return null
    const geoData = (await geoRes.json()) as { results?: Array<{ timezone?: string; latitude?: number; longitude?: number }> }
    const results = geoData.results
    if (!Array.isArray(results) || results.length === 0) return null

    const first = results[0]
    if (typeof first?.timezone === "string") return first.timezone

    const lat = first?.latitude
    const lon = first?.longitude
    if (lat == null || lon == null) return null

    const tzRes = await fetch(
      tzUrl(`/v1/timezone?latitude=${lat}&longitude=${lon}`)
    )
    if (!tzRes.ok) return null
    const tzData = (await tzRes.json()) as { timezone?: string }
    return typeof tzData.timezone === "string" ? tzData.timezone : null
  } catch {
    return null
  }
}
