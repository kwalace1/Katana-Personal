import { describe, it, expect } from 'vitest'
import {
  applyModuleAccessToggle,
  hasHrAdminPermission,
  hasWfmManagerPermission,
  resolveHrAdminAccess,
  resolveWfmManagerAccess,
  sanitizeFullModuleAccess,
  splitModuleAccess,
} from './module-access-permissions'

describe('module-access-permissions', () => {
  it('splits navigable modules from HR and WFM permissions', () => {
    expect(splitModuleAccess(['hub', 'hr', 'hr-admin', 'workforce', 'wfm-manager'])).toEqual({
      modules: ['hub', 'hr', 'workforce'],
      permissions: ['hr-admin', 'wfm-manager'],
    })
  })

  it('resolves HR admin from role or hr-admin permission', () => {
    expect(resolveHrAdminAccess('admin', [])).toBe(true)
    expect(resolveHrAdminAccess('member', ['hr', 'hr-admin'])).toBe(true)
    expect(resolveHrAdminAccess('member', ['hr'])).toBe(false)
    expect(hasHrAdminPermission(['hr-admin'])).toBe(true)
  })

  it('resolves WFM manager from role or wfm-manager permission', () => {
    expect(resolveWfmManagerAccess('owner', [])).toBe(true)
    expect(resolveWfmManagerAccess('member', ['workforce', 'wfm-manager'])).toBe(true)
    expect(resolveWfmManagerAccess('member', ['workforce'])).toBe(false)
    expect(hasWfmManagerPermission(['wfm-manager'])).toBe(true)
  })

  it('couples hr and hr-admin toggles', () => {
    expect(applyModuleAccessToggle([], 'hr-admin', true)).toEqual(['hr-admin', 'hr'])
    expect(applyModuleAccessToggle(['hr', 'hr-admin'], 'hr', false)).toEqual([])
  })

  it('couples workforce and wfm-manager toggles', () => {
    expect(applyModuleAccessToggle([], 'wfm-manager', true)).toEqual(['wfm-manager', 'workforce'])
    expect(applyModuleAccessToggle(['workforce', 'wfm-manager'], 'workforce', false)).toEqual([])
  })

  it('ensures hr is saved when hr-admin is set', () => {
    expect(sanitizeFullModuleAccess(['hr-admin', 'hub']).sort()).toEqual(['hr', 'hr-admin', 'hub'])
  })

  it('ensures workforce is saved when wfm-manager is set', () => {
    expect(sanitizeFullModuleAccess(['wfm-manager', 'hub']).sort()).toEqual(
      ['hub', 'wfm-manager', 'workforce'].sort(),
    )
  })
})
