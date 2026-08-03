import { useCallback, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { resolveWfmTerminology, saveWfmWorkProfile } from '@/lib/wfm-settings'
import type { WfmTerminology, WfmWorkProfile } from '@/lib/wfm-terminology'

export function useWfmTerminology() {
  const { organization, refreshProfile } = useAuth()
  const orgSettings = (organization?.settings as Record<string, unknown> | undefined) ?? null
  const [overrideProfile, setOverrideProfile] = useState<WfmWorkProfile | null>(null)

  const terms = useMemo(() => {
    const settings = overrideProfile
      ? { ...(orgSettings ?? {}), wfm_work_profile: overrideProfile }
      : orgSettings
    return resolveWfmTerminology(settings)
  }, [orgSettings, overrideProfile])

  const saveProfile = useCallback(
    async (profile: WfmWorkProfile) => {
      setOverrideProfile(profile)
      if (organization?.id) {
        await saveWfmWorkProfile(organization.id, orgSettings, profile)
        await refreshProfile()
      }
    },
    [organization?.id, orgSettings, refreshProfile],
  )

  return { terms, saveProfile } satisfies { terms: WfmTerminology; saveProfile: (p: WfmWorkProfile) => Promise<void> }
}
