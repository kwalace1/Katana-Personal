import type { LucideIcon } from 'lucide-react'
import {
  BookOpen,
  CalendarDays,
  CheckSquare,
  FileText,
  Flame,
  HeartPulse,
  ListTodo,
  Newspaper,
  NotebookPen,
  Settings,
  Share2,
  Sparkles,
  Sun,
  Target,
  Trophy,
  Users,
} from 'lucide-react'

export type NavItem = {
  id: string
  to: string
  label: string
  icon: LucideIcon
}

export type NavSectionId = 'plan' | 'life' | 'together'

export type NavSection = {
  id: NavSectionId
  label: string
  icon: LucideIcon
  items: readonly NavItem[]
}

/** Top of the sidebar. These pages have no parent section. */
export const PRIMARY_NAV = [
  { id: 'today', to: '/dashboard', label: 'Today', icon: Sun },
  { id: 'ask', to: '/ask', label: 'Ask', icon: Sparkles },
  { id: 'calendar', to: '/calendar', label: 'Calendar', icon: CalendarDays },
] as const satisfies readonly NavItem[]

export const SOCIAL_NAV = {
  id: 'social',
  to: '/social',
  label: 'Social',
  icon: Newspaper,
} as const satisfies NavItem

export const SETTINGS_NAV = {
  id: 'settings',
  to: '/settings',
  label: 'Settings',
  icon: Settings,
} as const satisfies NavItem

export const PLAN_SECTION = {
  id: 'plan',
  label: 'Plan',
  icon: ListTodo,
  items: [
    { id: 'tasks', to: '/tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'goals', to: '/goals', label: 'Goals', icon: Target },
    { id: 'habits', to: '/habits', label: 'Habits', icon: Flame },
    { id: 'notes', to: '/notes', label: 'Notes', icon: NotebookPen },
    { id: 'files', to: '/documents', label: 'Files', icon: FileText },
  ],
} as const satisfies NavSection

export const LIFE_SECTION = {
  id: 'life',
  label: 'Life',
  icon: HeartPulse,
  items: [
    { id: 'health', to: '/health', label: 'Health & Wellness', icon: HeartPulse },
    { id: 'journal', to: '/journal', label: 'Journal', icon: BookOpen },
  ],
} as const satisfies NavSection

export const TOGETHER_SECTION = {
  id: 'together',
  label: 'Together',
  icon: Users,
  items: [
    SOCIAL_NAV,
    { id: 'plans', to: '/shared', label: 'Plans', icon: Share2 },
    { id: 'circles', to: '/circles', label: 'Circles', icon: Trophy },
  ],
} as const satisfies NavSection

export const NAV_SECTIONS = [PLAN_SECTION, LIFE_SECTION, TOGETHER_SECTION] as const

const ALL_ITEMS: readonly NavItem[] = [
  ...PRIMARY_NAV,
  ...PLAN_SECTION.items,
  ...LIFE_SECTION.items,
  ...TOGETHER_SECTION.items,
  SETTINGS_NAV,
]

function pathOnly(path: string) {
  return path.split('?')[0] || '/'
}

/** Sidebar section for a route. Today, Ask, and Calendar have none. */
export function navSectionLabel(path: string): string | undefined {
  const base = pathOnly(path)
  if (base !== SETTINGS_NAV.to && base.startsWith(`${SETTINGS_NAV.to}/`)) return SETTINGS_NAV.label
  return NAV_SECTIONS.find((section) => section.items.some((item) => item.to === base))?.label
}

/** Sidebar item name for a route. */
export function navItemLabel(path: string): string | undefined {
  return ALL_ITEMS.find((item) => item.to === pathOnly(path))?.label
}
