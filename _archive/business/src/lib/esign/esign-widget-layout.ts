/**
 * Katana E-Sign freeform (v2) widget catalog — dashboard surface.
 */

import type { Layout } from 'react-grid-layout'
import {
  normalizeModuleWidgetLayout,
  type ModuleWidgetItem,
  type ModuleWidgetLayout,
  type WidgetCatalogEntry,
} from '@/lib/module-widget-layout'

export interface EsignTabLayoutProps {
  widgets: ModuleWidgetItem[]
  catalog: readonly WidgetCatalogEntry[]
  customizeMode: boolean
  onLayoutChange: (layout: Layout[]) => void
  onRemoveWidget: (widgetId: string) => void
}

export const ESIGN_MODULE_ID = 'esign'
export type EsignTabSurfaceId = 'dashboard'
/** Bumped so older saved layouts (e.g. webhook widget) are not reused. */
export const ESIGN_DASHBOARD_SURFACE_ID = 'dashboard_v3'
export const ESIGN_TAB_SURFACE_IDS: EsignTabSurfaceId[] = ['dashboard']

function entry(
  id: string,
  label: string,
  description: string,
  defaultW: number,
  defaultH: number,
  minW = 2,
  minH = 2,
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
  minH?: number,
): ModuleWidgetItem {
  return { i, x, y, w, h, minW, minH }
}

export const ESIGN_DASHBOARD_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('header', 'Header', 'Title and new-request action', 12, 3, 4, 2),
  entry('stats', 'KPI strip', 'Total / draft / awaiting / partial / completed', 12, 4, 6, 3),
  entry('filters', 'Search & bulk actions', 'Search, select-all, remind / cancel / delete', 12, 3, 4, 2),
  entry('document_list', 'Documents', 'Signature request list', 12, 12, 6, 8),
  entry('templates', 'Templates', 'Reusable field layouts — start a new request from a saved layout', 12, 8, 4, 5),
]

export const DEFAULT_ESIGN_DASHBOARD_WIDGETS: ModuleWidgetItem[] = [
  item('header', 0, 0, 12, 3, 4, 2),
  item('stats', 0, 3, 12, 4, 6, 3),
  item('filters', 0, 7, 12, 3, 4, 2),
  item('document_list', 0, 10, 12, 12, 6, 8),
  item('templates', 0, 22, 12, 8, 4, 5),
]

const catalog = ESIGN_DASHBOARD_WIDGET_CATALOG
const defaults = DEFAULT_ESIGN_DASHBOARD_WIDGETS

export function normalizeEsignDashboardWidgetLayout(raw: unknown) {
  return normalizeModuleWidgetLayout(raw, catalog, defaults, {})
}

export function esignDashboardWidgetLayoutToBase(layout: ModuleWidgetLayout): ModuleWidgetLayout {
  return {
    version: 2,
    widgets: layout.widgets,
    extras: layout.extras ?? {},
  }
}

export function getEsignTabSurfaceConfig(surfaceId: EsignTabSurfaceId = 'dashboard') {
  return {
    id: surfaceId === 'dashboard' ? ESIGN_DASHBOARD_SURFACE_ID : surfaceId,
    label: 'E-Sign dashboard',
    catalog,
    defaults,
    normalize: normalizeEsignDashboardWidgetLayout,
    toBase: esignDashboardWidgetLayoutToBase,
  }
}
