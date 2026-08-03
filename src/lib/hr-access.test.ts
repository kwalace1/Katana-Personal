import { describe, it, expect } from 'vitest'
import {
  canManageHrAdmin,
  getHrEmployeesTabLabel,
  getVisibleHrMainTabs,
  isHrMainTabVisible,
} from './hr-access'

describe('hr-access', () => {
  it('identifies HR admins by org role or hr-admin permission', () => {
    expect(canManageHrAdmin('owner')).toBe(true)
    expect(canManageHrAdmin('admin')).toBe(true)
    expect(canManageHrAdmin('member')).toBe(false)
    expect(canManageHrAdmin('member', ['hr', 'hr-admin'])).toBe(true)
  })

  it('shows admin-only tabs only for HR admins', () => {
    expect(getVisibleHrMainTabs(true)).toContain('recruitment')
    expect(getVisibleHrMainTabs(true)).toContain('analytics')
    expect(getVisibleHrMainTabs(false)).not.toContain('recruitment')
    expect(getVisibleHrMainTabs(false)).toContain('time-off')
    expect(getVisibleHrMainTabs(false)).toContain('goals')
  })

  it('labels employees tab for members', () => {
    expect(getHrEmployeesTabLabel(true)).toBe('Employees')
    expect(getHrEmployeesTabLabel(false)).toBe('My profile')
  })

  it('checks tab visibility', () => {
    expect(isHrMainTabVisible('analytics', false)).toBe(false)
    expect(isHrMainTabVisible('time-off', false)).toBe(true)
  })
})
