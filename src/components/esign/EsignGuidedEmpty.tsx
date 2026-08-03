import { motion } from 'framer-motion'
import { FileUp, MapPin, Send, PenLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { springSoft, staggerContainer, staggerItem } from '@/lib/motion-ui'
import { ESIGN_SHELL } from '@/components/esign/esign-ui'

interface EsignGuidedEmptyProps {
  disabled?: boolean
  onStart: () => void
  templateCount?: number
  onCreateTemplate?: () => void
}

const STEPS = [
  {
    icon: FileUp,
    title: 'Upload a document',
    detail: 'PDF, Word, or image — we’ll prepare it for signing.',
  },
  {
    icon: MapPin,
    title: 'Place signature boxes',
    detail: 'Click where each person should sign, initial, or date.',
  },
  {
    icon: Send,
    title: 'Send',
    detail: 'Email signers or copy their private links. Track who finished.',
  },
] as const

export function EsignGuidedEmpty({
  disabled,
  onStart,
  templateCount = 0,
  onCreateTemplate,
}: EsignGuidedEmptyProps) {
  return (
    <div className={`${ESIGN_SHELL}`}>
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, hsl(var(--primary) / 0.14), transparent 60%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(to right, hsl(var(--border) / 0.5) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border) / 0.5) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 75%)',
        }}
      />

      <motion.div
        className="relative px-6 py-12 sm:px-12 sm:py-16 max-w-3xl mx-auto text-center space-y-10"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={staggerItem} className="space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
            <PenLine className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Katana E-Sign
            </p>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-balance">
              Get your first signature in minutes
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
              No envelopes, no setup maze — upload, mark where to sign, and send.
            </p>
          </div>
        </motion.div>

        <motion.ol
          variants={staggerItem}
          className="grid gap-3 sm:grid-cols-3 text-left"
        >
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="group rounded-2xl border border-border/70 bg-background/80 p-4 space-y-3 transition-colors hover:border-primary/35 hover:bg-background"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <step.icon className="h-4 w-4" />
                </span>
                <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
                  0{i + 1}
                </span>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-sm">{step.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.detail}</p>
              </div>
            </li>
          ))}
        </motion.ol>

        <motion.div
          variants={staggerItem}
          className="flex flex-col sm:flex-row items-center justify-center gap-3"
          transition={springSoft}
        >
          <Button size="lg" onClick={onStart} disabled={disabled} className="min-w-[220px] shadow-md shadow-primary/20">
            Start a signature request
          </Button>
          {onCreateTemplate && (
            <Button size="lg" variant="outline" onClick={onCreateTemplate} disabled={disabled}>
              {templateCount > 0 ? 'Browse templates' : 'Save a template for later'}
            </Button>
          )}
        </motion.div>
      </motion.div>
    </div>
  )
}
