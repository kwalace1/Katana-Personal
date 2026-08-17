export const CLOUD_WORKSPACE_MAP_KEY = 'katana-personal:cloud-workspace-map'
export const FRESH_CLOUD_WORKSPACE_PREFIX = 'katana-personal:fresh-cloud-workspace:'

export type CloudWorkspaceSession = {
  id: string
  display_name: string
  preferences?: Record<string, unknown>
  created_at?: string
  updated_at?: string
  bound_cloud_uid?: string
}

export type CloudWorkspaceMap = Record<string, CloudWorkspaceSession>

export type AdoptAction = 'noop' | 'restore' | 'bind-current' | 'create-fresh'

/** Pure decision: which local workspace belongs to this Cloud account. */
export function decideCloudWorkspaceAdopt(input: {
  cloudUid: string
  current: Pick<CloudWorkspaceSession, 'id' | 'bound_cloud_uid'> | null
  mapped: Pick<CloudWorkspaceSession, 'id'> | null
}): AdoptAction {
  const { cloudUid, current, mapped } = input
  if (mapped && current?.id === mapped.id) {
    return current.bound_cloud_uid === cloudUid ? 'noop' : 'bind-current'
  }
  if (mapped) return 'restore'
  if (current && !current.bound_cloud_uid) return 'bind-current'
  if (current?.bound_cloud_uid === cloudUid) return 'bind-current'
  return 'create-fresh'
}

export function readCloudWorkspaceMap(): CloudWorkspaceMap {
  try {
    const raw = localStorage.getItem(CLOUD_WORKSPACE_MAP_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as CloudWorkspaceMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function writeCloudWorkspaceMap(map: CloudWorkspaceMap) {
  localStorage.setItem(CLOUD_WORKSPACE_MAP_KEY, JSON.stringify(map))
}

export function rememberBoundSession(session: CloudWorkspaceSession | null) {
  if (!session?.bound_cloud_uid) return
  const map = readCloudWorkspaceMap()
  map[session.bound_cloud_uid] = session
  writeCloudWorkspaceMap(map)
}

export function markFreshCloudWorkspace(cloudUid: string) {
  localStorage.setItem(`${FRESH_CLOUD_WORKSPACE_PREFIX}${cloudUid}`, '1')
}

export function consumeFreshCloudWorkspace(cloudUid: string): boolean {
  const key = `${FRESH_CLOUD_WORKSPACE_PREFIX}${cloudUid}`
  const fresh = localStorage.getItem(key) === '1'
  if (fresh) localStorage.removeItem(key)
  return fresh
}
