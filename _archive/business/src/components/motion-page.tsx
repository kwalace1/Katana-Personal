import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { pageEnter, pageEnterSubtle } from '@/lib/motion-ui'
import { cn } from '@/lib/utils'

type MotionPageProps = {
  children: ReactNode
  className?: string
  /** Softer motion for very dense pages (e.g. large dashboards). */
  subtle?: boolean
  id?: string
  'data-layout'?: string
  'data-testid'?: string
}

/**
 * Wraps primary page content with a consistent entrance animation.
 * Use on route-level pages for a cohesive, modern feel.
 */
export function MotionPage({
  children,
  className,
  subtle,
  id,
  'data-layout': dataLayout,
  'data-testid': dataTestId,
}: MotionPageProps) {
  const p = subtle ? pageEnterSubtle : pageEnter
  return (
    <motion.div
      id={id}
      data-layout={dataLayout}
      data-testid={dataTestId}
      className={cn('min-w-0 max-w-full overflow-x-hidden', className)}
      initial={p.initial}
      animate={p.animate}
      transition={p.transition}
    >
      {children}
    </motion.div>
  )
}
