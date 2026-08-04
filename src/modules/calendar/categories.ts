export type EventCategory = 'personal' | 'work' | 'health' | 'errand' | 'social' | 'other'

/**
 * Standard palette — used for Circles (locked) and as personal category defaults.
 * Tuned so neighboring categories don’t look alike (esp. personal vs health).
 */
export const EVENT_CATEGORIES: {
  id: EventCategory
  label: string
  color: string
}[] = [
  { id: 'personal', label: 'Personal', color: '#0f766e' }, // deep teal
  { id: 'work', label: 'Work', color: '#1d4ed8' }, // strong blue
  { id: 'health', label: 'Health', color: '#c026d3' }, // fuchsia — clearly not teal
  { id: 'errand', label: 'Errand', color: '#ea580c' }, // orange
  { id: 'social', label: 'Social', color: '#e11d48' }, // rose
  { id: 'other', label: 'Other', color: '#57534e' }, // stone
]

/** Extra swatches for personal calendar only — Circles never use these. */
export const PERSONAL_COLOR_SWATCHES = [
  '#0f766e',
  '#1d4ed8',
  '#c026d3',
  '#ea580c',
  '#e11d48',
  '#57534e',
  '#854d0e',
  '#4f46e5',
  '#0e7490',
  '#be123c',
  '#166534',
  '#7c2d12',
] as const

export function categoryColor(category: EventCategory | string | undefined, override?: string | null) {
  if (override) return override
  return EVENT_CATEGORIES.find((c) => c.id === category)?.color ?? EVENT_CATEGORIES[0].color
}

/** Circles always resolve from the standard category — no personal overrides. */
export function circleCategoryColor(category: EventCategory | string | undefined) {
  return EVENT_CATEGORIES.find((c) => c.id === category)?.color ?? EVENT_CATEGORIES[0].color
}

export function categoryLabel(category: EventCategory | string | undefined) {
  return EVENT_CATEGORIES.find((c) => c.id === category)?.label ?? 'Personal'
}
