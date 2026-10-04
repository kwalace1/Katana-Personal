/**
 * Canonical public site + SEO strings.
 * Vercel’s primary host is www (apex 308s → www). Google Search Console
 * cannot reliably read sitemaps that only return a redirect, so all SEO
 * URLs must use the www origin that serves 200.
 */
export const SITE_URL = 'https://www.katanapersonal.app'
export const SITE_ORIGIN = SITE_URL

/** Apple App Store numeric id (Smart App Banner + structured data). */
export const APPLE_APP_ID = '6813697936'

export const APP_STORE_URL =
  'https://apps.apple.com/us/app/katana-personal/id6813697936'

/** Browser tab + search title — brand first, intent second. */
export const SEO_TITLE = 'Katana Personal — Calm Daily Planner for Wellness & Focus'

/**
 * Meta description (~155 chars). Targets daily planner / habits / wellness
 * without promising medical claims.
 */
export const SEO_DESCRIPTION =
  'Katana Personal is a calm daily OS for iPhone: plan your day, build habits, track wellness signals, and share wins — private on your device. Free on the App Store.'

/** Comma-separated keywords for legacy crawlers; Google largely ignores these. */
export const SEO_KEYWORDS = [
  'daily planner app',
  'habit tracker',
  'wellness app',
  'health tracker',
  'productivity app',
  'focus planner',
  'journal app',
  'goal tracker',
  'private life planner',
  'iPhone daily planner',
  'Katana Personal',
].join(', ')

export const OG_IMAGE_PATH = '/og.png'
export const OG_IMAGE_URL = `${SITE_URL}${OG_IMAGE_PATH}`

export const MARKETING_FAQS = [
  {
    question: 'What is Katana Personal?',
    answer:
      'Katana Personal is a calm daily OS for iPhone. It helps you plan the day, do the next thing, track wellness signals like habits, sleep, and movement, and optionally share wins with friends — private on your device by default.',
  },
  {
    question: 'Is Katana a health and wellness app?',
    answer:
      'Katana includes wellness tools — habit tracking, health logging, cardio, sleep import, and meals — as signals inside your day. It is not a medical device and does not provide medical advice. The home story is a calm daily loop, not a standalone tracker.',
  },
  {
    question: 'Is Katana free on the App Store?',
    answer:
      'Yes. Download Katana Personal free on the App Store for iPhone. Katana Plus is an optional subscription for deeper Ask, Circle challenges, meal AI, and extra templates.',
  },
  {
    question: 'Does Katana work in a web browser?',
    answer:
      'The website at katanapersonal.app is a product and download page. The daily OS runs as a native iPhone app. There is no web login for the full product.',
  },
  {
    question: 'Is my data private?',
    answer:
      'Yes by default. Tasks, calendar, habits, journal, and health stay on your iPhone unless you opt into optional Together cloud features for friends, Circles, and sync.',
  },
] as const
