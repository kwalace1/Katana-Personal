export type EventCategory = 'personal' | 'work' | 'health' | 'errand' | 'social' | 'other'

export const EVENT_CATEGORIES: {
  id: EventCategory
  label: string
  color: string
}[] = [
  { id: 'personal', label: 'Personal', color: '#0d9488' },
  { id: 'work', label: 'Work', color: '#0369a1' },
  { id: 'health', label: 'Health', color: '#059669' },
  { id: 'errand', label: 'Errand', color: '#d97706' },
  { id: 'social', label: 'Social', color: '#e11d48' },
  { id: 'other', label: 'Other', color: '#64748b' },
]

export function categoryColor(category: EventCategory | string | undefined, override?: string | null) {
  if (override) return override
  return EVENT_CATEGORIES.find((c) => c.id === category)?.color ?? EVENT_CATEGORIES[0].color
}

export function categoryLabel(category: EventCategory | string | undefined) {
  return EVENT_CATEGORIES.find((c) => c.id === category)?.label ?? 'Personal'
}
