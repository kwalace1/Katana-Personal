/**
 * Automation freeform (v2) widget catalogs.
 * Surfaces: dashboard, documents, automation (web tools), analytics, settings.
 * Catalogs map to existing UI sections only — no empty_* placeholder widgets.
 * Ask Agent tab is intentionally not customizable (single CTA out to Agent Office).
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

/** Shared freeform layout props passed from AutomationPage into tab panels. */
export interface AutomationTabLayoutProps {
  widgets: ModuleWidgetItem[]
  catalog: readonly WidgetCatalogEntry[]
  customizeMode: boolean
  onLayoutChange: (layout: Layout[]) => void
  onRemoveWidget: (widgetId: string) => void
}

export const AUTOMATION_MODULE_ID = 'automation'

export type AutomationTabSurfaceId =
  | 'dashboard'
  | 'documents'
  | 'automation'
  | 'analytics'
  | 'settings'

export const AUTOMATION_TAB_SURFACE_IDS: AutomationTabSurfaceId[] = [
  'dashboard',
  'documents',
  'automation',
  'analytics',
  'settings',
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

function makeSurface(catalog: WidgetCatalogEntry[], defaults: ModuleWidgetItem[]) {
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

export const AUTOMATION_DASHBOARD_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('kpi_strip', 'Automation KPIs', 'Documents indexed, tasks completed, tool runs', 12, 4, 6, 3),
  entry('quick_actions', 'Quick actions', 'Ask agent, upload, run tools, analytics shortcuts', 12, 8, 4, 5),
  entry('recent_activity', 'Recent activity', 'Latest document and tool job activity', 12, 10, 4, 5),
]

export const DEFAULT_AUTOMATION_DASHBOARD_WIDGETS: ModuleWidgetItem[] = [
  item('kpi_strip', 0, 0, 12, 4, 6, 3),
  item('quick_actions', 0, 4, 12, 8, 4, 5),
  item('recent_activity', 0, 12, 12, 10, 4, 5),
]

const dashboardSurface = makeSurface(
  AUTOMATION_DASHBOARD_WIDGET_CATALOG,
  DEFAULT_AUTOMATION_DASHBOARD_WIDGETS
)
export const normalizeAutomationDashboardWidgetLayout = dashboardSurface.normalize
export const automationDashboardWidgetLayoutToBase = dashboardSurface.toBase

// --- Documents ---

export const AUTOMATION_DOCUMENTS_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('upload_zone', 'Upload documents', 'Drag-and-drop and file picker for indexing', 12, 10, 4, 6),
  entry('switch_import', 'Send to Switch', 'Optional Switch import divert for an uploaded file', 12, 5, 4, 3),
  entry('document_search', 'Search indexed docs', 'Query indexed document text and view hits', 12, 8, 4, 4),
  entry('document_library', 'Document library', 'Indexed files with re-index and delete', 12, 14, 4, 6),
  entry('agent_footer', 'Ask Automation Agent', 'Shortcut into Agent Office for document Q&A', 12, 3, 4, 2),
]

export const DEFAULT_AUTOMATION_DOCUMENTS_WIDGETS: ModuleWidgetItem[] = [
  item('upload_zone', 0, 0, 12, 10, 4, 6),
  item('switch_import', 0, 10, 12, 5, 4, 3),
  item('document_search', 0, 15, 12, 8, 4, 4),
  item('document_library', 0, 23, 12, 14, 4, 6),
  item('agent_footer', 0, 37, 12, 3, 4, 2),
]

const documentsSurface = makeSurface(
  AUTOMATION_DOCUMENTS_WIDGET_CATALOG,
  DEFAULT_AUTOMATION_DOCUMENTS_WIDGETS
)
export const normalizeAutomationDocumentsWidgetLayout = documentsSurface.normalize
export const automationDocumentsWidgetLayoutToBase = documentsSurface.toBase

// --- Web tools (automation tab) ---

export const AUTOMATION_TOOLS_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry(
    'browser_tools',
    'Web tools',
    'Screenshot, extract text, fill form, click, download, and last result',
    12,
    22,
    6,
    10
  ),
  entry('agent_footer', 'Ask Automation Agent', 'Shortcut into Agent Office for tool help', 12, 3, 4, 2),
]

export const DEFAULT_AUTOMATION_TOOLS_WIDGETS: ModuleWidgetItem[] = [
  item('browser_tools', 0, 0, 12, 22, 6, 10),
  item('agent_footer', 0, 22, 12, 3, 4, 2),
]

const toolsSurface = makeSurface(AUTOMATION_TOOLS_WIDGET_CATALOG, DEFAULT_AUTOMATION_TOOLS_WIDGETS)
export const normalizeAutomationToolsWidgetLayout = toolsSurface.normalize
export const automationToolsWidgetLayoutToBase = toolsSurface.toBase

