import { CheckCheck, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  EMPLOYEE_FEED_MODULE_FILTER_OPTIONS,
  type EmployeeFeedDisplayMode,
  type EmployeeFeedModuleFilter,
  type EmployeeFeedScope,
  type EmployeeFeedTypeFilter,
} from '@/lib/employee-portal-feed'

interface EmployeePortalFeedFiltersProps {
  displayMode: EmployeeFeedDisplayMode
  onDisplayModeChange: (mode: EmployeeFeedDisplayMode) => void
  activeCount: number
  historyCount: number
  scope: EmployeeFeedScope
  typeFilter: EmployeeFeedTypeFilter
  moduleFilter: EmployeeFeedModuleFilter
  onScopeChange: (scope: EmployeeFeedScope) => void
  onTypeFilterChange: (type: EmployeeFeedTypeFilter) => void
  onModuleFilterChange: (module: EmployeeFeedModuleFilter) => void
  forYouCount: number
  companyCount: number
  totalCount: number
  unreadAttentionCount?: number
  onMarkAllRead?: () => void
  markAllReadLoading?: boolean
}

export function EmployeePortalFeedFilters({
  displayMode,
  onDisplayModeChange,
  activeCount,
  historyCount,
  scope,
  typeFilter,
  moduleFilter,
  onScopeChange,
  onTypeFilterChange,
  onModuleFilterChange,
  forYouCount,
  companyCount,
  totalCount,
  unreadAttentionCount = 0,
  onMarkAllRead,
  markAllReadLoading = false,
}: EmployeePortalFeedFiltersProps) {
  return (
    <div className="flex flex-col gap-3 px-1">
      <Tabs
        value={displayMode}
        onValueChange={(v) => onDisplayModeChange(v as EmployeeFeedDisplayMode)}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2 sm:inline-flex">
          <TabsTrigger value="active" className="text-xs sm:text-sm">
            Inbox{activeCount > 0 ? ` (${activeCount})` : ''}
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs sm:text-sm">
            History{historyCount > 0 ? ` (${historyCount})` : ''}
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {displayMode === 'active' && unreadAttentionCount > 0 && onMarkAllRead && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            disabled={markAllReadLoading}
            onClick={() => onMarkAllRead()}
          >
            {markAllReadLoading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
            )}
            Mark all read
          </Button>
        </div>
      )}
      <Tabs
        value={scope}
        onValueChange={(v) => onScopeChange(v as EmployeeFeedScope)}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3 sm:inline-flex">
          <TabsTrigger value="all" className="text-xs sm:text-sm">
            All ({totalCount})
          </TabsTrigger>
          <TabsTrigger value="for_you" className="text-xs sm:text-sm">
            For you ({forYouCount})
          </TabsTrigger>
          <TabsTrigger value="company" className="text-xs sm:text-sm">
            Company ({companyCount})
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={typeFilter} onValueChange={(v) => onTypeFilterChange(v as EmployeeFeedTypeFilter)}>
          <SelectTrigger className="w-full sm:flex-1" aria-label="Filter feed by type">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="assigned">Assigned to me</SelectItem>
            <SelectItem value="updates">Updates & alerts</SelectItem>
            <SelectItem value="deadlines">Deadlines</SelectItem>
            <SelectItem value="projects">Projects</SelectItem>
            <SelectItem value="achievements">Achievements</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={moduleFilter}
          onValueChange={(v) => onModuleFilterChange(v as EmployeeFeedModuleFilter)}
        >
          <SelectTrigger className="w-full sm:flex-1" aria-label="Filter feed by module">
            <SelectValue placeholder="Filter by module" />
          </SelectTrigger>
          <SelectContent>
            {EMPLOYEE_FEED_MODULE_FILTER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
