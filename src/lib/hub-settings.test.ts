import { describe, it, expect, beforeEach } from 'vitest'
import {
  formatHubLastSync,
  getHubLayoutClasses,
  getHubRefreshIntervalMs,
  loadHubSettings,
  normalizeHubSettings,
  saveHubSettings,
} from './hub-settings'

describe('hub-settings', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns distinct layout classes for compact, default, and detailed', () => {
    const compact = getHubLayoutClasses('compact')
    const defaultLayout = getHubLayoutClasses('default')
    const detailed = getHubLayoutClasses('detailed')

    expect(compact.moduleGrid).not.toBe(defaultLayout.moduleGrid)
    expect(detailed.moduleGrid).not.toBe(defaultLayout.moduleGrid)
    expect(compact.title).not.toBe(detailed.title)
  })

  it('maps refresh intervals to milliseconds', () => {
    expect(getHubRefreshIntervalMs('1min')).toBe(60_000)
    expect(getHubRefreshIntervalMs('2min')).toBe(120_000)
    expect(getHubRefreshIntervalMs('5min')).toBe(300_000)
    expect(getHubRefreshIntervalMs('manual')).toBeNull()
  })

  it('formats last sync relative times', () => {
    const now = Date.now()
    expect(formatHubLastSync(now - 5_000, now)).toBe('Just now')
    expect(formatHubLastSync(now - 90_000, now)).toBe('1 min ago')
  })

  it('persists settings to localStorage', () => {
    saveHubSettings({ dashboardLayout: 'compact', refreshInterval: '5min' })
    expect(loadHubSettings()).toEqual({
      dashboardLayout: 'compact',
      refreshInterval: '5min',
    })
  })

  it('normalizes invalid stored values', () => {
    expect(normalizeHubSettings({ dashboardLayout: 'invalid' as never, refreshInterval: 'bad' as never })).toEqual({
      dashboardLayout: 'default',
      refreshInterval: '2min',
    })
  })
})
