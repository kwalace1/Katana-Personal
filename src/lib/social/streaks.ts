import { doc, getDoc, setDoc } from 'firebase/firestore'
import { getDb } from '@/lib/firebase'
import { habitsApi } from '@/modules/habits/api'
import { healthApi } from '@/modules/health/api'
import { liftApi } from '@/modules/health/lift-api'
import { todayKey, addDays } from '@/lib/dates'
import { getCloudProfile, listFriendProfiles } from './friends'
import type { SharePrefs, StreakSnapshot } from './types'

function consecutiveDays(predicate: (date: string) => boolean, max = 365): number {
  let streak = 0
  let cursor = new Date()
  for (let i = 0; i < max; i++) {
    const key = todayKey(cursor)
    if (!predicate(key)) {
      if (i === 0) {
        cursor = addDays(cursor, -1)
        continue
      }
      break
    }
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

function emptyStreakNumbers(): Pick<
  StreakSnapshot,
  | 'waterStreak'
  | 'sleepStreak'
  | 'nutritionStreak'
  | 'workoutStreak'
  | 'liftStreak'
  | 'habitStreakBest'
  | 'waterGlassesToday'
  | 'sleepHoursLast'
  | 'habitsDoneToday'
  | 'habitsDueToday'
  | 'caloriesToday'
  | 'workoutMinutesToday'
> {
  return {
    waterStreak: 0,
    sleepStreak: 0,
    nutritionStreak: 0,
    workoutStreak: 0,
    liftStreak: 0,
    habitStreakBest: 0,
    waterGlassesToday: 0,
    sleepHoursLast: 0,
    habitsDoneToday: 0,
    habitsDueToday: 0,
    caloriesToday: 0,
    workoutMinutesToday: 0,
  }
}

/** Compute local streaks for the signed-in person's local workspace. */
export function computeLocalStreaks(
  localUserId: string,
): Omit<StreakSnapshot, 'uid' | 'displayName' | 'visible' | 'updatedAt'> {
  const today = todayKey()
  const waterStreak = consecutiveDays((date) => healthApi.getWater(localUserId, date).glasses >= 6)
  const sleepStreak = consecutiveDays((date) => {
    const logs = healthApi.listSleep(localUserId).filter((s) => s.date === date)
    return logs.some((s) => s.hours >= 7)
  })
  const nutritionStreak = consecutiveDays((date) =>
    healthApi.listNutrition(localUserId).some((n) => n.date === date),
  )
  // Move board = cardio / general workouts only (lift-linked rows counted under Lift)
  const workoutStreak = consecutiveDays((date) =>
    healthApi.listWorkouts(localUserId).some((w) => w.date === date && !w.lift_session_id),
  )
  const liftStreak = consecutiveDays((date) =>
    liftApi.listSessions(localUserId).some((s) => s.date === date),
  )
  const habits = habitsApi.list(localUserId)
  const habitsDue = habitsApi.dueToday(localUserId)
  let habitStreakBest = 0
  for (const h of habits) {
    habitStreakBest = Math.max(habitStreakBest, habitsApi.streak(localUserId, h.id))
  }
  const habitsDoneToday = habitsDue.filter((h) => habitsApi.isDoneToday(localUserId, h.id)).length
  const caloriesToday = healthApi
    .listNutrition(localUserId)
    .filter((n) => n.date === today)
    .reduce((s, n) => s + (n.calories || 0), 0)
  const workoutMinutesToday = healthApi
    .listWorkouts(localUserId)
    .filter((w) => w.date === today && !w.lift_session_id)
    .reduce((s, w) => s + (w.duration_minutes || 0), 0)

  return {
    waterStreak,
    sleepStreak,
    nutritionStreak,
    workoutStreak,
    liftStreak,
    habitStreakBest,
    waterGlassesToday: healthApi.getWater(localUserId).glasses,
    sleepHoursLast: healthApi.listSleep(localUserId)[0]?.hours ?? 0,
    habitsDoneToday,
    habitsDueToday: habitsDue.length,
    caloriesToday,
    workoutMinutesToday,
  }
}

export async function publishStreaks(input: {
  cloudUid: string
  localUserId: string
  displayName: string
  sharePrefs: SharePrefs
}): Promise<StreakSnapshot> {
  const local = computeLocalStreaks(input.localUserId)
  const snapshot: StreakSnapshot = {
    uid: input.cloudUid,
    displayName: input.displayName,
    updatedAt: new Date().toISOString(),
    ...local,
    visible: {
      healthWater: input.sharePrefs.healthWater,
      healthSleep: input.sharePrefs.healthSleep,
      healthNutrition: input.sharePrefs.healthNutrition,
      healthWorkouts: input.sharePrefs.healthWorkouts,
      healthLifts: input.sharePrefs.healthLifts,
      habits: input.sharePrefs.habits,
    },
  }
  // Only write numbers friends are allowed to see (others zeroed for privacy)
  const publicSnap: StreakSnapshot = {
    ...snapshot,
    waterStreak: input.sharePrefs.healthWater ? snapshot.waterStreak : 0,
    sleepStreak: input.sharePrefs.healthSleep ? snapshot.sleepStreak : 0,
    nutritionStreak: input.sharePrefs.healthNutrition ? snapshot.nutritionStreak : 0,
    workoutStreak: input.sharePrefs.healthWorkouts ? snapshot.workoutStreak : 0,
    liftStreak: input.sharePrefs.healthLifts ? snapshot.liftStreak : 0,
    habitStreakBest: input.sharePrefs.habits ? snapshot.habitStreakBest : 0,
    waterGlassesToday: input.sharePrefs.healthWater ? snapshot.waterGlassesToday : 0,
    sleepHoursLast: input.sharePrefs.healthSleep ? snapshot.sleepHoursLast : 0,
    habitsDoneToday: input.sharePrefs.habits ? snapshot.habitsDoneToday : 0,
    habitsDueToday: input.sharePrefs.habits ? snapshot.habitsDueToday : 0,
    caloriesToday: input.sharePrefs.healthNutrition ? snapshot.caloriesToday : 0,
    workoutMinutesToday: input.sharePrefs.healthWorkouts ? snapshot.workoutMinutesToday : 0,
  }
  await setDoc(doc(getDb(), 'streaks', input.cloudUid), publicSnap)
  return publicSnap
}

export async function loadCirclesBoard(
  cloudUid: string,
  memberIds?: string[],
): Promise<StreakSnapshot[]> {
  const me = await getCloudProfile(cloudUid)
  const ids =
    memberIds && memberIds.length > 0
      ? Array.from(new Set(memberIds))
      : [cloudUid, ...(await listFriendProfiles(cloudUid)).map((f) => f.uid)]

  const snaps = await Promise.all(
    ids.map(async (uid) => {
      try {
        const docSnap = await getDoc(doc(getDb(), 'streaks', uid))
        if (!docSnap.exists()) {
          const profile = await getCloudProfile(uid)
          if (!profile) return null
          return {
            uid,
            displayName: profile.displayName,
            updatedAt: new Date().toISOString(),
            ...emptyStreakNumbers(),
            visible: profile.sharePrefs,
          } satisfies StreakSnapshot
        }
        const data = docSnap.data() as StreakSnapshot
        return {
          ...emptyStreakNumbers(),
          ...data,
          liftStreak: data.liftStreak ?? 0,
          habitsDoneToday: data.habitsDoneToday ?? 0,
          habitsDueToday: data.habitsDueToday ?? 0,
          caloriesToday: data.caloriesToday ?? 0,
          workoutMinutesToday: data.workoutMinutesToday ?? 0,
        }
      } catch {
        return null
      }
    }),
  )
  const board = snaps.filter(Boolean) as StreakSnapshot[]
  if (me && !board.some((b) => b.uid === cloudUid) && ids.includes(cloudUid)) {
    board.push({
      uid: cloudUid,
      displayName: me.displayName,
      updatedAt: new Date().toISOString(),
      ...emptyStreakNumbers(),
      visible: me.sharePrefs,
    })
  }
  return board
}

export type ActivityFeedItem = {
  id: string
  uid: string
  message: string
  updatedAt: string
}

type ActivityEvent = { id: string; message: string; at: string }

/** Soft activity ping friends can see if activityFeed is on. Keeps a short history per person. */
export async function publishActivity(cloudUid: string, message: string): Promise<void> {
  const ref = doc(getDb(), 'activity', cloudUid)
  const existing = await getDoc(ref)
  const prev = (existing.exists() ? (existing.data().events as ActivityEvent[] | undefined) : undefined) || []
  const at = new Date().toISOString()
  const nextEvent: ActivityEvent = {
    id: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    message,
    at,
  }
  const events = [...prev, nextEvent].slice(-40)
  await setDoc(
    ref,
    {
      uid: cloudUid,
      message,
      updatedAt: at,
      events,
    },
    { merge: true },
  )
}

export async function listFriendActivity(friendUids: string[]): Promise<ActivityFeedItem[]> {
  if (friendUids.length === 0) return []
  // Use per-doc gets — collection queries fail under friend-scoped rules
  // (rules check path id via isFriendOf; a where('uid' in …) query can’t prove that).
  const snaps = await Promise.all(
    friendUids.slice(0, 20).map(async (uid) => {
      try {
        const snap = await getDoc(doc(getDb(), 'activity', uid))
        if (!snap.exists()) return [] as ActivityFeedItem[]
        const data = snap.data() as {
          uid: string
          message: string
          updatedAt: string
          events?: ActivityEvent[]
        }
        if (data.events && data.events.length > 0) {
          return data.events.map((e) => ({
            id: e.id,
            uid,
            message: e.message,
            updatedAt: e.at,
          }))
        }
        if (data.message) {
          return [
            {
              id: `${uid}-latest`,
              uid,
              message: data.message,
              updatedAt: data.updatedAt,
            },
          ]
        }
        return []
      } catch {
        return []
      }
    }),
  )
  return snaps
    .flat()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 60)
}
