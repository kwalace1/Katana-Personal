import { TabsList, TabsTrigger } from '@/components/ui/tabs'

/** Grouped company tabs: same tab values as KYICompanyPage, fewer clicks for cap-raise workflow. */
export function KyiCompanyNav({
  targetedCount,
}: {
  targetedCount: number
}) {
  return (
    <div className="space-y-2" data-tour="kyi-company-nav">
      <TabsList className="bg-muted/50 p-1 h-auto flex flex-wrap gap-1 w-full justify-start">
        <TabsTrigger value="overview" className="text-xs sm:text-sm">
          Overview
        </TabsTrigger>
        <span className="hidden sm:inline self-center text-muted-foreground/50 px-0.5" aria-hidden>
          |
        </span>
        <TabsTrigger value="geo" className="text-xs sm:text-sm" data-tour="kyi-company-tab-geo">
          Geo targeting
        </TabsTrigger>
        <TabsTrigger value="leads" className="text-xs sm:text-sm" data-tour="kyi-company-tab-leads">
          Localized leads
        </TabsTrigger>
        <TabsTrigger value="accessmap" className="text-xs sm:text-sm" data-tour="kyi-company-tab-accessmap">
          Access Map
        </TabsTrigger>
        <span className="hidden sm:inline self-center text-muted-foreground/50 px-0.5" aria-hidden>
          |
        </span>
        <TabsTrigger value="contacts" className="text-xs sm:text-sm" data-tour="kyi-company-tab-contacts">
          Contacts
          {targetedCount > 0 && (
            <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0 text-[10px] font-semibold tabular-nums">
              {targetedCount}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="northstar" className="text-xs sm:text-sm" data-tour="kyi-company-tab-northstar">
          Northstar
        </TabsTrigger>
      </TabsList>
      <p className="text-xs text-muted-foreground hidden md:block">
        <span className="font-medium text-foreground/80">Workflow:</span> set geo → review leads & Access Map →
        build your targeted list · use Raise intel for ecosystem Q&amp;A · upload My network to grow coverage.
      </p>
    </div>
  )
}

export type KyiContactSegment = 'employees' | 'current' | 'targeted' | 'network'

const SEGMENT_LABELS: Record<KyiContactSegment, string> = {
  employees: 'Employees',
  current: 'Current investors',
  targeted: 'Targeted investors',
  network: 'My network',
}

export function KyiContactSegmentNav({
  segment,
  counts,
  onSegmentChange,
}: {
  segment: KyiContactSegment
  counts: { employees: number; current: number; targeted: number; network: number }
  onSegmentChange: (segment: KyiContactSegment) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {(['employees', 'network', 'current', 'targeted'] as const).map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onSegmentChange(key)}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
            segment === key
              ? 'border-primary/40 bg-primary/10 text-foreground font-medium'
              : 'border-border bg-background text-muted-foreground hover:bg-muted/50'
          }`}
        >
          {SEGMENT_LABELS[key]}
          <span className="tabular-nums text-xs opacity-70">{counts[key]}</span>
        </button>
      ))}
    </div>
  )
}