// --- Analytics ---

export const AUTOMATION_ANALYTICS_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('analytics_kpis', 'Usage metrics', 'Uploads, indexed text, tool runs, tasks, failures', 12, 8, 4, 5),
  entry('activity_by_type', 'Activity by type', 'Job-type breakdown bars', 12, 10, 4, 5),
]

export const DEFAULT_AUTOMATION_ANALYTICS_WIDGETS: ModuleWidgetItem[] = [
  item('analytics_kpis', 0, 0, 12, 8, 4, 5),
  item('activity_by_type', 0, 8, 12, 10, 4, 5),
]

const analyticsSurface = makeSurface(
  AUTOMATION_ANALYTICS_WIDGET_CATALOG,
  DEFAULT_AUTOMATION_ANALYTICS_WIDGETS
)
export const normalizeAutomationAnalyticsWidgetLayout = analyticsSurface.normalize
export const automationAnalyticsWidgetLayoutToBase = analyticsSurface.toBase

// --- Settings ---

export const AUTOMATION_SETTINGS_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry(
    'agent_support',
    'Agent Office support',
    'How this workspace feeds Automation Agent (no model keys here)',
    12,
    6,
    4,
    3
  ),
  entry('browser_settings', 'Browser settings', 'Viewport, timeout, and save', 12, 10, 4, 6),
]

export const DEFAULT_AUTOMATION_SETTINGS_WIDGETS: ModuleWidgetItem[] = [
  item('agent_support', 0, 0, 12, 6, 4, 3),
  item('browser_settings', 0, 6, 12, 10, 4, 6),
]

const settingsSurface = makeSurface(
  AUTOMATION_SETTINGS_WIDGET_CATALOG,
  DEFAULT_AUTOMATION_SETTINGS_WIDGETS
)
export const normalizeAutomationSettingsWidgetLayout = settingsSurface.normalize
export const automationSettingsWidgetLayoutToBase = settingsSurface.toBase

// --- Registry ---

export interface AutomationSurfaceConfig {
  id: AutomationTabSurfaceId
  label: string
  catalog: WidgetCatalogEntry[]
  normalize: (raw: unknown) => ModuleWidgetLayout
  toBase: (layout: ModuleWidgetLayout) => ModuleWidgetLayout
}

export const AUTOMATION_TAB_SURFACE_REGISTRY: Record<
  AutomationTabSurfaceId,
  AutomationSurfaceConfig
> = {
  dashboard: {
    id: 'dashboard',
    label: 'Dashboard',
    catalog: AUTOMATION_DASHBOARD_WIDGET_CATALOG,
    normalize: normalizeAutomationDashboardWidgetLayout,
    toBase: automationDashboardWidgetLayoutToBase,
  },
  documents: {
    id: 'documents',
    label: 'Documents',
    catalog: AUTOMATION_DOCUMENTS_WIDGET_CATALOG,
    normalize: normalizeAutomationDocumentsWidgetLayout,
    toBase: automationDocumentsWidgetLayoutToBase,
  },
  automation: {
    id: 'automation',
    label: 'Web tools',
    catalog: AUTOMATION_TOOLS_WIDGET_CATALOG,
    normalize: normalizeAutomationToolsWidgetLayout,
    toBase: automationToolsWidgetLayoutToBase,
  },
  analytics: {
    id: 'analytics',
    label: 'Analytics',
    catalog: AUTOMATION_ANALYTICS_WIDGET_CATALOG,
    normalize: normalizeAutomationAnalyticsWidgetLayout,
    toBase: automationAnalyticsWidgetLayoutToBase,
  },
  settings: {
    id: 'settings',
    label: 'Settings',
    catalog: AUTOMATION_SETTINGS_WIDGET_CATALOG,
    normalize: normalizeAutomationSettingsWidgetLayout,
    toBase: automationSettingsWidgetLayoutToBase,
  },
}

export function isAutomationTabSurfaceId(value: string): value is AutomationTabSurfaceId {
  return (AUTOMATION_TAB_SURFACE_IDS as string[]).includes(value)
}

/** Ask Agent is not a customizable surface. */
export function resolveAutomationSurfaceId(tab: string): AutomationTabSurfaceId | null {
  if (tab === 'agent') return null
  if (isAutomationTabSurfaceId(tab)) return tab
  return 'documents'
}

export function getAutomationTabSurfaceConfig(tab: string): AutomationSurfaceConfig | null {
  const id = resolveAutomationSurfaceId(tab)
  if (!id) return null
  return AUTOMATION_TAB_SURFACE_REGISTRY[id]
}

export {
  addWidgetToLayout,
  applyGridLayoutChange,
  availableCatalogEntries,
  removeWidgetFromLayout,
}
