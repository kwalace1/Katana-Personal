/**
 * Katana Customers (customer-success) freeform (v2) widget catalogs.
 * Surfaces: every main tab + client_detail.
 */

import type { Layout } from 'react-grid-layout'
import {
  addWidgetToLayout,
  applyGridLayoutChange,
  availableCatalogEntries,
  normalizeModuleWidgetLayout,
  removeWidgetFromLayout,
  type ModuleWidgetItem,
  type ModuleWidgetLayout,
  type WidgetCatalogEntry,
} from '@/lib/module-widget-layout'

/** Shared freeform layout props passed from CustomerSuccessPage into each tab component. */
export interface CustomersTabLayoutProps {
  widgets: ModuleWidgetItem[]
  catalog: readonly WidgetCatalogEntry[]
  customizeMode: boolean
  onLayoutChange: (layout: Layout[]) => void
  onRemoveWidget: (widgetId: string) => void
}

export const CUSTOMERS_MODULE_ID = 'customer-success'
export const CUSTOMERS_DASHBOARD_SURFACE = 'dashboard'
export const CUSTOMERS_CLIENT_DETAIL_SURFACE = 'client_detail'

export type CustomersTabSurfaceId =
  | 'dashboard'
  | 'pipeline'
  | 'leads'
  | 'clients'
  | 'contacts'
  | 'tasks'
  | 'milestones'
  | 'interactions'
  | 'commerce'
  | 'campaigns'
  | 'analytics'

export const CUSTOMERS_TAB_SURFACE_IDS: CustomersTabSurfaceId[] = [
  'dashboard',
  'pipeline',
  'leads',
  'clients',
  'contacts',
  'tasks',
  'milestones',
  'interactions',
  'commerce',
  'campaigns',
  'analytics',
]

function entry(
  id: string,
  label: string,
  description: string,
  defaultW: number,
  defaultH: number,
  minW = 2,
  minH = 2
): WidgetCatalogEntry {
  return { id, label, description, defaultW, defaultH, minW, minH }
}

function item(
  i: string,
  x: number,
  y: number,
  w: number,
  h: number,
  minW?: number,
  minH?: number
): ModuleWidgetItem {
  return { i, x, y, w, h, minW, minH }
}

function makeSurface(
  catalog: WidgetCatalogEntry[],
  defaults: ModuleWidgetItem[]
) {
  const normalize = (raw: unknown) =>
    normalizeModuleWidgetLayout(raw, catalog, defaults, {})
  const toBase = (layout: ModuleWidgetLayout): ModuleWidgetLayout => ({
    version: 2,
    widgets: layout.widgets,
    extras: layout.extras ?? {},
  })
  return { catalog, defaults, normalize, toBase }
}

// --- Dashboard ---

export const CUSTOMERS_DASHBOARD_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('stats', 'Stats', 'Customers, attention, engagement, overdue tasks, pipeline, leads', 12, 3, 6, 2),
  entry('customer_list', 'Customer list', 'Filtered customers with health trends', 8, 12, 4, 6),
  entry('quick_stats', 'Quick stats', 'Task progress, overdue, and at-risk snapshot', 4, 6, 3, 3),
  entry('recent_activity', 'Recent activity', 'Latest customer interactions', 4, 6, 3, 3),
  entry('integrations', 'Integrations', 'CRM integrations panel', 12, 5, 4, 3),
  entry('kyc_portfolio_summary', 'Portfolio summary', 'KYC portfolio health summary bar', 12, 4, 4, 2),
  entry('icp_profile', 'ICP profile', 'Ideal customer profile card', 6, 6, 3, 3),
  entry('metric_total_customers', 'Total customers', 'Single metric: total customers', 2, 3),
  entry('metric_needs_attention', 'Needs attention', 'Single metric: accounts needing attention', 2, 3),
  entry('metric_avg_engagement', 'Avg engagement', 'Single metric: average engagement', 2, 3),
  entry('metric_overdue_tasks', 'Overdue tasks', 'Single metric: overdue tasks', 2, 3),
  entry('metric_pipeline', 'Pipeline', 'Single metric: pipeline value', 2, 3),
  entry('metric_new_leads', 'New leads', 'Single metric: new leads', 2, 3),
]

