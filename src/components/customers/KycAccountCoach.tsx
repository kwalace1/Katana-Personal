import { useCallback, useState } from 'react'
import { HelpCircle, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import type { Client } from '@/lib/customer-success-api'
import type { ClientIntelligenceResult } from '@/lib/kyc-client-scoring'
import { generateAccountCoachGuidance } from '@/lib/kyc-coach-api'
import { kycPriorityBadgeClass } from '@/components/customers/KycUi'

interface KycAccountCoachProps {
  client: Client
  intel: ClientIntelligenceResult
}

export function KycAccountCoach({ client, intel }: KycAccountCoachProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [coachText, setCoachText] = useState<string | null>(null)
  const [priority, setPriority] = useState<string>('medium')
  const [source, setSource] = useState<string>('template')

  const loadCoach = useCallback(
    async (force = false) => {
      setLoading(true)
      try {
        const result = await generateAccountCoachGuidance(client, intel, { force })
        setCoachText(result.formatted)
        setPriority(result.response.priority)
        setSource(result.source)
      } finally {
        setLoading(false)
      }
    },
    [client, intel],
  )

  const handleOpen = () => {
    setOpen(true)
    if (!coachText) void loadCoach()
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={handleOpen}>
        <HelpCircle className="h-3.5 w-3.5" />
        What should I do with this account?
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              Account coach
            </DialogTitle>
            <DialogDescription>
              Short, specific guidance for {client.name} — grounded in known account data only.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {loading && !coachText ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing account signals…
              </div>
            ) : coachText ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={kycPriorityBadgeClass(priority)}>
                    {priority} priority
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {source === 'ai' ? 'AI coach' : source === 'cached' ? 'Cached' : 'Data-driven'}
                  </Badge>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed whitespace-pre-wrap">
                  {coachText}
                </div>
                <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void loadCoach(true)}>
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                  Refresh guidance
                </Button>
              </div>
            ) : null}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  )
}
