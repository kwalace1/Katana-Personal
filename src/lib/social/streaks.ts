import { doc, getDoc, getDocs, setDoc, collection, query, where } from 'firebase/firestore'
import { getDb } from '@/lib/firebase'
import { habitsApi } from '@/modules/habits/api'
import { healthApi } from '@/modules/health/api'
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

/** Compute local streaks for the signed-in person's local workspace. */
export function computeLocalStreaks(localUserId: string): Omit<StreakSnapshot, 'uid' | 'displayName' | 'visible' | 'updatedAt'> {
  const waterStreak = consecutiveDays((date) => healthApi.getWater(localUserId, date).glasses >= 6)
  const sleepStreak = consecutiveDays((date) => {
    const logs = healthApi.listSleep(localUserId).filter((s) => s.date === date)
    return logs.some((s) => s.hours >= 7)
  })
  const nutritionStreak = consecutiveDays((date) =>
    healthApi.listNutrition(localUserId).some((n) => n.date === date),
  )
  const workoutStreak = consecutiveDays((date) =>
    healthApi.listWorkouts(localUserId).some((w) => w.date === date),
  )
  const habits = habitsApi.list(localUserId)
  let habitStreakBest = 0
  for (const h of habits) {
    habitStreakBest = Math.max(habitStreakBest, habitsApi.streak(localUserId, h.id))
  }
  return {
    waterStreak,
    sleepStreak,
    nutritionStreak,
    workoutStreak,
    habitStreakBest,
    waterGlassesToday: healthApi.getWater(localUserId).glasses,
    sleepHoursLast: healthApi.listSleep(localUserId)[0]?.hours ?? 0,
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
    habitStreakBest: input.sharePrefs.habits ? snapshot.habitStreakBest : 0,
    waterGlassesToday: input.sharePrefs.healthWater ? snapshot.waterGlassesToday : 0,
    sleepHoursLast: input.sharePrefs.healthSleep ? snapshot.sleepHoursLast : 0,
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
            waterStreak: 0,
            sleepStreak: 0,
            nutritionStreak: 0,
            workoutStreak: 0,
            habitStreakBest: 0,
            waterGlassesToday: 0,
            sleepHoursLast: 0,
            visible: profile.sharePrefs,
          } satisfies StreakSnapshot
        }
        return docSnap.data() as StreakSnapshot
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
      waterStreak: 0,
      sleepStreak: 0,
      nutritionStreak: 0,
      workoutStreak: 0,
      habitStreakBest: 0,
      waterGlassesToday: 0,
      sleepHoursLast: 0,
      visible: me.sharePrefs,
    })
  }
  return board
}

/** Soft activity ping friends can see if activityFeed is on. */
export async function publishActivity(
  cloudUid: string,
  message: string,
): Promise<void> {
  await setDoc(
    doc(getDb(), 'activity', cloudUid),
    {
      uid: cloudUid,
      message,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  )
}

export async function listFriendActivity(friendUids: string[]) {
  if (friendUids.length === 0) return []
  // Firestore 'in' limited to 10 — batch if needed
  const chunk = friendUids.slice(0, 10)
  const q = query(collection(getDb(), 'activity'), where('uid', 'in', chunk))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as { uid: string; message: string; updatedAt: string })
}
