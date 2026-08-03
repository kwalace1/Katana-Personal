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
          className="flex flex-1 flex-col justify-center pb-20 pt-8 sm:pt-4"
        >
          <p className="kp-chip w-fit">Your personal operating system</p>
          <h1 className="font-display mt-6 max-w-3xl text-5xl leading-[1.02] tracking-tight text-foreground sm:text-6xl lg:text-7xl kp-text-balance">
            Katana
            <span className="mt-1 block text-[0.55em] font-medium text-primary sm:mt-2">Personal</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            One calm place for your tasks, plans, habits, and health — so you stay accountable without
            juggling a dozen apps.
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

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springSoft, delay: 0.12 }}
            className="mt-16 grid gap-3 sm:grid-cols-3"
          >
            {[
              { title: 'See today clearly', body: 'Priorities, plans, and habits in one glance.' },
              { title: 'Stay accountable', body: 'Gentle structure that helps you follow through.' },
              { title: 'Ask for guidance', body: 'A quiet guide that already knows your day.' },
            ].map((item) => (
              <div key={item.title} className="kp-surface p-5">
                <p className="font-display text-lg tracking-tight">{item.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