export const DEFAULT_CUSTOMERS_DASHBOARD_WIDGETS: ModuleWidgetItem[] = [
  item('stats', 0, 0, 12, 3, 6, 2),
  item('customer_list', 0, 3, 8, 12, 4, 6),
  item('quick_stats', 8, 3, 4, 6, 3, 3),
  item('recent_activity', 8, 9, 4, 6, 3, 3),
  item('integrations', 0, 15, 12, 5, 4, 3),
]

const dashboardSurface = makeSurface(
  CUSTOMERS_DASHBOARD_WIDGET_CATALOG,
  DEFAULT_CUSTOMERS_DASHBOARD_WIDGETS
)
export const normalizeCustomersDashboardWidgetLayout = dashboardSurface.normalize
export const customersDashboardWidgetLayoutToBase = dashboardSurface.toBase
export type CustomersDashboardWidgetLayout = ModuleWidgetLayout

// --- Pipeline ---

export const CUSTOMERS_PIPELINE_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('pipeline_value', 'Pipeline value', 'Open pipeline dollar total', 12, 2, 4, 2),
  entry('deal_board', 'Deal board', 'Kanban board of open deals by stage', 12, 14, 6, 8),
  entry('closed_deals', 'Closed deals', 'Recently won and lost deals', 12, 6, 4, 4),
]

export const DEFAULT_CUSTOMERS_PIPELINE_WIDGETS: ModuleWidgetItem[] = [
  item('pipeline_value', 0, 0, 12, 2, 4, 2),
  item('deal_board', 0, 2, 12, 14, 6, 8),
  item('closed_deals', 0, 16, 12, 6, 4, 4),
]

const pipelineSurface = makeSurface(
  CUSTOMERS_PIPELINE_WIDGET_CATALOG,
  DEFAULT_CUSTOMERS_PIPELINE_WIDGETS
)
export const normalizeCustomersPipelineWidgetLayout = pipelineSurface.normalize
export const customersPipelineWidgetLayoutToBase = pipelineSurface.toBase

// --- Leads ---

export const CUSTOMERS_LEADS_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('lead_filters', 'Lead filters', 'Status and sort controls', 12, 2, 4, 2),
  entry('lead_capture', 'Lead capture', 'Public lead capture URL and settings', 12, 4, 4, 3),
  entry('lead_list', 'Lead list', 'Filtered leads with fit and convert actions', 12, 14, 6, 8),
  entry('metric_lead_count', 'Lead count', 'Total leads in view', 4, 3),
  entry('metric_qualified', 'Qualified', 'Qualified lead count', 4, 3),
  entry('metric_converted', 'Converted', 'Converted lead count', 4, 3),
]

export const DEFAULT_CUSTOMERS_LEADS_WIDGETS: ModuleWidgetItem[] = [
  item('lead_filters', 0, 0, 12, 2, 4, 2),
  item('lead_capture', 0, 2, 12, 4, 4, 3),
  item('lead_list', 0, 6, 12, 14, 6, 8),
]

const leadsSurface = makeSurface(CUSTOMERS_LEADS_WIDGET_CATALOG, DEFAULT_CUSTOMERS_LEADS_WIDGETS)
export const normalizeCustomersLeadsWidgetLayout = leadsSurface.normalize
export const customersLeadsWidgetLayoutToBase = leadsSurface.toBase

// --- Clients ---

export const CUSTOMERS_CLIENTS_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('portfolio_summary', 'Portfolio summary', 'KYC portfolio health tiles', 12, 4, 4, 2),
  entry('top_actions', 'Top actions', 'Highest-priority account actions', 8, 6, 4, 3),
  entry('outreach_pipeline', 'Outreach pipeline', 'Outreach-by-status chips', 4, 6, 3, 3),
  entry('playbooks', 'Playbooks', 'Portfolio playbooks', 12, 5, 4, 3),
  entry('client_filters', 'Directory filters', 'Search and status filters', 12, 2, 4, 2),
  entry('client_directory', 'Customer directory', 'Customer table with open/edit actions', 12, 14, 6, 8),
]

