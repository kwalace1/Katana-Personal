/**
 * GDELT News Sentiment fetcher.
 * Uses the free GDELT DOC 2.0 API for media coverage and tone analysis.
 */
import { fetchJson, writeCsv, sleep } from './_helpers.mjs'

const HEADERS = [
  'source', 'entity_name', 'article_count', 'average_tone',
  'positive_score', 'negative_score', 'top_themes',
  'date_range', 'sample_url', 'node_type', 'relationship_type',
]

const SEARCH_ENTITIES = [
  'venture capital',
  'private equity acquisition',
  'IPO filing',
  'SEC enforcement',
  'hedge fund',
  'SPAC merger',
]

export async function fetchNewsSentiment(dataDir, lookbackDays) {
  console.log('  [GDELT] Fetching news sentiment data...')
  const rows = []
  const timespan = `${Math.min(lookbackDays, 90)}d`

  for (const entity of SEARCH_ENTITIES) {
    try {
      const url =
        `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(entity)}` +
        `&mode=ToneChart&timespan=${timespan}&format=json`
      const data = await fetchJson(url)

      if (data?.tone_chart) {
        const toneData = data.tone_chart
        const avgTone = Array.isArray(toneData)
          ? toneData.reduce((s, d) => s + (d.tone || 0), 0) / (toneData.length || 1)
          : 0
        rows.push({
          source: 'GDELT',
          entity_name: entity,
          article_count: Array.isArray(toneData) ? toneData.length : 0,
          average_tone: avgTone.toFixed(2),
          positive_score: '',
          negative_score: '',
          top_themes: '',
          date_range: timespan,
          sample_url: '',
          node_type: 'signal',
          relationship_type: 'news_sentiment',
        })
      }

      // Also try article list for richer data
      const artUrl =
        `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(entity)}` +
        `&mode=ArtList&timespan=${timespan}&maxrecords=10&format=json`
      const artData = await fetchJson(artUrl)
      const articles = artData?.articles || []
      for (const art of articles.slice(0, 5)) {
        const title = (art.title || '').trim()
        if (!title) continue
        rows.push({
          source: 'GDELT',
          entity_name: title.slice(0, 200),
          article_count: 1,
          average_tone: String(art.tone || 0),
          positive_score: String(art.pos || ''),
          negative_score: String(art.neg || ''),
          top_themes: (art.themes || []).slice(0, 5).join('; '),
          date_range: art.seendate || '',
          sample_url: art.url || '',
          node_type: 'news',
          relationship_type: 'news_sentiment',
        })
      }
      await sleep(1000)
    } catch (e) {
      console.warn(`  [GDELT] "${entity}" failed:`, e.message)
    }
  }

  writeCsv(dataDir, 'news_sentiment.csv', HEADERS, rows)
}
