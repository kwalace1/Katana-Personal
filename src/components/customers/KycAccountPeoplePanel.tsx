import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2, Mail, Phone, Users } from 'lucide-react'
import type { CrmContact, ContactRole, ContactSentiment } from '@/lib/customer-crm-api'
import { contactDisplayName, updateContact } from '@/lib/customer-crm-api'
import { formatDateOnly } from '@/lib/due-date-utils'
import { KycEmptyState } from '@/components/customers/KycUi'
import { useToast } from '@/hooks/use-toast'

const ROLE_LABELS: Record<ContactRole, string> = {
  contact: 'Contact',
  decision_maker: 'Decision maker',
  champion: 'Champion',
  influencer: 'Influencer',
  blocker: 'Blocker',
}

const SENTIMENT_CLASS: Record<ContactSentiment, string> = {
  positive: 'bg-green-500/10 text-green-600 border-green-500/20',
  neutral: 'bg-muted text-muted-foreground border-border',
  negative: 'bg-red-500/10 text-red-600 border-red-500/20',
}

interface KycAccountPeoplePanelProps {
  contacts: CrmContact[]
  onUpdated?: () => void
}

export function KycAccountPeoplePanel({ contacts, onUpdated }: KycAccountPeoplePanelProps) {
  const { toast } = useToast()
  const [savingId, setSavingId] = useState<string | null>(null)

  const handleUpdate = async (contact: CrmContact, patch: Partial<CrmContact>) => {
    setSavingId(contact.id)
    const ok = await updateContact(contact.id, patch)
    setSavingId(null)
    if (ok) {
      toast({ title: 'Contact updated' })
      onUpdated?.()
    } else {
      toast({ title: 'Could not update contact', variant: 'destructive' })
    }
  }

  if (contacts.length === 0) {
    return (
      <KycEmptyState
        icon={Users}
        title="No contacts mapped"
        description="Add contacts with roles and sentiment to strengthen relationship intelligence."
      />
    )
  }

  return (
    <div className="space-y-3">
      {contacts.map((contact) => {
        const role = (contact.contact_role ?? (contact.is_decision_maker ? 'decision_maker' : 'contact')) as ContactRole
        const sentiment = (contact.sentiment ?? 'neutral') as ContactSentiment
        const strength = contact.relationship_strength ?? 3

        return (
          <Card key={contact.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{contactDisplayName(contact)}</p>
                  <p className="text-sm text-muted-foreground">{contact.job_title || 'No title'}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">{ROLE_LABELS[role]}</Badge>
                  <Badge variant="outline" className={SENTIMENT_CLASS[sentiment]}>
                    {sentiment}
                  </Badge>
                  {contact.is_primary && <Badge variant="outline">Primary</Badge>}
                </div>
              </div>

              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {contact.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {contact.email}
                  </span>
                )}
                {contact.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {contact.phone}
                  </span>
                )}
                {contact.last_contact_date && (
                  <span>Last contact: {formatDateOnly(contact.last_contact_date)}</span>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs">Role</Label>
                  <select
                    className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                    value={role}
                    disabled={savingId === contact.id}
                    onChange={(e) =>
                      void handleUpdate(contact, {
                        contact_role: e.target.value as ContactRole,
                        is_decision_maker: e.target.value === 'decision_maker',
                      })
                    }
                  >
                    {Object.entries(ROLE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Sentiment</Label>
                  <select
                    className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                    value={sentiment}
                    disabled={savingId === contact.id}
                    onChange={(e) =>
                      void handleUpdate(contact, { sentiment: e.target.value as ContactSentiment })
                    }
                  >
                    <option value="positive">Positive</option>
                    <option value="neutral">Neutral</option>
                    <option value="negative">Negative</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Relationship strength ({strength}/5)</Label>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={strength}
                    disabled={savingId === contact.id}
                    className="w-full"
                    onChange={(e) =>
                      void handleUpdate(contact, { relationship_strength: Number(e.target.value) })
                    }
                  />
                </div>
              </div>

              {savingId === contact.id && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving…
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