export const DEFAULT_CUSTOMERS_CLIENTS_WIDGETS: ModuleWidgetItem[] = [
  item('portfolio_summary', 0, 0, 12, 4, 4, 2),
  item('top_actions', 0, 4, 8, 6, 4, 3),
  item('outreach_pipeline', 8, 4, 4, 6, 3, 3),
  item('playbooks', 0, 10, 12, 5, 4, 3),
  item('client_filters', 0, 15, 12, 2, 4, 2),
  item('client_directory', 0, 17, 12, 14, 6, 8),
]

const clientsSurface = makeSurface(
  CUSTOMERS_CLIENTS_WIDGET_CATALOG,
  DEFAULT_CUSTOMERS_CLIENTS_WIDGETS
)
export const normalizeCustomersClientsWidgetLayout = clientsSurface.normalize
export const customersClientsWidgetLayoutToBase = clientsSurface.toBase

// --- Contacts ---

export const CUSTOMERS_CONTACTS_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('contact_filters', 'Contact filters', 'Search and account filter', 12, 2, 4, 2),
  entry('contact_list', 'Contact list', 'Contact cards and details', 12, 14, 6, 8),
  entry('metric_contact_count', 'Contact count', 'Total contacts', 4, 3),
]

export const DEFAULT_CUSTOMERS_CONTACTS_WIDGETS: ModuleWidgetItem[] = [
  item('contact_filters', 0, 0, 12, 2, 4, 2),
  item('contact_list', 0, 2, 12, 14, 6, 8),
]

const contactsSurface = makeSurface(
  CUSTOMERS_CONTACTS_WIDGET_CATALOG,
  DEFAULT_CUSTOMERS_CONTACTS_WIDGETS
)
export const normalizeCustomersContactsWidgetLayout = contactsSurface.normalize
export const customersContactsWidgetLayoutToBase = contactsSurface.toBase

// --- Tasks ---

export const CUSTOMERS_TASKS_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('metric_overdue', 'Overdue tasks', 'Overdue task count', 4, 3),
  entry('metric_active', 'Active tasks', 'Active task count', 4, 3),
  entry('metric_completed', 'Completed tasks', 'Completed task count', 4, 3),
  entry('task_filters', 'Task filters', 'Search and status filters', 12, 2, 4, 2),
  entry('task_table', 'Task table', 'Full task list with actions', 12, 14, 6, 8),
]

export const DEFAULT_CUSTOMERS_TASKS_WIDGETS: ModuleWidgetItem[] = [
  item('metric_overdue', 0, 0, 4, 3),
  item('metric_active', 4, 0, 4, 3),
  item('metric_completed', 8, 0, 4, 3),
  item('task_filters', 0, 3, 12, 2, 4, 2),
  item('task_table', 0, 5, 12, 14, 6, 8),
]

const tasksSurface = makeSurface(CUSTOMERS_TASKS_WIDGET_CATALOG, DEFAULT_CUSTOMERS_TASKS_WIDGETS)
export const normalizeCustomersTasksWidgetLayout = tasksSurface.normalize
export const customersTasksWidgetLayoutToBase = tasksSurface.toBase

// --- Milestones ---

export const CUSTOMERS_MILESTONES_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('metric_upcoming', 'Upcoming', 'Upcoming milestones', 4, 3),
  entry('metric_in_progress', 'In progress', 'In-progress milestones', 4, 3),
  entry('metric_completed', 'Completed', 'Completed milestones', 4, 3),
  entry('milestone_filters', 'Milestone filters', 'Search and status filters', 12, 2, 4, 2),
  entry('milestone_table', 'Milestone table', 'Full milestone list', 12, 14, 6, 8),
]

