import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { downloadBackup, parseBackup, restoreBackup, shareOrDownloadBackup } from '@/lib/backup'
import { ensureUserLoaded, localDb } from '@/lib/local-db'
import { SettingsDetail, SettingsPanel } from '../components/settings-ui'

export function SettingsBackupPage() {
  const { profile, updateDisplayName } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function onSaveCopy() {
    if (!profile) return
    await localDb.flush()
    try {
      const mode = await shareOrDownloadBackup(profile)
      toast.success(mode === 'shared' ? 'Shared — open on your other device' : 'Copy saved')
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      downloadBackup(profile)
      toast.success('Copy saved')
    }
  }

  async function onBringBack(file: File | null) {
    if (!file || !profile) return
    setBusy(true)
    try {
      const text = await file.text()
      const backup = parseBackup(text)
      await ensureUserLoaded(profile.id)
      restoreBackup(profile.id, backup)
      await localDb.flush()
      if (backup.profile.display_name) {
        updateDisplayName(backup.profile.display_name)
      }
      toast.success('Everything’s back')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t bring that copy back')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <SettingsDetail title="Install & backup" description="Home Screen install and .katana device copies.">
      <SettingsPanel className="mb-4">
        <h3 className="text-sm font-semibold">Install on your phone</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          On iPhone Safari: Share → <span className="font-medium text-foreground">Add to Home Screen</span>.
          On Android Chrome: menu → Install app.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Three calm layers: Home Screen for the feel, Cloud sync for devices when signed in, and a
          <code className="mx-1 rounded bg-secondary px-1 text-xs">.katana</code> copy as your safety net.
        </p>
      </SettingsPanel>

      <SettingsPanel>
        <h3 className="text-sm font-semibold">Save a copy</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Export a <code className="rounded bg-secondary px-1 text-xs">.katana</code> file before clearing a
          browser, or AirDrop between devices.
        </p>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>
            Tap <span className="font-medium text-foreground">Save a copy</span> on the device that has your data.
          </li>
          <li>Open Katana on the other device.</li>
          <li>
            Tap <span className="font-medium text-foreground">Bring a copy back</span> and pick the file.
          </li>
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button className="min-h-11" onClick={() => void onSaveCopy()}>
            Save a copy
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".katana,application/octet-stream,*/*"
            className="hidden"
            onChange={(e) => void onBringBack(e.target.files?.[0] ?? null)}
          />
          <Button
            variant="outline"
            className="min-h-11"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? 'Bringing it back…' : 'Bring a copy back'}
          </Button>
        </div>
      </SettingsPanel>
    </SettingsDetail>
  )
}
