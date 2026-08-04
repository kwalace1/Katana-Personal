import { Link, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BrandMark } from '@/components/BrandMark'
import { useAuth } from '@/contexts/AuthContext'
import { pageEnter, springSoft } from '@/lib/motion-ui'

export default function LandingPage() {
  const { user, loading } = useAuth()

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-0 h-[28rem] w-[28rem] rounded-full bg-[hsl(168_45%_70%/0.28)] blur-3xl" />
        <div className="absolute right-0 top-24 h-[22rem] w-[22rem] rounded-full bg-[hsl(200_50%_80%/0.3)] blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[18rem] w-[18rem] rounded-full bg-[hsl(150_30%_75%/0.2)] blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-5 sm:px-8">
        <header className="flex items-center justify-between py-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
          <BrandMark />
          <Button asChild variant="outline" size="sm">
            <Link to="/auth">Open</Link>
          </Button>
        </header>

        <motion.div
          {...pageEnter}
          className="grid flex-1 items-center gap-10 pb-16 pt-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:pt-0"
        >
          <div>
            <p className="kp-chip w-fit">Your personal operating system</p>
            <h1 className="font-display mt-6 max-w-3xl text-5xl leading-[1.02] tracking-tight text-foreground sm:text-6xl lg:text-7xl kp-text-balance">
              Katana
              <span className="mt-1 block text-[0.55em] font-medium text-primary sm:mt-2">Personal</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
              One calm place for your tasks, plans, habits, and friends — so busy people stay
              accountable without juggling a dozen apps.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="gap-2">
                <Link to="/auth">
                  Start free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <p className="text-sm text-muted-foreground">Private on your device · No account needed</p>
            </div>
          </div>

          {/* Product mock — marketable first impression */}
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springSoft, delay: 0.1 }}
            className="relative mx-auto w-full max-w-md"
            aria-hidden
          >
            <div className="kp-surface overflow-hidden p-5 shadow-[0_24px_80px_-32px_hsl(168_40%_30%/0.45)]">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Tuesday · Today
              </p>
              <p className="font-display mt-2 text-2xl tracking-tight">Do this next</p>
              <p className="mt-1 text-sm text-muted-foreground">Ship investor update · Important</p>
              <div className="mt-4 flex gap-2">
                <span className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
                  Mark done
                </span>
                <span className="rounded-full bg-secondary px-4 py-2 text-xs font-medium">Open</span>
              </div>
              <div className="mt-5 rounded-2xl bg-secondary/60 px-3.5 py-3">
                <p className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
                  Capture
                </p>
                <p className="mt-1 text-sm text-foreground/80">Call Mom Friday 3pm</p>
                <p className="mt-1 text-[0.7rem] text-primary">Will create: Task · Call Mom · due Fri 3pm</p>
              </div>
              <div className="mt-4 border-t border-border/40 pt-4">
                <p className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
                  Circles · Hydration
                </p>
                <ul className="mt-2 space-y-1.5 text-sm">
                  <li className="flex justify-between">
                    <span>You</span>
                    <span className="font-semibold text-primary">12 days</span>
                  </li>
                  <li className="flex justify-between text-muted-foreground">
                    <span>Alex</span>
                    <span>9 days</span>
                  </li>
                  <li className="flex justify-between text-muted-foreground">
                    <span>Sam</span>
                    <span>7 days</span>
                  </li>
                </ul>
              </div>
            </div>
            <div className="pointer-events-none absolute -bottom-6 -left-4 h-24 w-24 rounded-full bg-primary/20 blur-2xl" />
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