export const DEFAULT_CUSTOMERS_MILESTONES_WIDGETS: ModuleWidgetItem[] = [
  item('metric_upcoming', 0, 0, 4, 3),
  item('metric_in_progress', 4, 0, 4, 3),
  item('metric_completed', 8, 0, 4, 3),
  item('milestone_filters', 0, 3, 12, 2, 4, 2),
  item('milestone_table', 0, 5, 12, 14, 6, 8),
]

const milestonesSurface = makeSurface(
  CUSTOMERS_MILESTONES_WIDGET_CATALOG,
  DEFAULT_CUSTOMERS_MILESTONES_WIDGETS
)
export const normalizeCustomersMilestonesWidgetLayout = milestonesSurface.normalize
export const customersMilestonesWidgetLayoutToBase = milestonesSurface.toBase

// --- Interactions ---

export const CUSTOMERS_INTERACTIONS_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('metric_emails', 'Emails', 'Email interaction count', 4, 3),
  entry('metric_calls', 'Calls', 'Call interaction count', 4, 3),
  entry('metric_meetings', 'Meetings', 'Meeting interaction count', 4, 3),
  entry('interaction_filters', 'Interaction filters', 'Search and type filters', 12, 2, 4, 2),
  entry('interaction_table', 'Interaction table', 'Communication history', 12, 14, 6, 8),
]

export const DEFAULT_CUSTOMERS_INTERACTIONS_WIDGETS: ModuleWidgetItem[] = [
  item('metric_emails', 0, 0, 4, 3),
  item('metric_calls', 4, 0, 4, 3),
  item('metric_meetings', 8, 0, 4, 3),
  item('interaction_filters', 0, 3, 12, 2, 4, 2),
  item('interaction_table', 0, 5, 12, 14, 6, 8),
]

const interactionsSurface = makeSurface(
  CUSTOMERS_INTERACTIONS_WIDGET_CATALOG,
  DEFAULT_CUSTOMERS_INTERACTIONS_WIDGETS
)
export const normalizeCustomersInteractionsWidgetLayout = interactionsSurface.normalize
export const customersInteractionsWidgetLayoutToBase = interactionsSurface.toBase

// --- Commerce ---

export const CUSTOMERS_COMMERCE_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('metric_quotes', 'Quotes', 'Quote document count', 4, 3),
  entry('metric_invoices', 'Invoices', 'Invoice document count', 4, 3),
  entry('metric_contracts', 'Contracts', 'Contract document count', 4, 3),
  entry('templates', 'Templates', 'Document templates and branding', 12, 8, 4, 4),
  entry('quotes_list', 'Quotes list', 'Quote documents', 12, 8, 4, 4),
  entry('invoices_list', 'Invoices list', 'Invoice documents', 12, 8, 4, 4),
  entry('contracts_list', 'Contracts list', 'Contract documents', 12, 8, 4, 4),
]

export const DEFAULT_CUSTOMERS_COMMERCE_WIDGETS: ModuleWidgetItem[] = [
  item('metric_quotes', 0, 0, 4, 3),
  item('metric_invoices', 4, 0, 4, 3),
  item('metric_contracts', 8, 0, 4, 3),
  item('templates', 0, 3, 12, 8, 4, 4),
  item('quotes_list', 0, 11, 12, 8, 4, 4),
  item('invoices_list', 0, 19, 12, 8, 4, 4),
  item('contracts_list', 0, 27, 12, 8, 4, 4),
]

const commerceSurface = makeSurface(
  CUSTOMERS_COMMERCE_WIDGET_CATALOG,
  DEFAULT_CUSTOMERS_COMMERCE_WIDGETS
)
export const normalizeCustomersCommerceWidgetLayout = commerceSurface.normalize
export const customersCommerceWidgetLayoutToBase = commerceSurface.toBase

// --- Campaigns ---

