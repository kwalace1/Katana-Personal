/**
 * Press Release fetcher (RSS expansion).
 * Extends the existing RSS news approach with PR Newswire and Business Wire feeds.
 */
import { fetchText, writeCsv } from './_helpers.mjs'

const HEADERS = [
  'source', 'title', 'link', 'published', 'summary',
  'node_type', 'relationship_type',
]

const FUNDING_KEYWORDS =
  /invest|fund|capital|venture|startup|raise|ipo|valuation|acquisition|billion|million|merger|equity|partnership/i

const FEEDS = [
  { name: 'PR_NEWSWIRE', url: 'https://www.prnewswire.com/rss/financial-services-latest-news/financial-services-latest-news-list.rss' },
  { name: 'BUSINESS_WIRE', url: 'https://feed.businesswire.com/rss/home/?rss=G1QFDERJXkJeEFpRWA==' },
  { name: 'GLOBENEWSWIRE', url: 'https://www.globenewswire.com/RssFeed/subjectcode/25-Mergers%20and%20Acquisitions/feedTitle/GlobeNewswire%20-%20Mergers%20and%20Acquisitions' },
]

export async function fetchPressReleases(dataDir) {
  console.log('  [Press] Fetching press release feeds...')
  const rows = []

  for (const feed of FEEDS) {
    try {
      const xml = await fetchText(feed.url)
      const items = xml.match(/<item>[\s\S]*?<\/item>/g) || []
      for (const item of items) {
        const title = (item.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || ''
        const link = (item.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || ''
        const pubDate = (item.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || ''
        const desc = (item.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || ''
        const cleanTitle = title.replace(/<!\[CDATA\[|\]\]>/g, '').trim()
        const cleanDesc = desc.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>/g, '').trim().slice(0, 300)
        if (!FUNDING_KEYWORDS.test(cleanTitle + ' ' + cleanDesc)) continue
        rows.push({
          source: feed.name,
          title: cleanTitle.slice(0, 300),
          link: link.trim(),
          published: pubDate.trim(),
          summary: cleanDesc,
          node_type: 'news',
          relationship_type: 'press_release',
        })
      }
    } catch (e) {
      console.warn(`  [Press] ${feed.name} failed:`, e.message)
    }
  }

  writeCsv(dataDir, 'press_releases.csv', HEADERS, rows)
}
