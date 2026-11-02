import { useEffect } from 'react'
import { useTheme } from 'next-themes'
import { useAuth } from '@/contexts/AuthContext'
import {
  resolveAccentHue,
  syncAccentToDocument,
} from '@/lib/accent'
import { tuneAccentForContrast } from '@/theme/contrast'

function isDarkMode(resolvedTheme: string | undefined) {
  if (resolvedTheme === 'dark') return true
  if (resolvedTheme === 'light') return false
  return document.documentElement.classList.contains('dark')
}

function paintAccent(
  preferences: Record<string, unknown> | undefined,
  resolvedTheme: string | undefined,
) {
  const family = document.documentElement.dataset.theme || 'classic'
  const hue = family === 'classic' ? resolveAccentHue(preferences) : null
  syncAccentToDocument(hue, isDarkMode(resolvedTheme))
  tuneAccentForContrast(document.documentElement)
}

/** Applies profile/localStorage accent hue onto CSS variables; respects light/dark. */
export function AccentProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth()
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    paintAccent(profile?.preferences, resolvedTheme)
  }, [profile?.preferences, resolvedTheme])

  useEffect(() => {
    const observer = new MutationObserver(() => {
      paintAccent(profile?.preferences, resolvedTheme)
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme', 'data-contrast'],
    })
    return () => observer.disconnect()
  }, [profile?.preferences, resolvedTheme])

  return <>{children}</>
}
