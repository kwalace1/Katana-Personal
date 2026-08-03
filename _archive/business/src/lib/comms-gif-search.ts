/**
 * GIF search via Tenor API (Google).
 * Set VITE_TENOR_API_KEY in .env — free tier: https://developers.google.com/tenor
 */

export interface GifResult {
  id: string
  url: string
  previewUrl: string
  title: string
}

const TENOR_KEY = import.meta.env.VITE_TENOR_API_KEY as string | undefined

async function tenorFetch(path: string): Promise<GifResult[]> {
  if (!TENOR_KEY?.trim()) return []
  const params = new URLSearchParams({
    key: TENOR_KEY,
    client_key: 'katana_comms',
    limit: '24',
  })
  const res = await fetch(`https://tenor.googleapis.com/v2/${path}?${params}`)
  if (!res.ok) return []
  const json = (await res.json()) as {
    results?: Array<{
      id: string
      title?: string
      media_formats?: {
        gif?: { url?: string }
        tinygif?: { url?: string }
        nanogif?: { url?: string }
      }
    }>
  }
  return (json.results ?? [])
    .map((r) => {
      const url = r.media_formats?.gif?.url ?? r.media_formats?.tinygif?.url
      const previewUrl =
        r.media_formats?.nanogif?.url ??
        r.media_formats?.tinygif?.url ??
        url
      if (!url) return null
      return {
        id: r.id,
        url,
        previewUrl: previewUrl ?? url,
        title: r.title ?? '',
      }
    })
    .filter((g): g is GifResult => g !== null)
}

export function isGifSearchAvailable(): boolean {
  return Boolean(TENOR_KEY?.trim())
}

export async function searchGifs(query: string): Promise<GifResult[]> {
  if (!query.trim()) return getTrendingGifs()
  return tenorFetch(`search?q=${encodeURIComponent(query.trim())}`)
}

export async function getTrendingGifs(): Promise<GifResult[]> {
  return tenorFetch('featured')
}
