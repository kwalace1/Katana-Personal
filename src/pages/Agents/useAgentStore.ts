// useAgentStore.ts — SwarmClaw API client for agent status
// Used by the top bar agent pills. All other UI lives in the SwarmClaw iframe.

import { useEffect, useState } from 'react'

const SWARMCLAW_URL = 'http://localhost:3456'
const SWARMCLAW_ACCESS_KEY = '75b862a32c33ae221f28b722a5ec89cb'

export interface SwarmClawAgent {
  id: string
  name: string
  role: string
  color: string
  status: 'idle' | 'running' | 'error' | 'disabled'
}

interface AgentStore {
  agents: SwarmClawAgent[]
  connected: boolean
  loading: boolean
}

export function useAgentStore(): AgentStore {
  const [agents, setAgents] = useState<SwarmClawAgent[]>([])
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchAgents() {
      try {
        const res = await fetch(`${SWARMCLAW_URL}/api/agents`, {
          headers: { 'x-access-key': SWARMCLAW_ACCESS_KEY },
        })
        if (!cancelled && res.ok) {
          const data = await res.json()
          setAgents(data)
          setConnected(true)
        }
      } catch {
        if (!cancelled) setConnected(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAgents()
    const interval = setInterval(fetchAgents, 15000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return { agents, connected, loading }
}
