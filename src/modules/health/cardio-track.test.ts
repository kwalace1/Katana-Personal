import { describe, expect, it } from 'vitest'
import { cardioElapsedSeconds, type CardioTrackState } from './cardio-track'

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
