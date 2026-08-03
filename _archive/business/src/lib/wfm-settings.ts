import {
  getWfmTerminology,
  inferWfmWorkProfileFromIndustry,
  isWfmWorkProfile,
  type WfmTerminology,
  type WfmWorkProfile,
} from './wfm-terminology'
import { updateOrganizationSettings } from './tenant-context'

const LOCAL_STORAGE_KEY = 'katana_wfm_work_profile'

export function readLocalWfmWorkProfile(): WfmWorkProfile | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
  return isWfmWorkProfile(raw) ? raw : null
}

export function writeLocalWfmWorkProfile(profile: WfmWorkProfile): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(LOCAL_STORAGE_KEY, profile)
}

export function resolveWfmWorkProfile(
  orgSettings: Record<string, unknown> | null | undefined,
): WfmWorkProfile {
  const fromOrg = orgSettings?.wfm_work_profile
  if (isWfmWorkProfile(fromOrg)) return fromOrg

  const fromLocal = readLocalWfmWorkProfile()
  if (fromLocal) return fromLocal

  const industry = typeof orgSettings?.industry === 'string' ? orgSettings.industry : null
  return inferWfmWorkProfileFromIndustry(industry)
}

export function resolveWfmTerminology(
  orgSettings: Record<string, unknown> | null | undefined,
): WfmTerminology {
  return getWfmTerminology(resolveWfmWorkProfile(orgSettings))
}

export async function saveWfmWorkProfile(
  organizationId: string,
  currentSettings: Record<string, unknown> | null | undefined,
  profile: WfmWorkProfile,
): Promise<void> {
  writeLocalWfmWorkProfile(profile)
  await updateOrganizationSettings(organizationId, {
    ...(currentSettings ?? {}),
    wfm_work_profile: profile,
  })
}
