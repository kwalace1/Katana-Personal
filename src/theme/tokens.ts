/**
 * Semantic roles and the CSS variables that already paint them.
 * Tailwind classes (bg-background, text-muted-foreground, bg-primary, …)
 * read these same variables, so shared components follow the active palette
 * without a second styling system.
 *
 * Accent hue (src/lib/accent.ts) overrides --primary, --accent, --ring, and
 * --kp-glow after the palette. It is not a theme family.
 */
export const SEMANTIC_TOKENS = {
  appBackground: '--background',
  primarySurface: '--card',
  secondarySurface: '--secondary',
  elevatedSurface: '--popover',
  primaryText: '--foreground',
  secondaryText: '--secondary-foreground',
  mutedText: '--muted-foreground',
  border: '--border',
  primaryAction: '--primary',
  primaryActionText: '--primary-foreground',
  secondaryAction: '--secondary',
  selected: '--primary',
  focus: '--ring',
  inputBackground: '--card',
  hover: '--secondary',
  overlay: '--kp-overlay',
} as const

/** Meaning stays fixed across decorative themes. */
export const STATUS_TOKENS = {
  destructive: '--destructive',
  destructiveText: '--destructive-foreground',
  focus: '--ring',
} as const

/** Same 50% black scrim dialogs, sheets, and drawers already used. */
export const overlayScrimClass = 'bg-[hsl(var(--kp-overlay)/0.5)]'

/** Same 25% black scrim the mobile navigation drawer already used. */
export const menuScrimClass = 'bg-[hsl(var(--kp-overlay)/0.25)]'
