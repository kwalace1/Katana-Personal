import { useEffect } from 'react'
import { useTheme } from 'next-themes'
import { useAuth } from '@/contexts/AuthContext'
import {
  resolveAccentHue,
  syncAccentToDocument,
} from '@/lib/accent'

function isDarkMode(resolvedTheme: string | undefined) {
  if (resolvedTheme === 'dark') return true
  if (resolvedTheme === 'light') return false
  return document.documentElement.classList.contains('dark')
}

/** Applies profile/localStorage accent hue onto CSS variables; respects light/dark. */
export function AccentProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth()
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const hue = resolveAccentHue(profile?.preferences)
    syncAccentToDocument(hue, isDarkMode(resolvedTheme))
  }, [profile?.preferences, resolvedTheme])

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const hue = resolveAccentHue(profile?.preferences)
      syncAccentToDocument(hue, document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [profile?.preferences])

  return <>{children}</>
}
