/**
 * Single-flight request coalescing.
 *
 * When several callers ask for the same thing at the same time — e.g. the burst
 * of identical Supabase reads that independent React effects/contexts fire on
 * mount — they share one in-flight promise instead of each issuing its own
 * network request. The map entry is deleted the instant the promise settles
 * (success or failure), so a later call always re-fetches: this collapses only
 * *concurrent* duplicates and never serves stale data.
 */
const inFlight = new Map<string, Promise<unknown>>()

export function coalesceRequest<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key) as Promise<T> | undefined
  if (existing) return existing

  // The entry is cleared inside the promise's own settlement (the `finally`
  // below), which runs before any external awaiter resumes — so a call issued
  // immediately after this one resolves always re-fetches. Errors aren't cached.
  // A second promise for the same key can never exist while this one is in
  // flight — concurrent callers receive `existing` above and never reach here —
  // so deleting by key on settlement is safe and unconditional.
  const promise = (async () => {
    try {
      return await fn()
    } finally {
      inFlight.delete(key)
    }
  })()
  inFlight.set(key, promise)
  return promise
}

/** Test/debug helper: number of requests currently in flight. */
export function inFlightRequestCount(): number {
  return inFlight.size
}
