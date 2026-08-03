import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Activity, Brain, DollarSign, LayoutDashboard, Users } from 'lucide-react'
import type { Client } from '@/lib/customer-success-api'
import type { ClientIntelligenceResult } from '@/lib/kyc-client-scoring'
import type { KycCsmBriefing } from '@/lib/kyc-csm-briefing'
import type { KycRevenueIntel } from '@/lib/kyc-revenue-intel'
import type { CrmContact } from '@/lib/customer-crm-api'
import type { KycSummarySource } from '@/lib/kyc-client-summary'
import { KycAccountOverview } from '@/components/customers/KycAccountOverview'
import { KycCsmBriefingCard } from '@/components/customers/KycCsmBriefingCard'
import { KycAccountActivityPanel } from '@/components/customers/KycAccountActivityPanel'
import { KycAccountPeoplePanel } from '@/components/customers/KycAccountPeoplePanel'
import { KycAccountRevenuePanel } from '@/components/customers/KycAccountRevenuePanel'
import { KycAccountIntelligencePanel } from '@/components/customers/KycAccountIntelligencePanel'
import { KycRelationshipMap } from '@/components/customers/KycRelationshipMap'

interface KycAccountWorkspaceProps {
  client: Client
  intel: ClientIntelligenceResult
  briefing: KycCsmBriefing
  revenue: KycRevenueIntel
  contacts: CrmContact[]
  outreachSlot?: React.ReactNode
  executiveSummary?: {
    text: string
    source: KycSummarySource
    loading?: boolean
    refreshing?: boolean
    generatedAt?: string | null
    onRefresh?: () => void
  }
  onRefresh?: () => void
  onActionTaskCreated?: () => void
}

export function KycAccountWorkspace({
  client,
  intel,
  briefing,
  revenue,
  contacts,
  outreachSlot,
  executiveSummary,
  onRefresh,
  onActionTaskCreated,
}: KycAccountWorkspaceProps) {
  return (
    <div className="space-y-4">
      <KycCsmBriefingCard briefing={briefing} />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="overview" className="gap-1.5 text-xs sm:text-sm">
            <LayoutDashboard className="h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5 text-xs sm:text-sm">
            <Activity className="h-3.5 w-3.5" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="people" className="gap-1.5 text-xs sm:text-sm">
            <Users className="h-3.5 w-3.5" />
            People
          </TabsTrigger>
          <TabsTrigger value="revenue" className="gap-1.5 text-xs sm:text-sm">
            <DollarSign className="h-3.5 w-3.5" />
            Revenue
          </TabsTrigger>
          <TabsTrigger value="intelligence" className="gap-1.5 text-xs sm:text-sm">
            <Brain className="h-3.5 w-3.5" />
            Intelligence
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <KycAccountOverview
            client={client}
            intel={intel}
            outreachSlot={outreachSlot}
            executiveSummary={executiveSummary}
            onActionTaskCreated={onActionTaskCreated}
          />
        </TabsContent>

        <TabsContent value="activity">
          <KycAccountActivityPanel client={client} />
        </TabsContent>

        <TabsContent value="people" className="space-y-4">
          <KycAccountPeoplePanel contacts={contacts} onUpdated={onRefresh} />
          <KycRelationshipMap client={client} embedded />
        </TabsContent>

        <TabsContent value="revenue">
          <KycAccountRevenuePanel revenue={revenue} />
        </TabsContent>

        <TabsContent value="intelligence">
          <KycAccountIntelligencePanel client={client} intel={intel} onRefreshed={onRefresh} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
