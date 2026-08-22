import { describe, expect, it } from 'vitest'
import {
  cardioElapsedSeconds,
  cardioGpsAccuracyLimit,
  cardioShouldKeepPoint,
  type CardioTrackState,
} from './cardio-track'

function session(partial: Partial<CardioTrackState> = {}): CardioTrackState {
  return {
    status: 'live',
    kind: 'Walk',
    path: [],
    startedAt: 1_000_000,
    pausedMs: 0,
    pauseStarted: null,
    ...partial,
  }
}

describe('cardioShouldKeepPoint', () => {
  it('drops inaccurate foreground samples', () => {
    expect(cardioShouldKeepPoint(81, false)).toBe(false)
    expect(cardioShouldKeepPoint(80, false)).toBe(true)
  })

  it('allows a looser pocket GPS fix while the app is in the background', () => {
    expect(cardioGpsAccuracyLimit(true)).toBe(200)
    expect(cardioShouldKeepPoint(150, true)).toBe(true)
    expect(cardioShouldKeepPoint(201, true)).toBe(false)
  })
})

describe('cardioElapsedSeconds', () => {
  it('is zero while idle', () => {
    expect(cardioElapsedSeconds(session({ status: 'idle', startedAt: 0 }), 2_000_000)).toBe(0)
  })

  it('counts live time minus pauses', () => {
    expect(cardioElapsedSeconds(session({ pausedMs: 5_000 }), 1_065_000)).toBe(60)
  })

  it('freezes elapsed while paused', () => {
    expect(
      cardioElapsedSeconds(
        session({
          status: 'paused',
          pausedMs: 2_000,
          pauseStarted: 1_030_000,
        }),
        1_090_000,
      ),
    ).toBe(28)
  })
})
