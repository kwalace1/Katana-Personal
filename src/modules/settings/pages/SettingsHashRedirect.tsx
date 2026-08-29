import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { setPlusUnlocked } from '@/lib/plus'
import { toast } from 'sonner'

const HASH_ROUTES: Record<string, string> = {
  connections: '/settings/connections',
  privacy: '/settings/privacy',
  plus: '/settings/plus',
  cloud: '/settings/together',
  'ask-coach': '/settings/ask',
  'device-copy': '/settings/backup',
}

/** Legacy `/settings#section` and query params → new drill-down routes. */
export function SettingsHashRedirect() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    if (searchParams.get('checkout') === 'success') {
      setPlusUnlocked(true)
      toast.success('Welcome to Katana Plus')
      navigate('/settings/plus', { replace: true })
      return
    }

    const hash = window.location.hash.replace(/^#/, '')
    if (hash && HASH_ROUTES[hash]) {
      navigate(HASH_ROUTES[hash], { replace: true })
      return
    }

    if (searchParams.get('cloud') === '1') {
      navigate('/settings/together', { replace: true })
    }
  }, [navigate, searchParams])

  return null
}
