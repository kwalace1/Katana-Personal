import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  CalendarCheck,
  HeartPulse,
  Lock,
  NotebookPen,
  Shield,
  Smartphone,
  Sparkles,
  Target,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BrandMark } from '@/components/BrandMark'
import { MarketingSeo } from '@/components/MarketingSeo'
import { SiteFooter } from '@/components/SiteFooter'
import { APP_NAME_FULL, COMPANY_LEGAL, COMPANY_NAME, DESCRIPTION, SUPPORT_EMAIL, TAGLINE } from '@/lib/brand'
import { pageEnterSubtle, staggerContainer, staggerItem } from '@/lib/motion-ui'
import { MARKETING_FAQS } from '@/lib/site'
import { iosDownloadUrl } from '@/lib/web-app-lock'
import { cn } from '@/lib/utils'

const LOOP = [
  {
    icon: CalendarCheck,
    title: 'Today',
    body: 'One next step, capture what matters, evening close, and a weekly review. Your day stays on this iPhone unless you choose Together.',
  },
  {
    icon: Sparkles,
    title: 'Ask',
    body: 'A day guide that already knows your plate — and can draft small actions for you. Free covers the loop; Katana Plus adds deeper Ask.',
  },
  {
    icon: Users,
    title: 'Together',
    body: 'Optional friends, a feed, shared plans, and Circles. Local-first: private life stays on the device. Share only what you choose.',
  },
] as const

const DEPTH = [
  {
    icon: Target,
    title: 'Plan',
    body: 'Tasks, goals, habits, and a calendar when you need more than the next step.',
  },
  {
    icon: HeartPulse,
    title: 'Life signals',
    body: 'Health logging, cardio, sleep import, meals — signals inside the day, not a tracker that owns the product.',
  },
  {
    icon: NotebookPen,
    title: 'Notes & journal',
    body: 'Capture thoughts and close the day without building a second brain you’ll never open.',
  },
  {
    icon: Shield,
    title: 'Connections',
    body: 'Optional calendar and task sync (Google, Outlook, Todoist) when you’re ready — still on your terms.',
  },
] as const

const NOT_THIS = [
  'Not Notion — we don’t want a wiki or second brain.',
  'Not Todoist — not an endless task list.',
  'Not a water or habit tracker with extras bolted on.',
  'Not “AI chat for life” — Ask is a guide inside the day loop.',
] as const

const NAV = [
  { href: '#loop', label: 'The loop' },
  { href: '#wellness', label: 'Wellness' },
  { href: '#faq', label: 'FAQ' },
  { href: '#about', label: 'About' },
  { href: '#get', label: 'Get the app' },
] as const

function CtaButtons({ className }: { className?: string }) {
  const download = iosDownloadUrl()
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center', className)}>
      <Button asChild size="lg" className="min-h-12 px-7">
        <a href={download} target="_blank" rel="noreferrer">
          <Smartphone className="mr-2 h-4 w-4" />
          Download on the App Store
        </a>
      </Button>
      <a
        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        href={`mailto:${SUPPORT_EMAIL}`}
      >
        Support
      </a>
    </div>
  )
}

/**
 * Public website at `/` — full browser marketing site.
 * Product UI stays in the iPhone app / localhost; this page never unlocks the SPA.
 */
