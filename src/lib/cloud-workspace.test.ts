import { describe, expect, it } from 'vitest'
import { decideCloudWorkspaceAdopt } from './cloud-workspace'

describe('decideCloudWorkspaceAdopt', () => {
  it('keeps the current workspace when it is already this Cloud account', () => {
    expect(
      decideCloudWorkspaceAdopt({
        cloudUid: 'kevin',
        current: { id: 'ws-k', bound_cloud_uid: 'kevin' },
        mapped: { id: 'ws-k' },
      }),
    ).toBe('noop')
  })

  it('restores a mapped workspace when signing into that Cloud account', () => {
    expect(
      decideCloudWorkspaceAdopt({
        cloudUid: 'kevin',
        current: { id: 'ws-other', bound_cloud_uid: 'friend' },
        mapped: { id: 'ws-k' },
      }),
    ).toBe('restore')
  })

  it('binds an unbound local space on first Cloud connect', () => {
    expect(
      decideCloudWorkspaceAdopt({
        cloudUid: 'kevin',
        current: { id: 'ws-k' },
        mapped: null,
      }),
    ).toBe('bind-current')
  })

  it('starts a fresh space when this device is already someone else’s account', () => {
    expect(
      decideCloudWorkspaceAdopt({
        cloudUid: 'friend',
        current: { id: 'ws-k', bound_cloud_uid: 'kevin' },
        mapped: null,
      }),
    ).toBe('create-fresh')
  })

  it('starts fresh when there is no local session and no mapping', () => {
    expect(
      decideCloudWorkspaceAdopt({
        cloudUid: 'friend',
        current: null,
        mapped: null,
      }),
    ).toBe('create-fresh')
  })
})
