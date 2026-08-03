/**
 * Per-user "pinned agent" persistence. The SwarmClaw engine does NOT persist an
 * agent's `pinned` flag (it silently drops it), so pins would vanish on every
 * `loadAgents` refetch (page refresh / navigation). We keep them in localStorage,
 * keyed by the signed-in user, and overlay them onto agents as they load.
 */
import { safeStorageGet, safeStorageSet } from '@/lib/office/app/safe-storage'
import type { Agent } from '@/lib/office/types'

const PIN_KEY_PREFIX = 'sc_pinned_agents'

function pinKey(userKey: string | null): string {
  return userKey ? `${PIN_KEY_PREFIX}:${userKey}` : PIN_KEY_PREFIX
}

export function readPinnedAgentIds(userKey: string | null): Set<string> {
  try {
    const raw = safeStorageGet(pinKey(userKey))
    const parsed = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? (parsed as string[]) : [])
  } catch {
    return new Set()
  }
}

export function setAgentPinned(userKey: string | null, id: string, pinned: boolean): void {
  const ids = readPinnedAgentIds(userKey)
  if (pinned) ids.add(id)
  else ids.delete(id)
  try {
    safeStorageSet(pinKey(userKey), JSON.stringify([...ids]))
  } catch {
    /* storage unavailable — pin stays in-memory only */
  }
}

/** Return a copy of `agents` with `pinned` set from the persisted per-user list. */
export function applyPinnedOverlay(
  agents: Record<string, Agent>,
  userKey: string | null,
): Record<string, Agent> {
  const pinned = readPinnedAgentIds(userKey)
  const out: Record<string, Agent> = {}
  for (const [id, agent] of Object.entries(agents)) {
    const shouldPin = pinned.has(id)
    out[id] = Boolean(agent.pinned) === shouldPin ? agent : { ...agent, pinned: shouldPin }
  }
  return out
}
