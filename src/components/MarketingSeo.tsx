import { useEffect } from 'react'
import {
  APP_STORE_URL,
  MARKETING_FAQS,
  OG_IMAGE_URL,
  SEO_DESCRIPTION,
  SEO_TITLE,
  SITE_URL,
} from '@/lib/site'
import { APP_NAME_FULL, COMPANY_LEGAL, SUPPORT_EMAIL } from '@/lib/brand'

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  const selector = `meta[${attr}="${key}"]`
  let el = document.head.querySelector(selector) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

function upsertJsonLd(id: string, data: Record<string, unknown>) {
  let el = document.getElementById(id) as HTMLScriptElement | null
  if (!el) {
    el = document.createElement('script')
    el.type = 'application/ld+json'
    el.id = id
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(data)
}

/**
 * Keeps document head aligned for the marketing homepage after SPA mount.
 * Static tags in index.html cover the first HTML response for crawlers.
 */
export function MarketingSeo() {
  useEffect(() => {
    document.title = SEO_TITLE
    upsertMeta('name', 'description', SEO_DESCRIPTION)
    upsertLink('canonical', `${SITE_URL}/`)

    upsertJsonLd('kp-ld-software', {
      '@context': 'https://schema.org',
      '@type': 'MobileApplication',
      name: APP_NAME_FULL,
      operatingSystem: 'iOS',
      applicationCategory: 'LifestyleApplication',
      applicationSubCategory: 'HealthApplication',
      description: SEO_DESCRIPTION,
      url: SITE_URL,
      downloadUrl: APP_STORE_URL,
      installUrl: APP_STORE_URL,
      image: OG_IMAGE_URL,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        url: APP_STORE_URL,
      },
      author: {
        '@type': 'Organization',
        name: COMPANY_LEGAL,
        email: SUPPORT_EMAIL,
        url: SITE_URL,
      },
      publisher: {
        '@type': 'Organization',
        name: COMPANY_LEGAL,
        url: SITE_URL,
      },
      sameAs: [APP_STORE_URL],
    })

    upsertJsonLd('kp-ld-faq', {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: MARKETING_FAQS.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    })

    upsertJsonLd('kp-ld-website', {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: APP_NAME_FULL,
      url: SITE_URL,
      description: SEO_DESCRIPTION,
      publisher: {
        '@type': 'Organization',
        name: COMPANY_LEGAL,
        url: SITE_URL,
      },
    })
  }, [])

  return null
}
