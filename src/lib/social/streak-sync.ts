/** Debounced bridge: local habit/health writes → optional cloud streak publish + activity pings. */

type SyncFn = () => Promise<void>
type ActivityPingFn = (message: string) => Promise<void>

let syncFn: SyncFn | null = null
let activityPingFn: ActivityPingFn | null = null
let timer: ReturnType<typeof setTimeout> | null = null

export function registerStreakSync(fn: SyncFn | null) {
  syncFn = fn
}

export function registerActivityPing(fn: ActivityPingFn | null) {
  activityPingFn = fn
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

/** Sync streaks and optionally ping the activity timeline (if prefs allow). */
export function notifyCheckIn(message: string) {
  notifyLocalProgress()
  if (!activityPingFn || !message.trim()) return
  void activityPingFn(message.trim()).catch(() => {
    // optional
  })
}
