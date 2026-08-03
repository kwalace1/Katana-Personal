export type HubDashboardLayout = 'default' | 'compact' | 'detailed'
export type HubRefreshInterval = '1min' | '2min' | '5min' | 'manual'

export interface HubUserSettings {
  dashboardLayout: HubDashboardLayout
  refreshInterval: HubRefreshInterval
}

export interface HubLayoutClasses {
  pagePadding: string
  sectionGap: string
  metricsGap: string
  headerMargin: string
  title: string
  subtitle: string
  toolsTitle: string
  moduleGrid: string
  moduleCardPadding: string
  moduleIconBox: string
  moduleTitle: string
  performanceMetricValue: string
  performanceMetricGrid: string
  kpiGrid: string
  kpiValue: string
  dashboardStackMargin: string
}

const HUB_SETTINGS_KEY = 'katana_hub_settings'

const DEFAULT_SETTINGS: HubUserSettings = {
  dashboardLayout: 'default',
  refreshInterval: '2min',
}

export function loadHubSettings(): HubUserSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS }
  try {
    const raw = localStorage.getItem(HUB_SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<HubUserSettings>
    return normalizeHubSettings(parsed)
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveHubSettings(settings: HubUserSettings): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(HUB_SETTINGS_KEY, JSON.stringify(normalizeHubSettings(settings)))
}

export function normalizeHubSettings(
  settings: Partial<HubUserSettings> | null | undefined
): HubUserSettings {
  const dashboardLayout =
    settings?.dashboardLayout === 'compact' ||
    settings?.dashboardLayout === 'detailed' ||
    settings?.dashboardLayout === 'default'
      ? settings.dashboardLayout
      : DEFAULT_SETTINGS.dashboardLayout

  const refreshInterval =
    settings?.refreshInterval === '1min' ||
    settings?.refreshInterval === '2min' ||
    settings?.refreshInterval === '5min' ||
    settings?.refreshInterval === 'manual'
      ? settings.refreshInterval
      : DEFAULT_SETTINGS.refreshInterval

  return { dashboardLayout, refreshInterval }
}

export function getHubRefreshIntervalMs(interval: HubRefreshInterval): number | null {
  switch (interval) {
    case '1min':
      return 60_000
    case '2min':
      return 120_000
    case '5min':
      return 300_000
    case 'manual':
      return null
  }
}

export function getHubRefreshIntervalLabel(interval: HubRefreshInterval): string {
  switch (interval) {
    case '1min':
      return 'every 1 min'
    case '2min':
      return 'every 2 min'
    case '5min':
      return 'every 5 min'
    case 'manual':
      return 'manual only'
  }
}

export function formatHubLastSync(lastSyncedAt: number | null, now = Date.now()): string {
  if (!lastSyncedAt) return 'Not synced yet'
  const diffSec = Math.max(0, Math.floor((now - lastSyncedAt) / 1000))
  if (diffSec < 15) return 'Just now'
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin === 1) return '1 min ago'
  if (diffMin < 60) return `${diffMin} min ago`
  const diffHr = Math.floor(diffMin / 60)
  return diffHr === 1 ? '1 hour ago' : `${diffHr} hours ago`
}

export function getHubLayoutClasses(layout: HubDashboardLayout): HubLayoutClasses {
  switch (layout) {
    case 'compact':
      return {
        pagePadding: 'p-3 sm:p-4',
        sectionGap: 'flex flex-col gap-3 mb-4',
        metricsGap: 'gap-3',
        headerMargin: 'mb-2',
        title: 'text-2xl',
        subtitle: 'text-sm',
        toolsTitle: 'text-xl',
        moduleGrid: 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2',
        moduleCardPadding: 'p-3',
        moduleIconBox: 'p-2 rounded-lg',
        moduleTitle: 'text-base',
        performanceMetricValue: 'text-2xl',
        performanceMetricGrid: 'grid grid-cols-2 gap-3',
        kpiGrid: 'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2',
        kpiValue: 'text-xl',
        dashboardStackMargin: 'mb-4',
      }
    case 'detailed':
      return {
        pagePadding: 'p-6 sm:p-8',
        sectionGap: 'flex flex-col gap-8 mb-10',
        metricsGap: 'gap-8',
        headerMargin: 'mb-5',
        title: 'text-4xl sm:text-5xl',
        subtitle: 'text-base',
        toolsTitle: 'text-3xl',
        moduleGrid: 'grid grid-cols-1 lg:grid-cols-2 gap-5',
        moduleCardPadding: 'p-6',
        moduleIconBox: 'p-3 rounded-xl',
        moduleTitle: 'text-xl',
        performanceMetricValue: 'text-4xl',
        performanceMetricGrid: 'grid grid-cols-1 sm:grid-cols-2 gap-6',
        kpiGrid: 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5',
        kpiValue: 'text-3xl',
        dashboardStackMargin: 'mb-10',
      }
    default:
      return {
        pagePadding: 'p-4 sm:p-6',
        sectionGap: 'flex flex-col gap-6 mb-8',
        metricsGap: 'gap-6',
        headerMargin: 'mb-4',
        title: 'text-3xl sm:text-4xl',
        subtitle: 'text-sm sm:text-base',
        toolsTitle: 'text-2xl',
        moduleGrid: 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3',
        moduleCardPadding: 'p-5',
        moduleIconBox: 'p-2.5 rounded-lg',
        moduleTitle: 'text-lg',
        performanceMetricValue: 'text-3xl',
        performanceMetricGrid: 'grid grid-cols-2 gap-4',
        kpiGrid: 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4',
        kpiValue: 'text-2xl',
        dashboardStackMargin: 'mb-8',
      }
  }
}
