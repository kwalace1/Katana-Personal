/**
 * Shared Framer Motion presets for a consistent, high‑refresh “snappy” feel across the app.
 */

import type { Transition, Variants } from 'framer-motion'

/** Tuned for a responsive, modern UI (stiff spring ≈ fast display / “120Hz” feel). */
export const springSnappy: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 32,
  mass: 0.85,
}

export const springSoft: Transition = {
  type: 'spring',
  stiffness: 280,
  damping: 34,
  mass: 0.9,
}

export const pageEnter = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: springSnappy,
} as const

export const pageEnterSubtle = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: springSoft,
} as const

export const routeShellEnter = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: springSnappy,
} as const

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.045, delayChildren: 0.02 },
  },
}

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: springSnappy },
}
