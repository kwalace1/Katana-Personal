import { useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { unlockWebApp } from '@/lib/web-app-lock'

const TRIPLE_CLICK_MS = 1000

/**
 * Public wordmark. Three clicks on the K within a second unlock this browser
 * and open the real app. A single click does nothing.
 */
export function SecretUnlockTitle({ className }: { className?: string }) {
  const { user, startWorkspace, markOnboardingDone } = useAuth()
  const clicks = useRef<number[]>([])

  async function openApp() {
    unlockWebApp()
    if (!user) await startWorkspace('You')
    markOnboardingDone()
    window.location.assign('/dashboard')
  }

  function onUnlockClick() {
    const now = Date.now()
    const recent = clicks.current.filter((stamp) => now - stamp < TRIPLE_CLICK_MS)
    recent.push(now)
    clicks.current = recent
    if (recent.length < 3) return
    clicks.current = []
    void openApp()
  }

  return (
    <h1 className={className} aria-label="Katana">
      <span className="select-none" onClick={onUnlockClick}>
        K
      </span>
      atana
    </h1>
  )
}
