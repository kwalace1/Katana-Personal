import type { SplitDay, SplitPattern } from './types'

export type WorkoutProgram = {
  id: string
  name: string
  level: 'Beginner' | 'Intermediate' | 'Advanced'
  daysPerWeek: number
  description: string
  pattern: SplitPattern
  days: SplitDay[]
  premium: boolean
}

const rest = (name = 'Rest'): SplitDay => ({ name, focus: 'Recovery', exercises: [] })

export const WORKOUT_PROGRAMS: WorkoutProgram[] = [
  {
    id: 'beginner-full-body',
    name: 'Beginner Full Body',
    level: 'Beginner',
    daysPerWeek: 3,
    description: 'Three simple full-body sessions built around the major movement patterns.',
    pattern: 'cycle',
    premium: false,
    days: [
      {
        name: 'Workout A',
        focus: 'Squat, push, pull',
        exercises: [
          { name: 'Squat', sets: 3, reps: '5–8' },
          { name: 'Bench Press', sets: 3, reps: '5–8' },
          { name: 'Barbell Row', sets: 3, reps: '8–10' },
        ],
      },
      rest(),
      {
        name: 'Workout B',
        focus: 'Hinge, overhead, vertical pull',
        exercises: [
          { name: 'Deadlift', sets: 3, reps: '3–5' },
          { name: 'Overhead Press', sets: 3, reps: '5–8' },
          { name: 'Lat Pulldown', sets: 3, reps: '8–12' },
        ],
      },
      rest(),
    ],
  },
  {
    id: 'classic-5x5',
    name: 'Classic 5×5',
    level: 'Beginner',
    daysPerWeek: 3,
    description: 'Alternating compound sessions with straightforward progressive overload.',
    pattern: 'cycle',
    premium: false,
    days: [
      {
        name: 'A',
        focus: 'Squat · Bench · Row',
        exercises: [
          { name: 'Squat', sets: 5, reps: '5' },
          { name: 'Bench Press', sets: 5, reps: '5' },
          { name: 'Barbell Row', sets: 5, reps: '5' },
        ],
      },
      rest(),
      {
        name: 'B',
        focus: 'Squat · Press · Deadlift',
        exercises: [
          { name: 'Squat', sets: 5, reps: '5' },
          { name: 'Overhead Press', sets: 5, reps: '5' },
          { name: 'Deadlift', sets: 1, reps: '5' },
        ],
      },
      rest(),
    ],
  },
  {
    id: 'strength-ppl',
    name: 'Strength Push / Pull / Legs',
    level: 'Intermediate',
    daysPerWeek: 6,
    description: 'A complete six-day strength and hypertrophy rotation.',
    pattern: 'cycle',
    premium: true,
    days: [
      {
        name: 'Push',
        focus: 'Chest, shoulders, triceps',
        exercises: [
          { name: 'Bench Press', sets: 4, reps: '4–6' },
          { name: 'Overhead Press', sets: 3, reps: '6–8' },
          { name: 'Incline Bench Press', sets: 3, reps: '8–10' },
          { name: 'Lateral Raise', sets: 3, reps: '12–15' },
          { name: 'Triceps Pushdown', sets: 3, reps: '10–15' },
        ],
      },
      {
        name: 'Pull',
        focus: 'Back, rear delts, biceps',
        exercises: [
          { name: 'Deadlift', sets: 3, reps: '3–5' },
          { name: 'Pull-Up', sets: 4, reps: '6–10' },
          { name: 'Barbell Row', sets: 3, reps: '6–8' },
          { name: 'Preacher Curl', sets: 3, reps: '10–12' },
        ],
      },
      {
        name: 'Legs',
        focus: 'Quads, hamstrings, glutes',
        exercises: [
          { name: 'Squat', sets: 4, reps: '4–6' },
          { name: 'Romanian Deadlift', sets: 3, reps: '6–10' },
          { name: 'Leg Press', sets: 3, reps: '10–12' },
          { name: 'Leg Curl', sets: 3, reps: '10–15' },
        ],
      },
      rest(),
    ],
  },
  {
    id: 'power-upper-lower',
    name: 'Power Upper / Lower',
    level: 'Advanced',
    daysPerWeek: 4,
    description: 'Four focused days balancing heavy compounds and volume work.',
    pattern: 'cycle',
    premium: true,
    days: [
      {
        name: 'Upper Power',
        focus: 'Heavy push + pull',
        exercises: [
          { name: 'Bench Press', sets: 4, reps: '3–5' },
          { name: 'Barbell Row', sets: 4, reps: '4–6' },
          { name: 'Overhead Press', sets: 3, reps: '5–8' },
          { name: 'Pull-Up', sets: 3, reps: '6–10' },
        ],
      },
      {
        name: 'Lower Power',
        focus: 'Heavy squat + hinge',
        exercises: [
          { name: 'Squat', sets: 4, reps: '3–5' },
          { name: 'Deadlift', sets: 3, reps: '3–5' },
          { name: 'Leg Press', sets: 3, reps: '8–10' },
        ],
      },
      rest(),
      {
        name: 'Upper Volume',
        focus: 'Chest, back, shoulders, arms',
        exercises: [
          { name: 'Incline Bench Press', sets: 4, reps: '8–12' },
          { name: 'Lat Pulldown', sets: 4, reps: '8–12' },
          { name: 'T-Bar Row', sets: 3, reps: '10–12' },
          { name: 'Lateral Raise', sets: 3, reps: '12–20' },
        ],
      },
      {
        name: 'Lower Volume',
        focus: 'Quads, hamstrings, glutes',
        exercises: [
          { name: 'Romanian Deadlift', sets: 4, reps: '8–10' },
          { name: 'Leg Press', sets: 4, reps: '10–15' },
          { name: 'Leg Extension', sets: 3, reps: '12–15' },
          { name: 'Leg Curl', sets: 3, reps: '12–15' },
        ],
      },
      rest(),
    ],
  },
]

