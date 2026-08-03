import { FormEvent, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BrandMark } from '@/components/BrandMark'
import { useAuth } from '@/contexts/AuthContext'
import { parseBackup, restoreBackup } from '@/lib/backup'
import { createId } from '@/lib/id'
import { ensureUserLoaded, localDb } from '@/lib/local-db'

export default function AuthPage() {
  const { user, loading, startWorkspace } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />
  }

  async function onStart(e: FormEvent) {
    e.preventDefault()
    await startWorkspace(name || 'You')
    toast.success('Welcome in')
    navigate('/dashboard')
  }

  async function onBringBack(file: File | null) {
    if (!file) return
    setBusy(true)
    try {
      const text = await file.text()
      const backup = parseBackup(text)
      const workspaceId = createId()
      await ensureUserLoaded(workspaceId)
      restoreBackup(workspaceId, backup)
      await localDb.flush()
      await startWorkspace(backup.profile.display_name || name || 'You', {
        id: workspaceId,
        preferences: backup.profile.preferences || {},
      })
      toast.success('Welcome back')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t bring that copy back')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-[hsl(168_45%_70%/0.25)] blur-3xl" />
      </div>
      <div className="kp-surface relative w-full max-w-md p-8 sm:p-10">
        <BrandMark to="/" />
        <h1 className="font-display mt-8 text-3xl tracking-tight">Make it yours</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Your life stays on this device. Private, simple, and ready when you are.
        </p>

        <form onSubmit={(e) => void onStart(e)} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">What should we call you?</Label>
            <Input
              id="name"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 rounded-xl"
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full" size="lg">
            Begin
          </Button>
        </form>

        <div className="mt-8 border-t border-border/60 pt-6">
          <p className="mb-3 text-xs text-muted-foreground">Coming back with a saved copy?</p>
          <input
            ref={fileRef}
            type="file"
            accept=".katana,application/octet-stream,*/*"
            className="hidden"
            onChange={(e) => void onBringBack(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? 'Bringing it back…' : 'Bring a copy back'}
          </Button>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="underline-offset-4 hover:underline">
            Back
          </Link>
        </p>
      </div>
    </div>
  )
}
