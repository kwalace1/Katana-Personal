import { describe, it, expect } from 'vitest'
import {
  resolveOrgEnabledModules,
  resolveOrgModulesDetail,
  intersectModuleAccess,
  buildIntegrationPlan,
} from './org-module-access'
import type { ModuleId } from './module-access'

describe('org-module-access', () => {
  it('derives modules from subscription tier when enabled_modules is empty', () => {
    const modules = resolveOrgEnabledModules({
      subscription_tier: 'starter',
      settings: {},
    })
    expect(modules).toContain('projects')
    expect(modules).not.toContain('finance')
  })

  it('uses explicit enabled_modules when set', () => {
    const modules = resolveOrgEnabledModules({
      subscription_tier: 'free',
      enabled_modules: ['hub', 'workforce', 'customer-success', 'employee', 'support'],
      settings: {},
    })
    expect(modules).toContain('workforce')
    expect(modules).not.toContain('finance')
  })

  it('enterprise tier resolves full stack', () => {
    const detail = resolveOrgModulesDetail({
      subscription_tier: 'enterprise',
      settings: {},
    })
    expect(detail.source).toBe('tier')
    expect(detail.modules).toContain('finance')
    expect(detail.modules).toContain('agents')
    expect(detail.modules).not.toContain('manufacturing')
  })

  it('DW Growth & Capital always resolves full stack even on free tier', () => {
    const detail = resolveOrgModulesDetail({
      name: 'DW Growth & Capital',
      subscription_tier: 'free',
      enabled_modules: ['hub', 'customer-success', 'employee', 'support'],
      settings: {},
    })
    expect(detail.tier).toBe('enterprise')
    expect(detail.modules).toContain('finance')
    expect(detail.modules).toContain('workforce')
  })

  it('enterprise ignores stale partial enabled_modules list', () => {
    const modules = resolveOrgEnabledModules({
      subscription_tier: 'enterprise',
      enabled_modules: ['hub', 'customer-success', 'employee', 'support'],
      settings: {},
    })
    expect(modules).toContain('finance')
    expect(modules).toContain('projects')
  })

  it('intersects user modules with org entitlement', () => {
    const user: ModuleId[] = ['hub', 'projects', 'finance', 'employee']
    const org: ModuleId[] = ['hub', 'projects', 'customer-success', 'employee', 'support']
    expect(intersectModuleAccess(user, org)).toEqual(['hub', 'projects', 'employee'])
  })

  it('buildIntegrationPlan identifies org vs user integrations', () => {
    const org: ModuleId[] = ['hub', 'customer-success', 'workforce', 'employee', 'support']
    const user: ModuleId[] = ['hub', 'workforce', 'employee', 'support']
    const plan = buildIntegrationPlan(org, user)
    expect(plan.orgIntegrations.some((e) => e.from === 'customer-success' && e.to === 'workforce')).toBe(
      true,
    )
    expect(plan.userIntegrations.some((e) => e.from === 'customer-success' && e.to === 'workforce')).toBe(
      false,
    )
    expect(plan.latentIntegrations.length).toBeGreaterThan(0)
  })
})
