import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { usePlusStatus } from '@/components/PlusPaywall'
import { startPlusCheckout } from '@/lib/billing/stripe-client'
import {
  FREE_LLM_ASKS_PER_DAY,
  demoPlusAllowed,
  freeLlmAsksRemaining,
  setPlusUnlocked,
} from '@/lib/plus'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { PlusFeatureMatrix } from '../components/PlusFeatureMatrix'
import { SettingsDetail, SettingsPanel } from '../components/settings-ui'

export function SettingsPlusPage() {
  const plus = usePlusStatus()
  const { cloudUser, cloudProfile } = useCloudAuth()
  const llmLeft = plus ? null : freeLlmAsksRemaining()
  const showDemo = demoPlusAllowed()

  return (
    <SettingsDetail
      title="Katana Plus"
      description="The accountability pack — deeper Ask, integrations, and proactive nudges."
    >
      <SettingsPanel>
        {plus ? (
          <div className="rounded-2xl border border-primary/25 bg-primary/[0.06] px-4 py-3">
            <p className="text-sm font-medium text-primary">Accountability pack is on</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Deeper Ask · Google Calendar · Fitbit · Strava · orchestration push · challenges · meal AI.
            </p>
            {showDemo ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => {
                  setPlusUnlocked(false)
                  toast.message('Back to Free')
                }}
              >
                Turn off Plus (dev)
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <PlusFeatureMatrix />
            {llmLeft != null ? (
              <p className="text-xs text-muted-foreground">
                Deeper Ask left today: {llmLeft}/{FREE_LLM_ASKS_PER_DAY}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="min-h-11"
                onClick={async () => {
                  const result = await startPlusCheckout({
                    email: cloudProfile?.email || undefined,
                    uid: cloudUser?.uid,
                  })
                  if (result.url) {
                    window.location.href = result.url
                    return
                  }
                  if (result.demo) {
                    toast.message(
                      'Store billing isn’t live yet. Plus will unlock through the App Store — or Stripe when keys are set.',
                    )
                    return
                  }
                  toast.error(result.error || 'Checkout unavailable')
                }}
              >
                Subscribe
              </Button>
              {showDemo ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => {
                    setPlusUnlocked(true)
                    toast.success('Accountability pack unlocked (dev)')
                  }}
                >
                  Unlock for testing
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Free is the full daily OS. Plus is optional — meal AI, extra Ask depth, challenges, and live
              calendar & health apps.
            </p>
          </div>
        )}
      </SettingsPanel>
    </SettingsDetail>
  )
}