export const CUSTOMERS_CAMPAIGNS_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('metric_active_campaigns', 'Active campaigns', 'Active campaign count', 4, 3),
  entry('metric_total_budget', 'Total budget', 'Sum of campaign budgets', 4, 3),
  entry('metric_attributed_leads', 'Attributed leads', 'Leads attributed to campaigns', 4, 3),
  entry('lead_capture', 'Lead capture', 'Public lead capture settings', 12, 4, 4, 3),
  entry('campaign_grid', 'Campaigns', 'Campaign cards grid', 12, 12, 6, 6),
]

export const DEFAULT_CUSTOMERS_CAMPAIGNS_WIDGETS: ModuleWidgetItem[] = [
  item('metric_active_campaigns', 0, 0, 4, 3),
  item('metric_total_budget', 4, 0, 4, 3),
  item('metric_attributed_leads', 8, 0, 4, 3),
  item('lead_capture', 0, 3, 12, 4, 4, 3),
  item('campaign_grid', 0, 7, 12, 12, 6, 6),
]

const campaignsSurface = makeSurface(
  CUSTOMERS_CAMPAIGNS_WIDGET_CATALOG,
  DEFAULT_CUSTOMERS_CAMPAIGNS_WIDGETS
)
export const normalizeCustomersCampaignsWidgetLayout = campaignsSurface.normalize
export const customersCampaignsWidgetLayoutToBase = campaignsSurface.toBase

// --- Analytics ---

export const CUSTOMERS_ANALYTICS_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('portfolio_snapshot', 'Portfolio snapshot', 'High-level KYC portfolio tiles', 12, 4, 4, 2),
  entry('activity_pipeline_kpis', 'Activity & pipeline', 'Activity and pipeline KPI row', 12, 4, 4, 2),
  entry('kyc_action_tasks', 'KYC action tasks', 'Recommended KYC action tasks', 6, 5, 3, 3),
  entry('campaign_attribution', 'Campaign attribution', 'Campaign attribution card', 6, 5, 3, 3),
  entry('revenue_support', 'Revenue & support', 'Revenue and support signals', 12, 4, 4, 2),
  entry('chart_health_distribution', 'Health distribution', 'Health distribution chart', 6, 8, 3, 4),
  entry('chart_arr_by_health', 'ARR by health', 'ARR by health tier chart', 6, 8, 3, 4),
  entry('chart_interactions', 'Interactions chart', 'Interaction activity chart', 6, 8, 3, 4),
  entry('chart_task_performance', 'Task performance', 'Task performance chart', 6, 8, 3, 4),
  entry('chart_pipeline_by_stage', 'Pipeline by stage', 'Pipeline by stage chart', 6, 8, 3, 4),
  entry('renewal_calendar', 'Renewal calendar', 'Renewals and outreach calendar', 6, 8, 3, 4),
  entry('csm_performance', 'CSM performance', 'CSM performance list', 6, 8, 3, 4),
  entry('milestone_progress', 'Milestone progress', 'Milestone progress card', 6, 8, 3, 4),
  entry('top_actions', 'Top actions', 'Top recommended actions', 6, 7, 3, 4),
  entry('top_accounts', 'Top accounts', 'Top accounts by attention', 6, 7, 3, 4),
]

export const DEFAULT_CUSTOMERS_ANALYTICS_WIDGETS: ModuleWidgetItem[] = [
  item('portfolio_snapshot', 0, 0, 12, 4, 4, 2),
  item('activity_pipeline_kpis', 0, 4, 12, 4, 4, 2),
  item('kyc_action_tasks', 0, 8, 6, 5, 3, 3),
  item('campaign_attribution', 6, 8, 6, 5, 3, 3),
  item('revenue_support', 0, 13, 12, 4, 4, 2),
  item('chart_health_distribution', 0, 17, 6, 8, 3, 4),
  item('chart_arr_by_health', 6, 17, 6, 8, 3, 4),
  item('chart_interactions', 0, 25, 6, 8, 3, 4),
  item('chart_task_performance', 6, 25, 6, 8, 3, 4),
  item('chart_pipeline_by_stage', 0, 33, 6, 8, 3, 4),
  item('renewal_calendar', 6, 33, 6, 8, 3, 4),
  item('csm_performance', 0, 41, 6, 8, 3, 4),
  item('milestone_progress', 6, 41, 6, 8, 3, 4),
  item('top_actions', 0, 49, 6, 7, 3, 4),
  item('top_accounts', 6, 49, 6, 7, 3, 4),
]

