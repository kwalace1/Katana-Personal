import { useCallback, useEffect, useState } from 'react'

const EVENT = 'katana:local-refresh'

/** Broadcast so every mounted page re-reads IndexedDB after sync/restore. */
export function broadcastLocalRefresh() {
  window.dispatchEvent(new Event(EVENT))
}

/** Force a re-read of sync localDb data after mutations. */
export function useLocalRefresh() {
  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => {
    setTick((n) => n + 1)
    broadcastLocalRefresh()
  }, [])

  useEffect(() => {
    const onRefresh = () => setTick((n) => n + 1)
    window.addEventListener(EVENT, onRefresh)
    return () => window.removeEventListener(EVENT, onRefresh)
  }, [])

  return { tick, refresh }
}
