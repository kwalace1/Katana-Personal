/**
 * Widget Layout Configuration Examples
 * 
 * This file demonstrates how to create reusable widget layout configurations
 * that can be easily switched between different dashboard views.
 */

export interface WidgetConfig {
  id: string
  type: string
  props?: Record<string, any>
  span?: {
    sm?: number
    md?: number
    lg?: number
    xl?: number
  }
}

export interface LayoutConfig {
  id: string
  name: string
  description: string
  columns: {
    sm?: number
    md?: number
    lg?: number
    xl?: number
  }
  gap: number
  widgets: WidgetConfig[]
}

// Example Layout 1: Standard Project Dashboard
export const standardDashboardLayout: LayoutConfig = {
  id: 'standard',
  name: 'Standard Dashboard',
  description: 'Basic project metrics overview',
  columns: { md: 2, lg: 3 },
  gap: 4,
  widgets: [
    {
      id: 'total-projects',
      type: 'TotalProjectsWidget',
      props: {}
    },
    {
      id: 'upcoming-deadlines',
      type: 'UpcomingDeadlinesWidget',
      props: {
        timeframe: 'Next 7 days'
      }
    },
    {
      id: 'team-members',
      type: 'TeamMembersWidget',
      props: {
        description: 'Across all projects'
      }
    }
  ]
}

// Example Layout 2: Portfolio Management Dashboard
export const portfolioDashboardLayout: LayoutConfig = {
  id: 'portfolio',
  name: 'Portfolio Dashboard',
  description: 'Comprehensive portfolio metrics',
  columns: { md: 2, lg: 5 },
  gap: 4,
  widgets: [
    {
      id: 'active-projects',
      type: 'ActiveProjectsWidget',
      props: {}
    },
    {
      id: 'portfolio-health',
      type: 'PortfolioHealthWidget',
      props: {}
    },
    {
      id: 'budget-utilization',
      type: 'BudgetUtilizationWidget',
      props: {}
    },
    {
      id: 'team-utilization',
      type: 'TeamUtilizationWidget',
      props: {}
    },
    {
      id: 'on-time-delivery',
      type: 'OnTimeDeliveryWidget',
      props: {
        trend: { value: 5, label: 'vs last month' }
      }
    }
  ]
}

// Example Layout 3: Executive Dashboard (Wide Widgets)
export const executiveDashboardLayout: LayoutConfig = {
  id: 'executive',
  name: 'Executive Dashboard',
  description: 'High-level overview with detailed activity',
  columns: { md: 2, lg: 4 },
  gap: 6,
  widgets: [
    {
      id: 'recent-activity',
      type: 'RecentActivityWidget',
      span: { md: 2, lg: 2 },
      props: {
        maxVisible: 10
      }
    },
    {
      id: 'total-projects',
      type: 'TotalProjectsWidget',
      props: {}
    },
    {
      id: 'portfolio-health',
      type: 'PortfolioHealthWidget',
      props: {}
    },
    {
      id: 'budget-utilization',
      type: 'BudgetUtilizationWidget',
      span: { md: 1, lg: 2 },
      props: {}
    }
  ]
}

// Example Layout 4: Team Dashboard
export const teamDashboardLayout: LayoutConfig = {
  id: 'team',
  name: 'Team Dashboard',
  description: 'Team-focused metrics',
  columns: { md: 2, lg: 3 },
  gap: 4,
  widgets: [
    {
      id: 'team-members',
      type: 'TeamMembersWidget',
      props: {
        description: 'Active team members'
      }
    },
    {
      id: 'team-utilization',
      type: 'TeamUtilizationWidget',
      props: {}
    },
    {
      id: 'upcoming-deadlines',
      type: 'UpcomingDeadlinesWidget',
      props: {
        timeframe: 'Next 7 days'
      }
    },
    {
      id: 'recent-activity',
      type: 'RecentActivityWidget',
      span: { md: 2, lg: 3 },
      props: {
        maxVisible: 5
      }
    }
  ]
}

// Example Layout 5: Mobile-Optimized Dashboard
export const mobileDashboardLayout: LayoutConfig = {
  id: 'mobile',
  name: 'Mobile Dashboard',
  description: 'Optimized for mobile devices',
  columns: { sm: 1, md: 2, lg: 2 },
  gap: 3,
  widgets: [
    {
      id: 'total-projects',
      type: 'TotalProjectsWidget',
      props: {}
    },
    {
      id: 'upcoming-deadlines',
      type: 'UpcomingDeadlinesWidget',
      props: {}
    },
    {
      id: 'recent-activity',
      type: 'RecentActivityWidget',
      span: { md: 2 },
      props: {
        maxVisible: 3
      }
    }
  ]
}

// Layout Registry
export const layoutRegistry: Record<string, LayoutConfig> = {
  standard: standardDashboardLayout,
  portfolio: portfolioDashboardLayout,
  executive: executiveDashboardLayout,
  team: teamDashboardLayout,
  mobile: mobileDashboardLayout
}

// Helper function to get layout by ID
export function getLayout(layoutId: string): LayoutConfig | undefined {
  return layoutRegistry[layoutId]
}

// Helper function to get all available layouts
export function getAllLayouts(): LayoutConfig[] {
  return Object.values(layoutRegistry)
}

/**
 * Usage Example in a Component:
 * 
 * import { getLayout } from '@/config/widget-layouts.example'
 * import { WidgetGrid } from '@/components/projects/widgets'
 * 
 * function Dashboard() {
 *   const [currentLayout, setCurrentLayout] = useState('standard')
 *   const layout = getLayout(currentLayout)
 *   
 *   return (
 *     <WidgetGrid columns={layout.columns} gap={layout.gap}>
 *       {layout.widgets.map(widget => {
 *         const Component = getWidgetComponent(widget.type)
 *         return (
 *           <WidgetContainer key={widget.id} span={widget.span}>
 *             <Component {...widget.props} />
 *           </WidgetContainer>
 *         )
 *       })}
 *     </WidgetGrid>
 *   )
 * }
 */