export default function MarketingPage() {
  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden">
      <MarketingSeo />
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_-15%,hsl(168_45%_70%/0.5),transparent_58%)]" />
        <div className="absolute -left-32 top-32 h-[28rem] w-[28rem] rounded-full bg-[hsl(168_45%_70%/0.22)] blur-3xl" />
        <div className="absolute right-[-10%] top-[20%] h-[22rem] w-[22rem] rounded-full bg-[hsl(200_50%_80%/0.28)] blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-[hsl(155_40%_78%/0.2)] blur-3xl" />
      </div>

      <header className="sticky top-0 z-20 border-b border-border/30 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-5 sm:h-16 sm:px-8">
          <BrandMark to="/" />
          <nav className="hidden items-center gap-6 md:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <a
            href="#get"
            className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-primary"
          >
            iPhone
          </a>
        </div>
      </header>

      <main>
        {/* Hero — brand first, one composition, full-bleed atmosphere */}
        <section className="relative mx-auto grid w-full max-w-6xl gap-12 px-5 pb-20 pt-12 sm:px-8 sm:pb-28 sm:pt-20 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-end lg:gap-16">
          <motion.div {...pageEnterSubtle} className="max-w-2xl">
            <p className="kp-section-label">Katana Personal</p>
            <h1 className="font-display mt-3 text-5xl tracking-tight sm:text-6xl lg:text-7xl">Katana</h1>
            <p className="mt-5 text-xl font-medium leading-snug text-foreground/90 sm:text-2xl">{TAGLINE}</p>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              {DESCRIPTION}
            </p>
            <CtaButtons className="mt-9" />
            <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
              Free on the App Store for iPhone. This site is the product story and download page —
              there is no web login.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="relative hidden min-h-[22rem] lg:block"
            aria-hidden
          >
            <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-[hsl(168_40%_88%/0.7)] via-[hsl(200_35%_92%/0.5)] to-transparent" />
            <div className="absolute inset-6 overflow-hidden rounded-[1.5rem] border border-border/40 bg-card/40 shadow-[0_30px_80px_-40px_hsl(172_48%_20%/0.45)] backdrop-blur-sm">
              <div className="border-b border-border/30 px-6 py-4">
                <p className="font-display text-2xl tracking-tight">Today</p>
                <p className="mt-1 text-xs text-muted-foreground">Do this next</p>
              </div>
              <div className="space-y-4 p-6">
                <div className="rounded-2xl bg-primary/10 px-4 py-3">
                  <p className="text-sm font-semibold text-primary">Call Mom · Friday 3pm</p>
                  <p className="mt-1 text-xs text-muted-foreground">Captured from Ask · on this device</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {['Today', 'Ask', 'Together'].map((label) => (
                    <div
                      key={label}
                      className="rounded-xl border border-border/40 bg-background/60 px-2 py-3 text-center text-[0.7rem] font-semibold tracking-wide text-muted-foreground"
                    >
                      {label}
                    </div>
                  ))}
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Private by default. Friends and Circles only when you want them.
                </p>
              </div>
            </div>
          </motion.div>
        </section>

        {/* The loop */}
        <section id="loop" className="scroll-mt-20 border-t border-border/40 bg-card/30 py-16 sm:py-24">
          <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-60px' }}
            >
              <motion.div variants={staggerItem} className="max-w-2xl">
                <p className="kp-section-label">The loop</p>
                <h2 className="font-display mt-3 text-3xl tracking-tight sm:text-4xl">
                  Plan the day. Do the next. Share only if you want.
                </h2>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
                  Katana is built around one calm daily loop — not a wall of modules. After a minute,
                  you should feel a day guide with friends if you want them, not another to-do list.
                </p>
              </motion.div>

              <div className="mt-12 grid gap-8 md:grid-cols-3 md:gap-6 lg:gap-10">
                {LOOP.map((item, i) => {
                  const Icon = item.icon
                  return (
                    <motion.div key={item.title} variants={staggerItem} className="relative">
                      <p className="font-display text-5xl text-primary/15">{String(i + 1).padStart(2, '0')}</p>
                      <span className="mt-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </span>
                      <h3 className="font-display mt-4 text-2xl tracking-tight">{item.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-[0.95rem]">
                        {item.body}
                      </p>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          </div>
        </section>

        {/* What it is / isn't */}
        <section className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="kp-section-label">What it is</p>
            <h2 className="font-display mt-3 text-3xl tracking-tight sm:text-4xl">A calm daily OS</h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              {APP_NAME_FULL} is for people who want one clear next step, a guide that can act, and
              optional accountability — without turning life into a project-management dashboard.
            </p>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Plan and Life tools (tasks, habits, health, notes, documents) are depth when you need
              them. They support the loop; they aren’t the home story.
            </p>
          </div>
          <div>
            <p className="kp-section-label">What it isn’t</p>
            <h2 className="font-display mt-3 text-3xl tracking-tight sm:text-4xl">Clear anti-positions</h2>
            <ul className="mt-6 space-y-3">
              {NOT_THIS.map((line) => (
                <li
                  key={line}
                  className="border-l-2 border-primary/30 pl-4 text-sm leading-relaxed text-muted-foreground sm:text-base"
                >
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Depth */}
        <section className="border-t border-border/40 bg-card/20 py-16 sm:py-24">
          <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
            <div className="max-w-2xl">
              <p className="kp-section-label">Depth when you need it</p>
              <h2 className="font-display mt-3 text-3xl tracking-tight sm:text-4xl">
                Everything else stays in service of Today
              </h2>
            </div>
            <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {DEPTH.map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.title}>
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="font-display mt-4 text-xl tracking-tight">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                  </div>
                )
              })}
            </div>
            <p className="mt-10 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Katana Plus is optional — deeper Ask, Circle challenges, meal AI, extra templates, and
              proactive nudges. Health logging is for your own tracking; Katana is not medical advice.
            </p>
          </div>
        </section>

        {/* Wellness — SEO-facing, one job */}
        <section id="wellness" className="scroll-mt-20 mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="max-w-2xl">
            <p className="kp-section-label">Wellness &amp; daily life</p>
            <h2 className="font-display mt-3 text-3xl tracking-tight sm:text-4xl">
              A daily planner that keeps health in the loop
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              Looking for a calm habit tracker, wellness journal, or focus planner? Katana brings
              those signals into one private day loop on iPhone — so sleep, movement, meals, and
              habits inform what you do next, without becoming the whole product.
            </p>
          </div>
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: 'Habits that stick to the day',
                body: 'Build routines beside your next step — streak-aware, not a separate app you forget to open.',
              },
              {
                title: 'Wellness signals, not noise',
                body: 'Log cardio, lifts, sleep import, and meals as context for Today. For your own tracking — not a diagnosis.',
              },
              {
                title: 'Journal & close the day',
                body: 'Capture thoughts, review the week, and share wins with friends only when you choose Together.',
              },
            ].map((item) => (
              <li key={item.title}>
                <h3 className="font-display text-xl tracking-tight">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Privacy */}
        <section id="privacy" className="scroll-mt-20 mx-auto grid w-full max-w-6xl gap-10 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Lock className="h-6 w-6" />
            </span>
            <p className="kp-section-label mt-6">Privacy</p>
            <h2 className="font-display mt-3 text-3xl tracking-tight sm:text-4xl">
              Private on this device
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Your day lives locally on your iPhone by default. Cloud (Together) is optional — for
              friends, Circles, and sync — and only what you choose to share leaves the device.
            </p>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Read the full{' '}
              <Link to="/privacy" className="font-medium text-primary underline-offset-4 hover:underline">
                Privacy Policy
              </Link>{' '}
              and{' '}
              <Link to="/terms" className="font-medium text-primary underline-offset-4 hover:underline">
                Terms of Use
              </Link>
              .
            </p>
          </div>
          <div className="rounded-[1.75rem] border border-border/40 bg-gradient-to-br from-card/80 to-card/30 p-8 sm:p-10">
            <ul className="space-y-5 text-sm leading-relaxed text-muted-foreground sm:text-base">
              <li>
                <span className="font-semibold text-foreground">Local-first.</span> Tasks, calendar,
                habits, journal, and health stay on-device unless you opt into cloud features.
              </li>
              <li>
                <span className="font-semibold text-foreground">Together is opt-in.</span> Friends,
                feed, and Circles require Cloud sign-in — and you control what gets posted.
              </li>
              <li>
                <span className="font-semibold text-foreground">Ask stays grounded.</span> Open-ended
                Ask and meal AI use cloud models only when you use those features; we don’t train our
                own models on your life.
              </li>
            </ul>
          </div>
        </section>

        {/* FAQ — FAQPage schema in index.html + MarketingSeo */}
        <section id="faq" className="scroll-mt-20 border-t border-border/40 bg-card/20 py-16 sm:py-24">
          <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
            <div className="max-w-2xl">
              <p className="kp-section-label">FAQ</p>
              <h2 className="font-display mt-3 text-3xl tracking-tight sm:text-4xl">
                Common questions
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                Straight answers for people comparing daily planners, habit apps, and wellness tools.
              </p>
            </div>
            <dl className="mt-10 max-w-3xl space-y-8">
              {MARKETING_FAQS.map((item) => (
                <div key={item.question}>
                  <dt className="font-display text-xl tracking-tight">{item.question}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                    {item.answer}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* About the business */}
        <section id="about" className="scroll-mt-20 border-t border-border/40 bg-card/30 py-16 sm:py-24">
          <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
            <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
              <div>
                <p className="kp-section-label">About</p>
                <h2 className="font-display mt-3 text-3xl tracking-tight sm:text-4xl">
                  Built by {COMPANY_NAME}
                </h2>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                  {APP_NAME_FULL} is our consumer product from {COMPANY_LEGAL}: a calm daily OS for
                  people who want less noise and more follow-through. We’re shipping on iPhone first so
                  the experience stays focused, private, and actually usable every day.
                </p>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                  The public website is here so anyone — friends, investors, reviewers, or future
                  users — can understand what Katana is without treating the browser as a second copy
                  of the app.
                </p>
              </div>
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Company
                  </p>
                  <p className="mt-1 font-display text-xl tracking-tight">{COMPANY_NAME}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{COMPANY_LEGAL}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Product
                  </p>
                  <p className="mt-1 font-display text-xl tracking-tight">{APP_NAME_FULL}</p>
                  <p className="mt-1 text-sm text-muted-foreground">iPhone · Available on the App Store</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Contact
                  </p>
                  <a
                    className="mt-1 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
                    href={`mailto:${SUPPORT_EMAIL}`}
                  >
                    {SUPPORT_EMAIL}
                  </a>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Support and press — same inbox.
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Status
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Live on the App Store. Download Katana Personal on iPhone and start your day loop.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section id="get" className="scroll-mt-20 mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="relative overflow-hidden rounded-[2rem] border border-border/40 bg-gradient-to-br from-primary/15 via-card/60 to-[hsl(200_50%_88%/0.35)] px-6 py-12 sm:px-12 sm:py-16">
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative max-w-2xl">
              <p className="kp-section-label">Get the app</p>
              <h2 className="font-display mt-3 text-3xl tracking-tight sm:text-4xl">
                Your day, on this iPhone
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
                Katana isn’t a website you log into. Get it on the App Store, then open the app on
                your iPhone.
              </p>
              <CtaButtons className="mt-8" />
            </div>
          </div>

          <SiteFooter className="mt-14" />
        </section>
      </main>
    </div>
  )
}
