import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { seedDemoWorkspace } from '@/lib/seed-demo'
import { SettingsDetail, SettingsPanel } from '../components/settings-ui'

export function SettingsAdvancedPage() {
  const { user, resetOnboarding } = useAuth()

  return (
    <SettingsDetail title="Advanced" description="Demo data and onboarding tips.">
      <SettingsPanel className="mb-4">
        <h3 className="text-sm font-semibold">Demo data</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Fill an empty workspace with sample tasks, habits, and a focus block — useful for demos.
        </p>
        <Button
          variant="outline"
          className="mt-3"
          onClick={() => {
            if (!user) return
            const result = seedDemoWorkspace(user.id)
            if (result.seeded) toast.success('Demo day loaded — open Today')
            else if (result.reason === 'already') toast.message('Demo data was already added')
            else toast.message('Workspace isn’t empty — clear tasks first or use a fresh start')
          }}
        >
          Load demo day
        </Button>
      </SettingsPanel>

      <SettingsPanel>
        <h3 className="text-sm font-semibold">Tips</h3>
        <p className="mt-1 text-sm text-muted-foreground">Show the getting-started checklist on Today again.</p>
        <Button
          variant="outline"
          className="mt-3"
          onClick={() => {
            resetOnboarding()
            toast.message('Tips are back on Today')
          }}
        >
          Show tips again
        </Button>
      </SettingsPanel>
    </SettingsDetail>
  )
}
