import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Loader2, Save, FileText, Flag, ThumbsUp, ThumbsDown } from 'lucide-react'
import { getClientIntel, upsertClientIntel, type KycClientIntel } from '@/lib/kyc-api'
import { useToast } from '@/hooks/use-toast'

interface KycClientIntelEditorProps {
  clientId: string
  embedded?: boolean
}

function parseList(value: string): string[] {
  return value
    .split(/[,;|/]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function joinList(items: string[]): string {
  return items.join(', ')
}

export function KycClientIntelEditor({ clientId, embedded }: KycClientIntelEditorProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    motivations: '',
    decisionDrivers: '',
    redFlags: '',
    greenFlags: '',
    messagingApproach: '',
    nextSteps: '',
  })

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void getClientIntel(clientId).then((intel) => {
      if (cancelled) return
      if (intel) {
        setForm({
          motivations: intel.motivations ?? '',
          decisionDrivers: joinList(intel.decision_drivers),
          redFlags: joinList(intel.red_flags),
          greenFlags: joinList(intel.green_flags),
          messagingApproach: intel.ideal_messaging_approach ?? '',
          nextSteps: intel.notes_next_steps ?? '',
        })
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [clientId])

  const handleSave = async () => {
    setSaving(true)
    const patch: Partial<KycClientIntel> = {
      motivations: form.motivations || null,
      decision_drivers: parseList(form.decisionDrivers),
      red_flags: parseList(form.redFlags),
      green_flags: parseList(form.greenFlags),
      ideal_messaging_approach: form.messagingApproach || null,
      notes_next_steps: form.nextSteps || null,
    }
    const saved = await upsertClientIntel(clientId, patch)
    setSaving(false)
    if (saved) {
      toast({ title: 'Account intel saved' })
    } else {
      toast({
        title: 'Could not save intel',
        description: 'Run supabase-kyc-migration.sql if cs_client_intel is missing.',
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading account intel…
      </div>
    )
  }

  return (
    <div className={embedded ? 'space-y-4' : 'space-y-4 rounded-xl border bg-card p-4'}>
      {!embedded && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-medium">Account intel</p>
              <p className="text-xs text-muted-foreground">Motivations, flags, and messaging angles</p>
            </div>
          </div>
          <Badge variant="outline">CSM notes</Badge>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="kyc-motivations">Motivations</Label>
        <Textarea
          id="kyc-motivations"
          rows={2}
          placeholder="What does this customer care about most?"
          value={form.motivations}
          onChange={(e) => setForm({ ...form, motivations: e.target.value })}
          className="resize-none"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="kyc-drivers" className="flex items-center gap-1.5">
            <Flag className="h-3.5 w-3.5 text-muted-foreground" />
            Decision drivers
          </Label>
          <Input
            id="kyc-drivers"
            placeholder="ROI, compliance, speed"
            value={form.decisionDrivers}
            onChange={(e) => setForm({ ...form, decisionDrivers: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="kyc-messaging">Ideal messaging approach</Label>
          <Input
            id="kyc-messaging"
            placeholder="Lead with cost savings and uptime"
            value={form.messagingApproach}
            onChange={(e) => setForm({ ...form, messagingApproach: e.target.value })}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2 rounded-lg border border-green-500/20 bg-green-500/5 p-3">
          <Label htmlFor="kyc-green" className="flex items-center gap-1.5 text-green-700 dark:text-green-400">
            <ThumbsUp className="h-3.5 w-3.5" />
            Green flags
          </Label>
          <Input
            id="kyc-green"
            placeholder="Champion engaged, expanding team"
            value={form.greenFlags}
            onChange={(e) => setForm({ ...form, greenFlags: e.target.value })}
            className="bg-background"
          />
        </div>
        <div className="space-y-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
          <Label htmlFor="kyc-red" className="flex items-center gap-1.5 text-red-700 dark:text-red-400">
            <ThumbsDown className="h-3.5 w-3.5" />
            Red flags
          </Label>
          <Input
            id="kyc-red"
            placeholder="Budget freeze, champion left"
            value={form.redFlags}
            onChange={(e) => setForm({ ...form, redFlags: e.target.value })}
            className="bg-background"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="kyc-next">Next steps</Label>
        <Textarea
          id="kyc-next"
          rows={2}
          placeholder="Schedule QBR, send case study, intro to support lead"
          value={form.nextSteps}
          onChange={(e) => setForm({ ...form, nextSteps: e.target.value })}
          className="resize-none"
        />
      </div>

      <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
        Save intel
      </Button>
    </div>
  )
}
