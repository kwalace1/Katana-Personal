export const TODAY_SECTIONS = [
  { id: 'do_this_next', label: 'Do this next' },
  { id: 'together', label: 'Together' },
  { id: 'also_today', label: 'Also today' },
  { id: 'for_you', label: 'For you' },
  { id: 'evening_close', label: 'Evening close' },
  { id: 'coming_up', label: 'Coming up' },
  { id: 'goals', label: 'Goals' },
  { id: 'recent_notes', label: 'Recent notes' },
] as const

export type TodaySectionId = (typeof TODAY_SECTIONS)[number]['id']

export type TodayLayoutPrefs = {
  hidden: TodaySectionId[]
}

export function parseTodayLayout(prefs: Record<string, unknown> | undefined): TodayLayoutPrefs {
  const raw = prefs?.todayLayout
  if (!raw || typeof raw !== 'object') return { hidden: [] }
  const hiddenRaw = (raw as { hidden?: unknown }).hidden
  if (!Array.isArray(hiddenRaw)) return { hidden: [] }
  const valid = new Set(TODAY_SECTIONS.map((s) => s.id))
  const hidden = hiddenRaw.filter((id): id is TodaySectionId => typeof id === 'string' && valid.has(id as TodaySectionId))
  return { hidden }
}

export function isSectionVisible(prefs: Record<string, unknown> | undefined, id: TodaySectionId): boolean {
  return !parseTodayLayout(prefs).hidden.includes(id)
}

export function toggleSection(
  prefs: Record<string, unknown> | undefined,
  id: TodaySectionId,
): TodayLayoutPrefs {
  const { hidden } = parseTodayLayout(prefs)
  if (hidden.includes(id)) {
    return { hidden: hidden.filter((h) => h !== id) }
  }
  return { hidden: [...hidden, id] }
}
