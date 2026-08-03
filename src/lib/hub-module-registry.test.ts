import { describe, it, expect } from 'vitest'
import { HUB_TOOL_MODULE_IDS, getMissingHubToolModules } from './hub-module-registry'

/** Keep in sync with HubPage `modules` — used to catch missing Hub cards when new modules ship. */
const HUB_PAGE_DEFINED_MODULE_IDS = [
  'projects',
  'inventory',
  'customer-success',
  'workforce',
  'hr',
  'employee',
  'careers',
  'automation',
  'kyi',
  'support',
  'finance',
  'esign',
  'comms',
  'agents',
] as const

describe('hub module registry', () => {
  it('defines a Hub card for every tool module (except hub + employee portal)', () => {
    expect(getMissingHubToolModules([...HUB_PAGE_DEFINED_MODULE_IDS])).toEqual([])
    expect(HUB_TOOL_MODULE_IDS.sort()).toEqual(
      [...HUB_PAGE_DEFINED_MODULE_IDS].filter((id) => id !== 'employee').sort()
    )
  })
})
