import { describe, it, expect } from 'vitest'
import { getQuickCreateModuleId } from './hub-quick-create'

describe('hub-quick-create', () => {
  it('maps create types to module ids', () => {
    expect(getQuickCreateModuleId('project')).toBe('projects')
    expect(getQuickCreateModuleId('client')).toBe('customer-success')
    expect(getQuickCreateModuleId('employee')).toBe('hr')
  })
})
