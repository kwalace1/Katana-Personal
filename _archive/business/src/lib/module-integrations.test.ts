import { describe, it, expect } from 'vitest'
import {
  canIntegrate,
  canBillViaCustomerSuccess,
  canReconcileInFinance,
  invoiceDeepLink,
  visibleIntegrationEdges,
} from './module-integrations'
import type { ModuleId } from './module-access'

const FULL_ACCESS: ModuleId[] = [
  'hub',
  'projects',
  'inventory',
  'customer-success',
  'workforce',
  'hr',
  'finance',
  'comms',
]

describe('module-integrations', () => {
  it('canIntegrate requires both modules', () => {
    expect(canIntegrate(['workforce', 'customer-success'], 'workforce', 'customer-success')).toBe(true)
    expect(canIntegrate(['workforce'], 'workforce', 'customer-success')).toBe(false)
  })

  it('billing helpers respect module access', () => {
    expect(canBillViaCustomerSuccess(FULL_ACCESS)).toBe(true)
    expect(canReconcileInFinance(['finance'])).toBe(true)
    expect(canBillViaCustomerSuccess(['finance'])).toBe(false)
  })

  it('invoiceDeepLink prefers CS commerce', () => {
    expect(invoiceDeepLink('inv-1', FULL_ACCESS)).toContain('commerce')
    expect(invoiceDeepLink('inv-1', ['finance'])).toContain('finance')
  })

  it('visibleIntegrationEdges filters by access', () => {
    const edges = visibleIntegrationEdges(['workforce', 'projects'])
    expect(edges.some((e) => e.from === 'workforce' && e.to === 'projects')).toBe(true)
    expect(edges.some((e) => e.from === 'customer-success' && e.to === 'finance')).toBe(false)
  })
})
