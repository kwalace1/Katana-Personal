import { useEffect } from 'react'
import { useTheme } from 'next-themes'
import { MORE_CONTRAST_QUERY } from './contrast'
import { paintEffectiveTheme } from './preview'

/** Keeps data-theme attributes aligned with the saved preference. Renders nothing. */
export function ThemeAttributes() {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    paintEffectiveTheme()
    const scheme = window.matchMedia('(prefers-color-scheme: dark)')
    const contrast = window.matchMedia(MORE_CONTRAST_QUERY)
    const onChange = () => paintEffectiveTheme()
    const onVisible = () => {
      if (document.visibilityState === 'visible') paintEffectiveTheme()
    }
    scheme.addEventListener('change', onChange)
    contrast.addEventListener('change', onChange)
    document.addEventListener('visibilitychange', onVisible)
    const classObserver = new MutationObserver(onChange)
    classObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    let cancelled = false
    let removeAppState = () => {}
    void import('@capacitor/app')
      .then(({ App }) => App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) paintEffectiveTheme()
      }))
      .then((listener) => {
        if (cancelled) void listener.remove()
        else removeAppState = () => void listener.remove()
      })
      .catch(() => {})
    return () => {
      cancelled = true
      removeAppState()
      scheme.removeEventListener('change', onChange)
      contrast.removeEventListener('change', onChange)
      document.removeEventListener('visibilitychange', onVisible)
      classObserver.disconnect()
    }
  }, [resolvedTheme])

  return null
}
