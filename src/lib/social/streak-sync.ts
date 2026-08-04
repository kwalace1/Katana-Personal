/** Debounced bridge: local habit/health writes → optional cloud streak publish. */

type SyncFn = () => Promise<void>

let syncFn: SyncFn | null = null
let timer: ReturnType<typeof setTimeout> | null = null

export function registerStreakSync(fn: SyncFn | null) {
  syncFn = fn
}

/** Call after habit check-in / water log so Circles stay live. */
export function notifyLocalProgress() {
  if (!syncFn) return
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    void syncFn?.().catch(() => {
      // cloud optional
    })
  }, 800)
}
