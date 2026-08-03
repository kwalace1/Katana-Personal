import { useCallback, useState } from 'react'

/** Force a re-read of sync localDb data after mutations. */
export function useLocalRefresh() {
  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick((n) => n + 1), [])
  return { tick, refresh }
}
