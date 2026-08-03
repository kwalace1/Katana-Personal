import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockState = vi.hoisted(() => ({
  company: null as Record<string, unknown> | null,
  investor: null as Record<string, unknown> | null,
  companyError: null as { message: string } | null,
  investorError: null as { message: string } | null,
  org: null as Record<string, unknown> | null,
  orgError: null as { message: string } | null,
  companyList: [] as Record<string, unknown>[],
  companyListError: null as { message: string } | null,
  inserted: null as Record<string, unknown> | null,
  insertError: null as { message: string } | null,
}))

vi.mock('./auth-helpers', () => ({
  getOrganizationId: vi.fn().mockResolvedValue('org-a'),
  getCurrentUserId: vi.fn().mockResolvedValue('user-a'),
}))

vi.mock('./supabase', () => {
  const chainFor = (table: string) => {
    const api: Record<string, unknown> = {}
    api.eq = vi.fn(() => api)
    api.order = vi.fn(() => api)
    api.maybeSingle = vi.fn(async () => {
      if (table === 'kyi_companies') {
        return { data: mockState.company, error: mockState.companyError }
      }
      if (table === 'kyi_investors') {
        return { data: mockState.investor, error: mockState.investorError }
      }
      if (table === 'organizations') {
        return { data: mockState.org, error: mockState.orgError }
      }
      return { data: null, error: null }
    })
    api.single = vi.fn(async () => ({
      data: mockState.inserted,
      error: mockState.insertError,
    }))
    // list path: select().eq().order() resolves as thenable via awaiting the chain in some clients;
    // our ensureOrganizationCompany awaits the builder after .order(), so make it thenable.
    api.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({
        data: table === 'kyi_companies' ? mockState.companyList : null,
        error: table === 'kyi_companies' ? mockState.companyListError : null,
      }).then(resolve, reject)
    return api
  }

  return {
    isSupabaseConfigured: true,
    supabase: {
      from: vi.fn((table: string) => ({
        select: vi.fn(() => chainFor(table)),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: mockState.inserted,
              error: mockState.insertError,
            })),
          })),
        })),
      })),
    },
  }
})

vi.mock('./kyi-northstar', () => ({
  seedCompanyNorthstarDefaults: vi.fn().mockResolvedValue(undefined),
}))

import {
  assertCompanyInOrg,
  assertInvestorInOrg,
  ensureOrganizationCompany,
  isLeakedDemoCompanyName,
} from './kyi-org'

describe('kyi-org ownership asserts', () => {
  beforeEach(() => {
    mockState.company = null
    mockState.investor = null
    mockState.companyError = null
    mockState.investorError = null
    mockState.org = null
    mockState.orgError = null
    mockState.companyList = []
    mockState.companyListError = null
    mockState.inserted = null
    mockState.insertError = null
  })

  it('assertCompanyInOrg returns org id when company belongs to current org', async () => {
    mockState.company = { id: 42 }
    await expect(assertCompanyInOrg(42)).resolves.toBe('org-a')
  })

  it('assertCompanyInOrg rejects companies outside the current org', async () => {
    mockState.company = null
    await expect(assertCompanyInOrg(99)).rejects.toThrow('Company not found in your organization')
  })

  it('assertInvestorInOrg returns org and company when investor is in current org', async () => {
    mockState.investor = { id: 7, company_id: 42 }
    await expect(assertInvestorInOrg(7)).resolves.toEqual({ orgId: 'org-a', companyId: 42 })
  })

  it('assertInvestorInOrg rejects investors outside the current org', async () => {
    mockState.investor = null
    await expect(assertInvestorInOrg(7)).rejects.toThrow('Investor not found in your organization')
  })

  it('assertInvestorInOrg allows null company_id', async () => {
    mockState.investor = { id: 7, company_id: null }
    await expect(assertInvestorInOrg(7)).resolves.toEqual({ orgId: 'org-a', companyId: null })
  })
})

describe('isLeakedDemoCompanyName', () => {
  it('flags Katana Business Solutions when org is different', () => {
    expect(isLeakedDemoCompanyName('Katana Business Solutions', 'DW Growth and Capital')).toBe(true)
  })

  it('flags Swing when org is different', () => {
    expect(isLeakedDemoCompanyName('Swing', 'DW Growth and Capital')).toBe(true)
  })

  it('does not flag when company matches org name', () => {
    expect(isLeakedDemoCompanyName('DW Growth and Capital', 'DW Growth and Capital')).toBe(false)
  })

  it('does not flag unrelated company names', () => {
    expect(isLeakedDemoCompanyName('Acme Robotics', 'DW Growth and Capital')).toBe(false)
  })
})

describe('ensureOrganizationCompany', () => {
  beforeEach(() => {
    mockState.org = { id: 'org-a', name: 'DW Growth and Capital', settings: {} }
    mockState.companyList = []
    mockState.inserted = null
    mockState.insertError = null
  })

  it('returns existing company when org-named row already exists', async () => {
    mockState.companyList = [
      { id: 1, name: 'Katana Business Solutions', organization_id: 'org-a' },
      { id: 2, name: 'DW Growth and Capital', organization_id: 'org-a' },
    ]
    await expect(ensureOrganizationCompany()).resolves.toEqual({
      id: 2,
      name: 'DW Growth and Capital',
      organization_id: 'org-a',
      created: false,
    })
  })

  it('creates a company named after the organization when missing', async () => {
    mockState.companyList = [{ id: 1, name: 'Swing', organization_id: 'org-a' }]
    mockState.inserted = {
      id: 99,
      name: 'DW Growth and Capital',
      organization_id: 'org-a',
    }
    await expect(ensureOrganizationCompany()).resolves.toEqual({
      id: 99,
      name: 'DW Growth and Capital',
      organization_id: 'org-a',
      created: true,
    })
  })
})