const analyticsSurface = makeSurface(
  CUSTOMERS_ANALYTICS_WIDGET_CATALOG,
  DEFAULT_CUSTOMERS_ANALYTICS_WIDGETS
)
export const normalizeCustomersAnalyticsWidgetLayout = analyticsSurface.normalize
export const customersAnalyticsWidgetLayoutToBase = analyticsSurface.toBase

// --- Client detail ---

export const CUSTOMERS_CLIENT_DETAIL_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('stats', 'Engagement metrics', 'Engagement score, level, last contact, follow-up', 12, 3, 4, 2),
  entry('csm_briefing', 'CSM briefing', 'Account briefing for the CSM', 12, 5, 4, 3),
  entry('account_overview', 'Account overview', 'Score, signals, renewal/expansion, forecast', 8, 8, 4, 4),
  entry('activity', 'Activity', 'Account activity timeline', 8, 8, 4, 4),
  entry('people', 'People', 'Contacts and relationship people', 6, 6, 3, 3),
  entry('relationship_map', 'Relationship map', 'Visual relationship map', 6, 6, 3, 3),
  entry('revenue', 'Revenue', 'Revenue panel for the account', 6, 6, 3, 3),
  entry('intelligence', 'Intelligence', 'Account intelligence panel', 6, 6, 3, 3),
  entry('entitlements', 'Entitlements', 'Module entitlements for the account', 6, 5, 3, 3),
  entry('company_info', 'Company info', 'Company and CSM details', 6, 5, 3, 3),
  entry('linked_records', 'Linked records', 'Cross-module linked records', 12, 5, 4, 3),
  entry('account_counts', 'Account counts', 'Tasks, milestones, and interactions counts', 4, 3),
]

export const DEFAULT_CUSTOMERS_CLIENT_DETAIL_WIDGETS: ModuleWidgetItem[] = [
  item('stats', 0, 0, 12, 3, 4, 2),
  item('csm_briefing', 0, 3, 12, 5, 4, 3),
  item('account_overview', 0, 8, 8, 8, 4, 4),
  item('account_counts', 8, 8, 4, 3),
  item('company_info', 8, 11, 4, 5, 3, 3),
  item('activity', 0, 16, 8, 8, 4, 4),
  item('people', 8, 16, 4, 6, 3, 3),
  item('relationship_map', 0, 24, 6, 6, 3, 3),
  item('revenue', 6, 24, 6, 6, 3, 3),
  item('intelligence', 0, 30, 6, 6, 3, 3),
  item('entitlements', 6, 30, 6, 5, 3, 3),
  item('linked_records', 0, 36, 12, 5, 4, 3),
]

const clientDetailSurface = makeSurface(
  CUSTOMERS_CLIENT_DETAIL_WIDGET_CATALOG,
  DEFAULT_CUSTOMERS_CLIENT_DETAIL_WIDGETS
)
export const normalizeCustomersClientDetailWidgetLayout = clientDetailSurface.normalize
export const customersClientDetailWidgetLayoutToBase = clientDetailSurface.toBase
export type CustomersClientDetailWidgetLayout = ModuleWidgetLayout

// --- Registry ---

export interface CustomersSurfaceConfig {
  id: CustomersTabSurfaceId
  label: string
  catalog: WidgetCatalogEntry[]
  normalize: (raw: unknown) => ModuleWidgetLayout
  toBase: (layout: ModuleWidgetLayout) => ModuleWidgetLayout
}

