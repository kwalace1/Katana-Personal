import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  applyMemberModuleAccess,
  clampModulesToPilot,
  normalizeModuleIdList,
  sanitizeModuleAccessForSave,
} from './pilot-access'

describe('pilot-access', () => {
  const originalEnv = import.meta.env.VITE_PILOT_MODULES

  afterEach(() => {
    import.meta.env.VITE_PILOT_MODULES = originalEnv
  })

  beforeEach(() => {
    import.meta.env.VITE_PILOT_MODULES = ''
  })

  it('normalizes module id lists', () => {
    expect(normalizeModuleIdList(['hub', 'invalid', 'projects'])).toEqual(['hub', 'projects'])
    expect(normalizeModuleIdList('["hub","employee"]')).toEqual(['hub', 'employee'])
  })

  it('keeps hr in member module access when assigned (strips hr-admin flag)', () => {
    expect(applyMemberModuleAccess(['hub', 'hr', 'projects', 'hr-admin'])).toEqual(['hub', 'hr', 'projects'])
  })

  it('clamps to pilot allowlist when VITE_PILOT_MODULES is set', () => {
    import.meta.env.VITE_PILOT_MODULES = 'hub,employee,projects,hr'
    expect(clampModulesToPilot(['hub', 'inventory', 'projects'])).toEqual(['hub', 'projects'])
    expect(applyMemberModuleAccess(['hub', 'inventory', 'hr'])).toEqual(['hub', 'hr'])
    expect(sanitizeModuleAccessForSave(['inventory', 'hub', 'employee', 'hr-admin'])).toEqual([
      'hub',
      'employee',
      'hr-admin',
      'hr',
    ])
  })

  it('does not clamp when pilot env is unset', () => {
    expect(clampModulesToPilot(['hub', 'inventory'])).toEqual(['hub', 'inventory'])
    expect(sanitizeModuleAccessForSave(['hub', 'inventory'])).toEqual(['hub', 'inventory'])
  })

  it('bypasses pilot clamp when bypassPilot is set', () => {
    import.meta.env.VITE_PILOT_MODULES = 'hub,employee,projects,hr'
    expect(applyMemberModuleAccess(['hub', 'inventory', 'hr'], { bypassPilot: true })).toEqual([
      'hub',
      'inventory',
      'hr',
    ])
    expect(
      sanitizeModuleAccessForSave(['inventory', 'hub', 'finance'], undefined, { bypassPilot: true }),
    ).toEqual(['inventory', 'hub', 'finance'])
  })
})
