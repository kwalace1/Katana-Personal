/**
 * KYI freeform (v2) widget catalogs.
 * Surfaces: overview, contacts, leads, geo, northstar, ecosystem, intel.
 * Access Map and investor detail routes stay immersive (not customizable).
 * Catalogs map to existing UI only — no empty_* placeholder widgets.
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

export interface KyiTabLayoutProps {
  widgets: ModuleWidgetItem[]
  catalog: readonly WidgetCatalogEntry[]
  customizeMode: boolean
  onLayoutChange: (layout: Layout[]) => void
  onRemoveWidget: (widgetId: string) => void
}

export const KYI_MODULE_ID = 'kyi'

export type KyiTabSurfaceId =
  | 'overview'
  | 'contacts'
  | 'leads'
  | 'geo'
  | 'northstar'
  | 'ecosystem'
  | 'intel'

export const KYI_TAB_SURFACE_IDS: KyiTabSurfaceId[] = [
  'overview',
  'contacts',
  'leads',
  'geo',
  'northstar',
  'ecosystem',
  'intel',
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

// --- Overview ---

export const KYI_OVERVIEW_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('cap_raise_snapshot', 'Cap raise overview', 'KPIs, coverage progress, and shortcuts', 12, 12, 6, 6),
  entry('grow_network', 'Grow your network', 'Personal network and ecosystem CTAs', 12, 10, 4, 6),
  entry('ecosystem_matches', 'Best matches', 'Ranked ecosystem matches for this raise', 12, 12, 4, 6),
  entry('raise_profile', 'Raise profile', 'Stage, amount, sectors, preferred investor types', 12, 10, 4, 6),
  entry('about_links', 'About & links', 'Website, description, and tracking since', 12, 5, 4, 3),
  entry('social_tags', 'Social & tags', 'LinkedIn, X, and strategy tags', 12, 5, 4, 3),
  entry('warm_intro_paths', 'Warm intro paths', 'Employee preview cards for intros', 12, 12, 4, 6),
  entry('raise_network_prep', 'Raise network & prep', 'Network counts and raise prep checklist', 12, 12, 4, 6),
  entry('types_strategy', 'Investor types & strategy', 'Type mix and strategy notes summary', 12, 6, 4, 3),
  entry('notes_history', 'Notes history', 'Searchable notes across investors and leads', 12, 12, 4, 6),
  entry('getting_started', 'Getting started', 'Empty-state CTAs when the raise is new', 12, 6, 4, 3),
]

export const DEFAULT_KYI_OVERVIEW_WIDGETS: ModuleWidgetItem[] = [
  item('cap_raise_snapshot', 0, 0, 12, 12, 6, 6),
  item('grow_network', 0, 12, 12, 10, 4, 6),
  item('ecosystem_matches', 0, 22, 12, 12, 4, 6),
  item('raise_profile', 0, 34, 12, 10, 4, 6),
  item('about_links', 0, 44, 12, 5, 4, 3),
  item('social_tags', 0, 49, 12, 5, 4, 3),
  item('warm_intro_paths', 0, 54, 12, 12, 4, 6),
  item('raise_network_prep', 0, 66, 12, 12, 4, 6),
  item('types_strategy', 0, 78, 12, 6, 4, 3),
  item('notes_history', 0, 84, 12, 12, 4, 6),
  item('getting_started', 0, 96, 12, 6, 4, 3),
]

const overviewSurface = makeSurface(KYI_OVERVIEW_WIDGET_CATALOG, DEFAULT_KYI_OVERVIEW_WIDGETS)
export const normalizeKyiOverviewWidgetLayout = overviewSurface.normalize
export const kyiOverviewWidgetLayoutToBase = overviewSurface.toBase

// --- Contacts ---

export const KYI_CONTACTS_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry(
    'contacts_workspace',
    'Contacts',
    'Segment nav and roster for employees, network, current, and targeted',
    12,
    20,
    6,
    10
  ),
]

export const DEFAULT_KYI_CONTACTS_WIDGETS: ModuleWidgetItem[] = [
  item('contacts_workspace', 0, 0, 12, 20, 6, 10),
]

const contactsSurface = makeSurface(KYI_CONTACTS_WIDGET_CATALOG, DEFAULT_KYI_CONTACTS_WIDGETS)
export const normalizeKyiContactsWidgetLayout = contactsSurface.normalize
export const kyiContactsWidgetLayoutToBase = contactsSurface.toBase

// --- Leads ---

export const KYI_LEADS_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('leads_workspace', 'Localized leads', 'Filters, geo status, and lead cards', 12, 24, 6, 12),
]

export const DEFAULT_KYI_LEADS_WIDGETS: ModuleWidgetItem[] = [
  item('leads_workspace', 0, 0, 12, 24, 6, 12),
]

const leadsSurface = makeSurface(KYI_LEADS_WIDGET_CATALOG, DEFAULT_KYI_LEADS_WIDGETS)
export const normalizeKyiLeadsWidgetLayout = leadsSurface.normalize
export const kyiLeadsWidgetLayoutToBase = leadsSurface.toBase

// --- Geo ---

export const KYI_GEO_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('geo_workspace', 'Geo targeting', 'Primary location, radius, markets, and save', 12, 18, 6, 8),
]

export const DEFAULT_KYI_GEO_WIDGETS: ModuleWidgetItem[] = [
  item('geo_workspace', 0, 0, 12, 18, 6, 8),
]

const geoSurface = makeSurface(KYI_GEO_WIDGET_CATALOG, DEFAULT_KYI_GEO_WIDGETS)
export const normalizeKyiGeoWidgetLayout = geoSurface.normalize
export const kyiGeoWidgetLayoutToBase = geoSurface.toBase

// --- Northstar ---

export const KYI_NORTHSTAR_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('northstar_header', 'Northstar header', 'Title and pipeline actions', 12, 4, 4, 3),
  entry('northstar_kpis', 'Northstar KPIs', 'Pipeline summary stat cards', 12, 5, 4, 3),
  entry('northstar_pipeline', 'Outreach pipeline', 'Filtered investor pipeline table', 12, 16, 6, 8),
  entry('northstar_framework', 'Framework reference', 'Collapsible strategy and traits', 12, 10, 4, 5),
]

export const DEFAULT_KYI_NORTHSTAR_WIDGETS: ModuleWidgetItem[] = [
  item('northstar_header', 0, 0, 12, 4, 4, 3),
  item('northstar_kpis', 0, 4, 12, 5, 4, 3),
  item('northstar_pipeline', 0, 9, 12, 16, 6, 8),
  item('northstar_framework', 0, 25, 12, 10, 4, 5),
]

const northstarSurface = makeSurface(KYI_NORTHSTAR_WIDGET_CATALOG, DEFAULT_KYI_NORTHSTAR_WIDGETS)
export const normalizeKyiNorthstarWidgetLayout = northstarSurface.normalize
export const kyiNorthstarWidgetLayoutToBase = northstarSurface.toBase

// --- Ecosystem (standalone page) ---

export const KYI_ECOSYSTEM_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('ecosystem_header', 'Ecosystem header', 'Title and directory stats', 12, 4, 4, 3),
  entry('ecosystem_filters', 'Browse & filter', 'Search and filter controls', 12, 8, 4, 4),
  entry('ecosystem_directory', 'Investor directory', 'Shared ecosystem results list', 12, 16, 6, 8),
]

export const DEFAULT_KYI_ECOSYSTEM_WIDGETS: ModuleWidgetItem[] = [
  item('ecosystem_header', 0, 0, 12, 4, 4, 3),
  item('ecosystem_filters', 0, 4, 12, 8, 4, 4),
  item('ecosystem_directory', 0, 12, 12, 16, 6, 8),
]

const ecosystemSurface = makeSurface(KYI_ECOSYSTEM_WIDGET_CATALOG, DEFAULT_KYI_ECOSYSTEM_WIDGETS)
export const normalizeKyiEcosystemWidgetLayout = ecosystemSurface.normalize
export const kyiEcosystemWidgetLayoutToBase = ecosystemSurface.toBase

// --- Raise intel (standalone page) ---

export const KYI_INTEL_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('intel_questions', 'Raise questions', 'Suggested questions for this raise', 4, 16, 3, 8),
  entry('intel_answers', 'Intel answers', 'Answer panel for the selected question', 8, 16, 4, 8),
]

export const DEFAULT_KYI_INTEL_WIDGETS: ModuleWidgetItem[] = [
  item('intel_questions', 0, 0, 4, 16, 3, 8),
  item('intel_answers', 4, 0, 8, 16, 4, 8),
]

const intelSurface = makeSurface(KYI_INTEL_WIDGET_CATALOG, DEFAULT_KYI_INTEL_WIDGETS)
export const normalizeKyiIntelWidgetLayout = intelSurface.normalize
export const kyiIntelWidgetLayoutToBase = intelSurface.toBase

// --- Registry ---

export interface KyiSurfaceConfig {
  id: KyiTabSurfaceId
  label: string
  catalog: WidgetCatalogEntry[]
  normalize: (raw: unknown) => ModuleWidgetLayout
  toBase: (layout: ModuleWidgetLayout) => ModuleWidgetLayout
}

export const KYI_TAB_SURFACE_REGISTRY: Record<KyiTabSurfaceId, KyiSurfaceConfig> = {
  overview: {
    id: 'overview',
    label: 'Overview',
    catalog: KYI_OVERVIEW_WIDGET_CATALOG,
    normalize: normalizeKyiOverviewWidgetLayout,
    toBase: kyiOverviewWidgetLayoutToBase,
  },
  contacts: {
    id: 'contacts',
    label: 'Contacts',
    catalog: KYI_CONTACTS_WIDGET_CATALOG,
    normalize: normalizeKyiContactsWidgetLayout,
    toBase: kyiContactsWidgetLayoutToBase,
  },
  leads: {
    id: 'leads',
    label: 'Leads',
    catalog: KYI_LEADS_WIDGET_CATALOG,
    normalize: normalizeKyiLeadsWidgetLayout,
    toBase: kyiLeadsWidgetLayoutToBase,
  },
  geo: {
    id: 'geo',
    label: 'Geo',
    catalog: KYI_GEO_WIDGET_CATALOG,
    normalize: normalizeKyiGeoWidgetLayout,
    toBase: kyiGeoWidgetLayoutToBase,
  },
  northstar: {
    id: 'northstar',
    label: 'Northstar',
    catalog: KYI_NORTHSTAR_WIDGET_CATALOG,
    normalize: normalizeKyiNorthstarWidgetLayout,
    toBase: kyiNorthstarWidgetLayoutToBase,
  },
  ecosystem: {
    id: 'ecosystem',
    label: 'Ecosystem',
    catalog: KYI_ECOSYSTEM_WIDGET_CATALOG,
    normalize: normalizeKyiEcosystemWidgetLayout,
    toBase: kyiEcosystemWidgetLayoutToBase,
  },
  intel: {
    id: 'intel',
    label: 'Raise intel',
    catalog: KYI_INTEL_WIDGET_CATALOG,
    normalize: normalizeKyiIntelWidgetLayout,
    toBase: kyiIntelWidgetLayoutToBase,
  },
}

export function isKyiTabSurfaceId(value: string): value is KyiTabSurfaceId {
  return (KYI_TAB_SURFACE_IDS as string[]).includes(value)
}

/** Access Map is immersive — not a layout surface. */
export function resolveKyiCompanySurfaceId(tab: string): KyiTabSurfaceId | null {
  if (tab === 'accessmap') return null
  if (tab === 'investors') return 'contacts'
  if (isKyiTabSurfaceId(tab) && tab !== 'ecosystem' && tab !== 'intel') return tab
  if (['overview', 'contacts', 'leads', 'geo', 'northstar'].includes(tab)) {
    return tab as KyiTabSurfaceId
  }
  return 'overview'
}

export function getKyiCompanySurfaceConfig(tab: string): KyiSurfaceConfig | null {
  const id = resolveKyiCompanySurfaceId(tab)
  if (!id) return null
  return KYI_TAB_SURFACE_REGISTRY[id]
}

export function getKyiSurfaceConfig(surfaceId: KyiTabSurfaceId): KyiSurfaceConfig {
  return KYI_TAB_SURFACE_REGISTRY[surfaceId]
}

export {
  addWidgetToLayout,
  applyGridLayoutChange,
  availableCatalogEntries,
  removeWidgetFromLayout,
}
