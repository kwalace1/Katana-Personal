import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Headphones, MessageCircle, Target, UserRound, XCircle } from 'lucide-react'
import type { KycCsmBriefing } from '@/lib/kyc-csm-briefing'

interface KycCsmBriefingCardProps {
  briefing: KycCsmBriefing
}

function BulletList({ items, icon: Icon }: { items: string[]; icon: typeof Target }) {
  if (items.length === 0) return null
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
          <Icon className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function KycCsmBriefingCard({ briefing }: KycCsmBriefingCardProps) {
  return (
    <Card className="border-primary/25 bg-gradient-to-br from-primary/8 via-card to-card overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Headphones className="h-4 w-4 text-primary" />
          CSM call briefing
        </CardTitle>
        <p className="text-sm text-muted-foreground">{briefing.headline}</p>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 pb-5">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Who to engage</p>
          <BulletList items={briefing.who_to_engage} icon={UserRound} />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Talking points</p>
          <BulletList items={briefing.talking_points} icon={MessageCircle} />
        </div>
        {briefing.risks_to_address.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Risks to address</p>
            <BulletList items={briefing.risks_to_address} icon={XCircle} />
          </div>
        )}
        {briefing.expansion_angle && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Expansion angle</p>
            <p className="text-sm text-muted-foreground flex items-start gap-2">
              <Target className="h-4 w-4 shrink-0 mt-0.5 text-green-600" />
              {briefing.expansion_angle}
            </p>
          </div>
        )}
        {briefing.do_not_do.length > 0 && (
          <div className="md:col-span-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              Guardrails
            </p>
            {briefing.do_not_do.map((item) => (
              <p key={item} className="text-sm text-muted-foreground">
                {item}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
