import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BookOpen } from 'lucide-react'
import type { KycPortfolioPlaybookGroup } from '@/lib/kyc-api'
import { kycPriorityBadgeClass } from '@/components/customers/KycUi'

interface KycPortfolioPlaybooksProps {
  playbooks: KycPortfolioPlaybookGroup[]
}

export function KycPortfolioPlaybooks({ playbooks }: KycPortfolioPlaybooksProps) {
  if (playbooks.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          Portfolio playbooks
        </CardTitle>
        <CardDescription>Batch recommended plays grouped by action type across your book</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {playbooks.map((playbook) => (
          <div key={playbook.action_id} className="rounded-lg border bg-card/60 p-3 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{playbook.action_label}</span>
              <Badge variant="outline" className="text-[10px]">
                {playbook.count} account{playbook.count === 1 ? '' : 's'}
              </Badge>
              <Badge variant="outline" className={kycPriorityBadgeClass(playbook.priority)}>
                {playbook.priority} priority
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {playbook.sample_clients.join(' · ')}
              {playbook.count > playbook.sample_clients.length ? ` +${playbook.count - playbook.sample_clients.length} more` : ''}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
