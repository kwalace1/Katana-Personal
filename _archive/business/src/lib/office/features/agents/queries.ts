import { useQuery } from '@tanstack/react-query'
import { fetchAgents } from '@/lib/office/agents'
import type { Agent } from '@/lib/office/types'

type QueryOptions = {
  enabled?: boolean
}

export const agentQueryKeys = {
  all: ['agents'] as const,
}

export function useAgentsQuery(options: QueryOptions = {}) {
  return useQuery<Record<string, Agent>>({
    queryKey: agentQueryKeys.all,
    queryFn: fetchAgents,
    enabled: options.enabled,
    staleTime: 60_000,
  })
}
