import { FormEvent, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { SettingsDetail, SettingsPanel } from '../components/settings-ui'

export function SettingsProfilePage() {
  const { profile } = useAuth()
  const { saveDisplayName, cloudUser } = useCloudAuth()
  const [name, setName] = useState(profile?.display_name || '')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (profile?.display_name) setName(profile.display_name)
  }, [profile?.display_name])

  async function onSaveName(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await saveDisplayName(name)
      toast.success(cloudUser ? 'Name saved everywhere' : 'Saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t save name')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingsDetail title="Profile" description="How friends see you in Circles and invites.">
      <SettingsPanel>
        <form onSubmit={(e) => void onSaveName(e)} className="space-y-3">
          <Label htmlFor="display-name">Display name</Label>
          <div className="flex gap-2">
            <Input id="display-name" value={name} onChange={(e) => setName(e.target.value)} />
            <Button type="submit" disabled={busy}>
              Save
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {cloudUser
              ? 'Updates your cloud profile and local workspace.'
              : 'Stored on this device until you sign in to Together.'}
          </p>
        </form>
      </SettingsPanel>
    </SettingsDetail>
  )
}
