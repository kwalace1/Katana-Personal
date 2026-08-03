import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/office/app/api-client'
import type { AppSettings } from '@/lib/office/types'

type QueryOptions = {
  enabled?: boolean
}

export const settingsQueryKeys = {
  app: ['settings', 'app'] as const,
}

export function useAppSettingsQuery(options: QueryOptions = {}) {
  return useQuery<AppSettings>({
    queryKey: settingsQueryKeys.app,
    queryFn: () => api<AppSettings>('GET', '/settings'),
    enabled: options.enabled,
    staleTime: 60_000,
  })
}
