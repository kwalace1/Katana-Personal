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
const PING_MS = 4_000
const NOTIFY_TAG = 'katana-cardio-live'
const CARDIO_HREF = '/health?tab=workouts&area=fitness'

/** Foreground GPS is tighter; the phone-in-pocket background fix needs more slack. */
export function cardioGpsAccuracyLimit(hidden: boolean) {
  return hidden ? 200 : 80
}

export function cardioShouldKeepPoint(accuracy: number, hidden: boolean) {
  return Number.isFinite(accuracy) && accuracy > 0 && accuracy <= cardioGpsAccuracyLimit(hidden)
}

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
let pingTimer: ReturnType<typeof setInterval> | null = null
let keepaliveAudio: HTMLAudioElement | null = null
let keepaliveUrl: string | null = null

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

function pageHidden() {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden'
}

function startWatch() {
  if (!gpsOk()) return
  clearWatch()
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      if (state.status !== 'live') return
      if (!cardioShouldKeepPoint(pos.coords.accuracy, pageHidden())) return
      appendPoint({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        t: Date.now(),
      })
    },
    () => {
      // Keep the session alive if a single GPS sample fails.
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
  )
}

function pingCurrentPosition() {
  if (!gpsOk() || state.status !== 'live') return
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      if (state.status !== 'live') return
      if (!cardioShouldKeepPoint(pos.coords.accuracy, pageHidden())) return
      appendPoint({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        t: Date.now(),
      })
    },
    () => undefined,
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
  )
}

function startPingLoop() {
  stopPingLoop()
  pingTimer = setInterval(pingCurrentPosition, PING_MS)
}

function stopPingLoop() {
  if (pingTimer != null) {
    clearInterval(pingTimer)
    pingTimer = null
  }
}

function silentWavUrl() {
  const sampleRate = 8_000
  const seconds = 2
  const samples = sampleRate * seconds
  const bytes = 44 + samples * 2
  const buffer = new ArrayBuffer(bytes)
  const view = new DataView(buffer)
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }
  write(0, 'RIFF')
  view.setUint32(4, bytes - 8, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  write(36, 'data')
  view.setUint32(40, samples * 2, true)
  // Near-silent tone so iOS/Android do not treat playback as muted and suspend the tab.
  for (let i = 0; i < samples; i++) {
    const sample = Math.round(Math.sin((2 * Math.PI * 180 * i) / sampleRate) * 24)
    view.setInt16(44 + i * 2, sample, true)
  }
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }))
}

async function startKeepalive(kind: CardioTrackKind) {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return
  try {
    if (!keepaliveAudio) {
      keepaliveUrl = silentWavUrl()
      keepaliveAudio = new Audio(keepaliveUrl)
      keepaliveAudio.loop = true
      keepaliveAudio.preload = 'auto'
    }
    keepaliveAudio.volume = 0.02
    await keepaliveAudio.play()
  } catch {
    // Autoplay blocked — tracking still continues while the page is visible.
  }
  try {
    const media = navigator as Navigator & {
      mediaSession?: {
        metadata: MediaMetadata | null
        playbackState: MediaSessionPlaybackState
        setActionHandler: (action: MediaSessionAction, handler: (() => void) | null) => void
      }
    }
    if (!media.mediaSession || typeof MediaMetadata === 'undefined') return
    media.mediaSession.metadata = new MediaMetadata({
      title: `${kind} in progress`,
      artist: 'Katana is tracking your route',
      album: 'Cardio',
    })
    media.mediaSession.playbackState = 'playing'
    media.mediaSession.setActionHandler('pause', () => pauseCardioTrack())
    media.mediaSession.setActionHandler('play', () => resumeCardioTrack())
    media.mediaSession.setActionHandler('stop', () => discardCardioTrack())
  } catch {
    // Media Session is optional.
  }
}

function stopKeepalive() {
  try {
    keepaliveAudio?.pause()
    if (keepaliveAudio) keepaliveAudio.currentTime = 0
  } catch {
    // ignore
  }
  try {
    const media = navigator as Navigator & { mediaSession?: { playbackState: MediaSessionPlaybackState } }
    if (media.mediaSession) media.mediaSession.playbackState = 'none'
  } catch {
    // ignore
  }
}

async function showTrackingNotification(kind: CardioTrackKind) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.ready.catch(() => null) : null
    const opts: NotificationOptions = {
      body: 'Location stays on while you leave the app. Don’t swipe Katana away.',
      tag: NOTIFY_TAG,
      silent: true,
      icon: '/icons/katana-192.png',
      data: { href: CARDIO_HREF },
    }
    if (reg?.showNotification) {
      await reg.showNotification(`${kind} tracking`, opts)
      return
    }
    new Notification(`${kind} tracking`, opts)
  } catch {
    // Notifications are optional.
  }
}

async function hideTrackingNotification() {
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.ready.catch(() => null) : null
    const notes = await reg?.getNotifications?.({ tag: NOTIFY_TAG })
    notes?.forEach((n) => n.close())
  } catch {
    // ignore
  }
}

async function armLiveSession() {
  startWatch()
  pingCurrentPosition()
  startPingLoop()
  void requestWakeLock()
  void startKeepalive(state.kind)
  void showTrackingNotification(state.kind)
}

function disarmLiveSession() {
  clearWatch()
  stopPingLoop()
  stopKeepalive()
  void releaseWakeLock()
  void hideTrackingNotification()
}

function bindVisibility() {
  if (visibilityBound || typeof document === 'undefined') return
  visibilityBound = true
  document.addEventListener('visibilitychange', () => {
    if (state.status === 'idle') return
    persist()
    if (document.visibilityState === 'hidden') {
      if (state.status === 'live') pingCurrentPosition()
      return
    }
    if (state.status === 'live') {
      void armLiveSession()
    }
  })
  window.addEventListener('pagehide', persist)
  window.addEventListener('freeze', persist as EventListener)
  window.addEventListener('pageshow', () => {
    if (state.status === 'live') void armLiveSession()
  })
  window.addEventListener('focus', () => {
    if (state.status === 'live') pingCurrentPosition()
  })
}

export function bootCardioTrack() {
  if (booted) return
  booted = true
  bindVisibility()
  const saved = readPersisted()
  if (!saved) return
  state = saved
  if (saved.status === 'live') {
    void armLiveSession()
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
  emit({
    status: 'live',
    kind: kind || state.kind,
    path: [],
    startedAt: Date.now(),
    pausedMs: 0,
    pauseStarted: null,
  })
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    void Notification.requestPermission().catch(() => undefined)
  }
  void armLiveSession()
}

export function pauseCardioTrack() {
  if (state.status !== 'live') return
  disarmLiveSession()
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
  void armLiveSession()
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
  disarmLiveSession()
  emit(idleState())
  return snapshot
}

export function discardCardioTrack() {
  if (state.status === 'idle') return
  disarmLiveSession()
  emit(idleState())
}
