/** Live cardio GPS session that survives leaving Health & Wellness. */

import type { GeoPoint } from '@/modules/health/types'

export const CARDIO_ACTIVITIES = ['Run', 'Walk', 'Ride', 'Row'] as const
export type CardioTrackKind = (typeof CARDIO_ACTIVITIES)[number]
export type CardioTrackStatus = 'idle' | 'live' | 'paused'

export type CardioTrackState = {
  status: CardioTrackStatus
  kind: CardioTrackKind
  path: GeoPoint[]
  startedAt: number
  pausedMs: number
  pauseStarted: number | null
}

const STORAGE_KEY = 'katana-personal:cardio-track'
const MAX_POINTS = 8000

const idleState = (): CardioTrackState => ({
  status: 'idle',
  kind: 'Run',
  path: [],
  startedAt: 0,
  pausedMs: 0,
  pauseStarted: null,
})

type Listener = (state: CardioTrackState) => void

const listeners = new Set<Listener>()
let state: CardioTrackState = idleState()
let watchId: number | null = null
let wakeLock: { release: () => Promise<void> } | null = null
let booted = false
let visibilityBound = false

export function cardioElapsedSeconds(input: CardioTrackState, now = Date.now()): number {
  if (input.status === 'idle' || !input.startedAt) return 0
  const extraPause = input.status === 'paused' && input.pauseStarted ? now - input.pauseStarted : 0
  return Math.max(0, Math.floor((now - input.startedAt - input.pausedMs - extraPause) / 1000))
}

export function getCardioTrack(): CardioTrackState {
  return state
}

export function subscribeCardioTrack(fn: Listener) {
  listeners.add(fn)
  fn(state)
  return () => {
    listeners.delete(fn)
  }
}

function emit(next: CardioTrackState) {
  state = next
  persist()
  for (const fn of listeners) fn(state)
}

function persist() {
  if (typeof localStorage === 'undefined') return
  try {
    if (state.status === 'idle') {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...state,
        path: state.path.slice(-MAX_POINTS),
      }),
    )
  } catch {
    // quota / private mode
  }
}

function readPersisted(): CardioTrackState | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CardioTrackState>
    if (parsed.status !== 'live' && parsed.status !== 'paused') return null
    if (parsed.kind !== 'Run' && parsed.kind !== 'Walk' && parsed.kind !== 'Ride' && parsed.kind !== 'Row') {
      return null
    }
    if (!Array.isArray(parsed.path)) return null
    const path = parsed.path.filter(
      (p): p is GeoPoint =>
        !!p &&
        typeof p === 'object' &&
        Number.isFinite(p.lat) &&
        Number.isFinite(p.lng) &&
        Number.isFinite(p.t),
    )
    return {
      status: parsed.status,
      kind: parsed.kind,
      path,
      startedAt: Number(parsed.startedAt) || Date.now(),
      pausedMs: Math.max(0, Number(parsed.pausedMs) || 0),
      pauseStarted: parsed.pauseStarted == null ? null : Number(parsed.pauseStarted) || null,
    }
  } catch {
    return null
  }
}

function gpsOk() {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator
}

function clearWatch() {
  if (watchId != null && gpsOk()) {
    navigator.geolocation.clearWatch(watchId)
  }
  watchId = null
}

async function releaseWakeLock() {
  const lock = wakeLock
  wakeLock = null
  try {
    await lock?.release()
  } catch {
    // ignore
  }
}

async function requestWakeLock() {
  await releaseWakeLock()
  try {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> }
    }
    if (!nav.wakeLock) return
    wakeLock = await nav.wakeLock.request('screen')
  } catch {
    // unsupported / denied — tracking still continues
  }
}

function appendPoint(point: GeoPoint) {
  const last = state.path[state.path.length - 1]
  if (last && Math.abs(last.lat - point.lat) < 1e-6 && Math.abs(last.lng - point.lng) < 1e-6) {
    return
  }
  emit({ ...state, path: [...state.path.slice(-(MAX_POINTS - 1)), point] })
}

function startWatch() {
  if (!gpsOk()) return
  clearWatch()
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      if (state.status !== 'live') return
      if (pos.coords.accuracy > 80) return
      appendPoint({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        t: Date.now(),
      })
    },
    () => {
      // Keep the session alive if a single GPS sample fails.
    },
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 20_000 },
  )
}

function pingCurrentPosition() {
  if (!gpsOk() || state.status !== 'live') return
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      if (state.status !== 'live' || pos.coords.accuracy > 120) return
      appendPoint({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        t: Date.now(),
      })
    },
    () => undefined,
    { enableHighAccuracy: true, maximumAge: 0, timeout: 12_000 },
  )
}

function bindVisibility() {
  if (visibilityBound || typeof document === 'undefined') return
  visibilityBound = true
  document.addEventListener('visibilitychange', () => {
    if (state.status === 'idle') return
    if (document.visibilityState === 'hidden') {
      persist()
      return
    }
    if (state.status === 'live') {
      startWatch()
      pingCurrentPosition()
      void requestWakeLock()
    }
  })
  window.addEventListener('pagehide', persist)
}

export function bootCardioTrack() {
  if (booted) return
  booted = true
  bindVisibility()
  const saved = readPersisted()
  if (!saved) return
  state = saved
  if (saved.status === 'live') {
    startWatch()
    pingCurrentPosition()
    void requestWakeLock()
  }
  for (const fn of listeners) fn(state)
}

export function setCardioTrackKind(kind: CardioTrackKind) {
  if (state.status !== 'idle') return
  emit({ ...state, kind })
}

export function startCardioTrack(kind?: CardioTrackKind) {
  bootCardioTrack()
  if (!gpsOk()) {
    throw new Error('This device doesn’t share location')
  }
  clearWatch()
  emit({
    status: 'live',
    kind: kind || state.kind,
    path: [],
    startedAt: Date.now(),
    pausedMs: 0,
    pauseStarted: null,
  })
  startWatch()
  pingCurrentPosition()
  void requestWakeLock()
}

export function pauseCardioTrack() {
  if (state.status !== 'live') return
  clearWatch()
  void releaseWakeLock()
  emit({
    ...state,
    status: 'paused',
    pauseStarted: Date.now(),
  })
}

export function resumeCardioTrack() {
  if (state.status !== 'paused') return
  const extra = state.pauseStarted ? Date.now() - state.pauseStarted : 0
  emit({
    ...state,
    status: 'live',
    pausedMs: state.pausedMs + extra,
    pauseStarted: null,
  })
  startWatch()
  pingCurrentPosition()
  void requestWakeLock()
}

/** Stop GPS and return the finished session. Does not save a workout. */
export function finishCardioTrack(): {
  kind: CardioTrackKind
  path: GeoPoint[]
  elapsed: number
} | null {
  if (state.status === 'idle') return null
  const elapsed = Math.max(1, cardioElapsedSeconds(state))
  const snapshot = { kind: state.kind, path: state.path, elapsed }
  clearWatch()
  void releaseWakeLock()
  emit(idleState())
  return snapshot
}

export function discardCardioTrack() {
  if (state.status === 'idle') return
  clearWatch()
  void releaseWakeLock()
  emit(idleState())
}
