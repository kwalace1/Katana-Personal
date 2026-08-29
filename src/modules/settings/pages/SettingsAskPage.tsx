import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { ASK_PERSONALITIES, parseAskPersonality } from '@/modules/assistant/personality'
import { SettingsDetail, SettingsPanel } from '../components/settings-ui'

export function SettingsAskPage() {
  const { profile, updatePreferences } = useAuth()
  const askPersonality = parseAskPersonality(profile?.preferences)

  return (
    <SettingsDetail title="Ask coach voice" description="How Katana talks to you in Ask — set once, change anytime.">
      <SettingsPanel>
        <div className="grid gap-2 sm:grid-cols-2">
          {ASK_PERSONALITIES.map((p) => {
            const on = askPersonality === p.id
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  updatePreferences({ ask_personality: p.id })
                  toast.message(`${p.label} voice on`)
                }}
                className={cn(
                  'rounded-2xl border px-4 py-3 text-left transition',
                  on
                    ? 'border-primary/40 bg-primary/[0.08]'
                    : 'border-border/50 bg-card/40 hover:bg-secondary/50',
                )}
              >
                <p className={cn('text-sm font-semibold', on && 'text-primary')}>{p.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{p.blurb}</p>
              </button>
            )
          })}
        </div>
      </SettingsPanel>
    </SettingsDetail>
  )
}
