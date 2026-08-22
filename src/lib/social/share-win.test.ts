import { describe, expect, it } from 'vitest'
import { formatFeedCardLiftLine, summarizeFeedCardLifts } from './feed'
import {
  buildLiftExercisesShareCard,
  buildLiftPrShareCard,
  buildLiftShareCard,
  resolveLiftShareOffer,
} from './share-win'

const bench = {
  name: 'Bench press',
  sets: [
    { weight: 185, reps: 5 },
    { weight: 195, reps: 3 },
  ],
}
const row = { name: 'Barbell row', sets: [{ weight: 155, reps: 8 }] }

describe('formatFeedCardLiftLine', () => {
  it('shows weight and reps for each set', () => {
    expect(formatFeedCardLiftLine(bench)).toBe('Bench press: 185 lb × 5 · 195 lb × 3')
  })
})

describe('summarizeFeedCardLifts', () => {
  it('counts exercises and sets', () => {
    expect(summarizeFeedCardLifts([bench, row])).toBe('2 exercises · 3 sets')
  })
})

describe('lift share cards', () => {
  it('embeds lifts so the feed card can expand', () => {
    const offer = buildLiftShareCard({
      title: 'Push',
      dateLabel: 'Mon · Aug 10',
      setCount: 3,
      exerciseCount: 2,
      lifts: [bench, row],
    })
    expect(offer.card.lifts).toEqual([bench, row])
    expect(offer.card.stats).toMatch(/2 exercises/)
  })

  it('lets the user post the full workout instead of only the PR', () => {
    const liftShare = {
      title: 'Push',
      dateLabel: 'Mon · Aug 10',
      exercises: [bench, row],
      pr: { exerciseName: 'Bench press', weight: 195, reps: 3, previousBest: 185 },
    }
    const workout = resolveLiftShareOffer(liftShare, 'workout', [])
    expect(workout.card.title).toBe('Push')
    expect(workout.card.badge).toBe('Workout done')
    expect(workout.card.lifts?.map((l) => l.name)).toEqual(['Bench press', 'Barbell row'])

    const pr = resolveLiftShareOffer(liftShare, 'pr', [])
    expect(pr.card.title).toBe('Bench press')
    expect(pr.card.badge).toBe('New PR')

    const picks = resolveLiftShareOffer(liftShare, 'exercises', ['Barbell row'])
    expect(picks.card.title).toBe('Barbell row')
    expect(picks.card.lifts).toEqual([row])
  })

  it('includes the PR set on a PR card even without extra lifts', () => {
    const offer = buildLiftPrShareCard({
      exerciseName: 'Squat',
      weight: 315,
      reps: 2,
      previousBest: 300,
    })
    expect(offer.card.lifts?.[0]).toEqual({ name: 'Squat', sets: [{ weight: 315, reps: 2 }] })
  })

  it('builds a selected-exercise card', () => {
    const offer = buildLiftExercisesShareCard({
      title: 'Push',
      dateLabel: 'Mon',
      exercises: [bench],
    })
    expect(offer.card.title).toBe('Bench press')
    expect(offer.defaultCaption).toMatch(/Bench press/)
  })
})
