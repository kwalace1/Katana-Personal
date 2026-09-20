import { motion } from 'framer-motion'
import { CalendarCheck, Smartphone, Sparkles, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BrandMark } from '@/components/BrandMark'
import { SiteFooter } from '@/components/SiteFooter'
import { DESCRIPTION, SUPPORT_EMAIL, TAGLINE } from '@/lib/brand'
import { pageEnterSubtle, staggerContainer, staggerItem } from '@/lib/motion-ui'
import { iosDownloadUrl } from '@/lib/web-app-lock'

const STORY = [
  {
    icon: CalendarCheck,
    title: 'Today',
    body: 'Decide one next step. Capture what matters. Close the day — that’s the loop.',
  },
  {
    icon: Sparkles,
    title: 'Ask',
    body: 'A day guide that already knows your plate — and can draft small actions for you.',
  },
  {
    icon: Users,
    title: 'Together',
    body: 'Optional accountability with friends and Circles. Private life stays on this device.',
  },
] as const

/**
 * Public website at `/` — story + iPhone CTA. The product UI is not on the web.
 */
export default function MarketingPage() {
  const download = iosDownloadUrl()

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,hsl(168_45%_70%/0.45),transparent_55%)]" />
        <div className="absolute -left-24 top-24 h-80 w-80 rounded-full bg-[hsl(168_45%_70%/0.28)] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-[hsl(200_50%_80%/0.28)] blur-3xl" />
        <div
          className="absolute inset-x-0 top-0 h-[70vh] opacity-[0.12]"
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%232F6F68\' fill-opacity=\'0.35\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          }}
        />
      </div>

      <div className="relative mx-auto flex w-full max-w-lg flex-1 flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between py-2">
          <BrandMark to="/" />
          <p className="text-[0.65rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            iPhone
          </p>
        </header>

        <motion.div {...pageEnterSubtle} className="flex flex-1 flex-col py-6 sm:py-10">
          <div className="flex min-h-0 flex-col justify-center py-4 sm:min-h-[52vh]">
            <h1 className="font-display text-5xl tracking-tight sm:text-6xl">Katana</h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
              {TAGLINE}
            </p>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{DESCRIPTION}</p>

            <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              {download ? (
                <Button asChild size="lg" className="min-h-12 px-6">
                  <a href={download} target="_blank" rel="noreferrer">
                    Get it on iPhone
                  </a>
                </Button>
              ) : (
                <Button asChild size="lg" className="min-h-12 px-6">
                  <a href={`mailto:${SUPPORT_EMAIL}?subject=Katana%20TestFlight`}>
                    <Smartphone className="mr-2 h-4 w-4" />
                    Ask for TestFlight
                  </a>
                </Button>
              )}
              {!download ? (
                <p className="text-sm text-muted-foreground">iPhone app — not a web login.</p>
              ) : (
                <a
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                  href={`mailto:${SUPPORT_EMAIL}`}
                >
                  Support
                </a>
              )}
            </div>
            <p className="mt-4 max-w-md text-xs leading-relaxed text-muted-foreground">
              Katana isn’t a website you log into. The daily OS lives in the iPhone app — TestFlight
              now, App Store next.
            </p>
          </div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-40px' }}
            className="mb-8 mt-4 space-y-4 border-t border-border/40 pt-10"
          >
            <p className="kp-section-label">The loop</p>
            {STORY.map((item) => {
              const Icon = item.icon
              return (
                <motion.div
                  key={item.title}
                  variants={staggerItem}
                  className="flex gap-4 rounded-2xl bg-card/50 px-4 py-4 backdrop-blur-sm"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-display text-lg tracking-tight">{item.title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>

          <SiteFooter className="mt-auto" />
        </motion.div>
      </div>
    </div>
  )
}
