export type FriendshipStatus = 'pending' | 'accepted'

export interface CloudProfile {
  uid: string
  displayName: string
  email: string
  friendCode: string
  photoURL?: string | null
  /** Opt-in categories friends can see on Circles / activity */
  sharePrefs: SharePrefs
  createdAt: string
  updatedAt: string
}

export interface SharePrefs {
  habits: boolean
  goals: boolean
  journalMood: boolean
  healthWater: boolean
  healthSleep: boolean
  healthNutrition: boolean
  healthWorkouts: boolean
  notes: boolean
  files: boolean
  activityFeed: boolean
}

export const DEFAULT_SHARE_PREFS: SharePrefs = {
  habits: false,
  goals: false,
  journalMood: false,
  healthWater: false,
  healthSleep: false,
  healthNutrition: false,
  healthWorkouts: false,
  notes: false,
  files: false,
  activityFeed: false,
}

export interface Friendship {
  id: string
  a: string
  b: string
  status: FriendshipStatus
  requestedBy: string
  createdAt: string
  updatedAt: string
}

export type SharedKind = 'task' | 'event' | 'goal' | 'habit' | 'note' | 'file' | 'journal'

export interface SharedItem {
  id: string
  kind: SharedKind
  title: string
  body?: string
  /** Extra payload (due dates, starts_at, etc.) */
  data: Record<string, unknown>
  ownerId: string
  memberIds: string[]
  createdAt: string
  updatedAt: string
}

export interface StreakSnapshot {
  uid: string
  displayName: string
  updatedAt: string
  waterStreak: number
  sleepStreak: number
  nutritionStreak: number
  workoutStreak: number
  habitStreakBest: number
  waterGlassesToday: number
  sleepHoursLast: number
  /** Only fields allowed by sharePrefs are meaningful to readers */
  visible: Partial<SharePrefs>
}

export type CircleChallengeMetric = 'water' | 'habit' | 'workout' | 'sleep' | 'nutrition'

/** Optional time-boxed streak focus on a Circle */
export interface CircleChallenge {
  title: string
  metric: CircleChallengeMetric
  startsAt: string
  endsAt: string
  startedBy: string
}

/** Named group of friends for Circles leaderboards */
export interface CircleGroup {
  id: string
  name: string
  ownerId: string
  memberIds: string[]
  createdAt: string
  updatedAt: string
  challenge?: CircleChallenge | null
}

/** Shared schedule item inside a circle */
export interface CircleEvent {
  id: string
  circleId: string
  title: string
  notes: string
  startsAt: string
  endsAt: string
  allDay: boolean
  category: string
  color: string
  createdBy: string
  assigneeId: string | null
  createdAt: string
  updatedAt: string
}