export const CUSTOMERS_TAB_SURFACE_REGISTRY: Record<
  CustomersTabSurfaceId,
  CustomersSurfaceConfig
> = {
  dashboard: {
    id: 'dashboard',
    label: 'Dashboard',
    catalog: CUSTOMERS_DASHBOARD_WIDGET_CATALOG,
    normalize: normalizeCustomersDashboardWidgetLayout,
    toBase: customersDashboardWidgetLayoutToBase,
  },
  pipeline: {
    id: 'pipeline',
    label: 'Pipeline',
    catalog: CUSTOMERS_PIPELINE_WIDGET_CATALOG,
    normalize: normalizeCustomersPipelineWidgetLayout,
    toBase: customersPipelineWidgetLayoutToBase,
  },
  leads: {
    id: 'leads',
    label: 'Leads',
    catalog: CUSTOMERS_LEADS_WIDGET_CATALOG,
    normalize: normalizeCustomersLeadsWidgetLayout,
    toBase: customersLeadsWidgetLayoutToBase,
  },
  clients: {
    id: 'clients',
    label: 'Customers',
    catalog: CUSTOMERS_CLIENTS_WIDGET_CATALOG,
    normalize: normalizeCustomersClientsWidgetLayout,
    toBase: customersClientsWidgetLayoutToBase,
  },
  contacts: {
    id: 'contacts',
    label: 'Contacts',
    catalog: CUSTOMERS_CONTACTS_WIDGET_CATALOG,
    normalize: normalizeCustomersContactsWidgetLayout,
    toBase: customersContactsWidgetLayoutToBase,
  },
  tasks: {
    id: 'tasks',
    label: 'Tasks',
    catalog: CUSTOMERS_TASKS_WIDGET_CATALOG,
    normalize: normalizeCustomersTasksWidgetLayout,
    toBase: customersTasksWidgetLayoutToBase,
  },
  milestones: {
    id: 'milestones',
    label: 'Milestones',
    catalog: CUSTOMERS_MILESTONES_WIDGET_CATALOG,
    normalize: normalizeCustomersMilestonesWidgetLayout,
    toBase: customersMilestonesWidgetLayoutToBase,
  },
  interactions: {
    id: 'interactions',
    label: 'Interactions',
    catalog: CUSTOMERS_INTERACTIONS_WIDGET_CATALOG,
    normalize: normalizeCustomersInteractionsWidgetLayout,
    toBase: customersInteractionsWidgetLayoutToBase,
  },
  commerce: {
    id: 'commerce',
    label: 'Commerce',
    catalog: CUSTOMERS_COMMERCE_WIDGET_CATALOG,
    normalize: normalizeCustomersCommerceWidgetLayout,
    toBase: customersCommerceWidgetLayoutToBase,
  },
  campaigns: {
    id: 'campaigns',
    label: 'Campaigns',
    catalog: CUSTOMERS_CAMPAIGNS_WIDGET_CATALOG,
    normalize: normalizeCustomersCampaignsWidgetLayout,
    toBase: customersCampaignsWidgetLayoutToBase,
  },
  analytics: {
    id: 'analytics',
    label: 'Analytics',
    catalog: CUSTOMERS_ANALYTICS_WIDGET_CATALOG,
    normalize: normalizeCustomersAnalyticsWidgetLayout,
    toBase: customersAnalyticsWidgetLayoutToBase,
  },
}

export function isCustomersTabSurfaceId(value: string): value is CustomersTabSurfaceId {
  return (CUSTOMERS_TAB_SURFACE_IDS as string[]).includes(value)
}

export function getCustomersTabSurfaceConfig(tab: string): CustomersSurfaceConfig {
  if (isCustomersTabSurfaceId(tab)) return CUSTOMERS_TAB_SURFACE_REGISTRY[tab]
  return CUSTOMERS_TAB_SURFACE_REGISTRY.dashboard
}

export {
  addWidgetToLayout,
  applyGridLayoutChange,
  availableCatalogEntries,
  removeWidgetFromLayout,
}
