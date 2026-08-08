/**
 * One-shot Firebase → Supabase migration (Auth + Firestore + Storage).
 *
 * Firebase Auth UIDs are not UUIDs. Supabase auth.users.id must be UUID, so each
 * Firebase UID is mapped to a deterministic UUID v5 (same input → same output).
 * All document UID fields are rewritten with that map.
 *
 * Usage:
 *   cd scripts/migrate-firebase-to-supabase
 *   npm install
 *   cp .env.example .env   # fill credentials
 *   node migrate.mjs
 *
 * Dry-run (no writes):
 *   DRY_RUN=1 node migrate.mjs
 */

import { createHash, randomUUID } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DRY_RUN = String(process.env.DRY_RUN || '') === '1'

// UUID v5 over a fixed Katana namespace (not RFC DNS) so remaps are stable across runs.
const NAMESPACE = 'a7f3c2e1-9b4d-4e8a-8c1f-2d6e5b0a9f33'

function uuidFromFirebaseUid(firebaseUid) {
  // Minimal UUID v5 (SHA-1) implementation
  const ns = Buffer.from(NAMESPACE.replace(/-/g, ''), 'hex')
  const name = Buffer.from(firebaseUid, 'utf8')
  const hash = createHash('sha1').update(ns).update(name).digest()
  hash[6] = (hash[6] & 0x0f) | 0x50
  hash[8] = (hash[8] & 0x3f) | 0x80
  const hex = hash.subarray(0, 16).toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function loadEnvFile() {
  const envPath = resolve(__dirname, '.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const i = trimmed.indexOf('=')
    if (i < 0) continue
    const key = trimmed.slice(0, i).trim()
    let val = trimmed.slice(i + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnvFile()

function requireEnv(key) {
  const v = process.env[key]
  if (!v) throw new Error(`Missing env ${key}`)
  return v
}

function mapUid(uid, uidMap) {
  if (!uid || typeof uid !== 'string') return uid
  if (uidMap.has(uid)) return uidMap.get(uid)
  // Already a UUID (e.g. re-run) — keep
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uid)) {
    return uid
  }
  const next = uuidFromFirebaseUid(uid)
  uidMap.set(uid, next)
  return next
}

function mapUidArray(arr, uidMap) {
  if (!Array.isArray(arr)) return []
  return arr.map((u) => mapUid(u, uidMap))
}

function pairId(a, b) {
  return [a, b].sort().join('_')
}

async function main() {
  const serviceAccountPath = requireEnv('FIREBASE_SERVICE_ACCOUNT_PATH')
  const sa = JSON.parse(readFileSync(resolve(serviceAccountPath), 'utf8'))
  if (!getApps().length) {
    initializeApp({
      credential: cert(sa),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || undefined,
    })
  }

  const supabase = createClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const auth = getAuth()
  const db = getFirestore()
  const uidMap = new Map()

  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== MIGRATE ===')

  // --- Auth users ---
  console.log('Exporting Firebase Auth users…')
  let pageToken
  let userCount = 0
  do {
    const list = await auth.listUsers(1000, pageToken)
    for (const u of list.users) {
      const newId = mapUid(u.uid, uidMap)
      userCount += 1
      if (DRY_RUN) {
        console.log(`  user ${u.email || u.uid} → ${newId}`)
        continue
      }
      const { error } = await supabase.auth.admin.createUser({
        id: newId,
        email: u.email || `${newId}@migrated.invalid`,
        email_confirm: Boolean(u.emailVerified || u.email),
        user_metadata: {
          display_name: u.displayName || undefined,
          firebase_uid: u.uid,
          photo_url: u.photoURL || undefined,
        },
        // Password hashes cannot be ported without Firebase hash params;
        // users with email/password must reset password after cutover unless
        // you import via Supabase Firebase hash importer separately.
      })
      if (error && !/already|exists/i.test(error.message)) {
        console.warn(`  auth create failed for ${u.uid}:`, error.message)
      }
    }
    pageToken = list.pageToken
  } while (pageToken)
  console.log(`Auth users processed: ${userCount}`)

  async function upsert(table, rows) {
    if (!rows.length) return
    if (DRY_RUN) {
      console.log(`  would upsert ${rows.length} → ${table}`)
      return
    }
    const { error } = await supabase.from(table).upsert(rows)
    if (error) throw new Error(`${table}: ${error.message}`)
  }

  // --- profiles ---
  {
    const snap = await db.collection('profiles').get()
    const rows = snap.docs.map((d) => {
      const data = d.data()
      const uid = mapUid(data.uid || d.id, uidMap)
      return {
        uid,
        email: data.email || '',
        display_name: data.displayName || 'Friend',
        friend_code: data.friendCode || uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase(),
        photo_url: data.photoURL ?? null,
        share_prefs: data.sharePrefs || {},
        created_at: data.createdAt || new Date().toISOString(),
        updated_at: data.updatedAt || new Date().toISOString(),
      }
    })
    console.log(`profiles: ${rows.length}`)
    await upsert('profiles', rows)
  }

  // --- friend_codes ---
  {
    const snap = await db.collection('friendCodes').get()
    const rows = snap.docs.map((d) => {
      const data = d.data()
      return {
        code: data.code || d.id,
        uid: mapUid(data.uid, uidMap),
      }
    })
    console.log(`friend_codes: ${rows.length}`)
    await upsert('friend_codes', rows)
  }

  // --- friendships ---
  {
    const snap = await db.collection('friendships').get()
    const rows = snap.docs.map((d) => {
      const data = d.data()
      const a = mapUid(data.a, uidMap)
      const b = mapUid(data.b, uidMap)
      return {
        id: pairId(a, b),
        a: [a, b].sort()[0],
        b: [a, b].sort()[1],
        status: data.status,
        requested_by: mapUid(data.requestedBy, uidMap),
        created_at: data.createdAt || new Date().toISOString(),
        updated_at: data.updatedAt || new Date().toISOString(),
      }
    })
    console.log(`friendships: ${rows.length}`)
    await upsert('friendships', rows)
  }

  // --- blocks ---
  {
    const snap = await db.collection('blocks').get()
    const rows = snap.docs.map((d) => {
      const data = d.data()
      const blocker = mapUid(data.blocker, uidMap)
      const blocked = mapUid(data.blocked, uidMap)
      return {
        id: `${blocker}_${blocked}`,
        blocker,
        blocked,
        created_at: data.createdAt || new Date().toISOString(),
      }
    })
    console.log(`blocks: ${rows.length}`)
    await upsert('blocks', rows)
  }

  // --- shared_items ---
  {
    const snap = await db.collection('sharedItems').get()
    const rows = snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        kind: data.kind,
        title: data.title,
        body: data.body || '',
        data: data.data || {},
        owner_id: mapUid(data.ownerId, uidMap),
        member_ids: mapUidArray(data.memberIds, uidMap),
        created_at: data.createdAt || new Date().toISOString(),
        updated_at: data.updatedAt || new Date().toISOString(),
      }
    })
    console.log(`shared_items: ${rows.length}`)
    await upsert('shared_items', rows)
  }

  // --- activity ---
  {
    const snap = await db.collection('activity').get()
    const rows = snap.docs.map((d) => {
      const data = d.data()
      return {
        uid: mapUid(data.uid || d.id, uidMap),
        message: data.message || '',
        updated_at: data.updatedAt || new Date().toISOString(),
        events: data.events || [],
      }
    })
    console.log(`activity: ${rows.length}`)
    await upsert('activity', rows)
  }

  // --- streaks ---
  {
    const snap = await db.collection('streaks').get()
    const rows = snap.docs.map((d) => {
      const data = d.data()
      return {
        uid: mapUid(data.uid || d.id, uidMap),
        display_name: data.displayName || 'Friend',
        updated_at: data.updatedAt || new Date().toISOString(),
        water_streak: data.waterStreak || 0,
        sleep_streak: data.sleepStreak || 0,
        nutrition_streak: data.nutritionStreak || 0,
        workout_streak: data.workoutStreak || 0,
        lift_streak: data.liftStreak || 0,
        habit_streak_best: data.habitStreakBest || 0,
        water_glasses_today: data.waterGlassesToday || 0,
        sleep_hours_last: data.sleepHoursLast || 0,
        habits_done_today: data.habitsDoneToday || 0,
        habits_due_today: data.habitsDueToday || 0,
        calories_today: data.caloriesToday || 0,
        workout_minutes_today: data.workoutMinutesToday || 0,
        visible: data.visible || {},
      }
    })
    console.log(`streaks: ${rows.length}`)
    await upsert('streaks', rows)
  }

  // --- circles ---
  {
    const snap = await db.collection('circles').get()
    const rows = snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        name: data.name,
        owner_id: mapUid(data.ownerId, uidMap),
        member_ids: mapUidArray(data.memberIds, uidMap),
        moderator_ids: mapUidArray(data.moderatorIds || [], uidMap),
        challenge: data.challenge
          ? {
              ...data.challenge,
              startedBy: mapUid(data.challenge.startedBy, uidMap),
            }
          : null,
        created_at: data.createdAt || new Date().toISOString(),
        updated_at: data.updatedAt || new Date().toISOString(),
      }
    })
    console.log(`circles: ${rows.length}`)
    await upsert('circles', rows)
  }

  // --- circle_events ---
  {
    const snap = await db.collection('circleEvents').get()
    const rows = snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        circle_id: data.circleId,
        title: data.title,
        notes: data.notes || '',
        starts_at: data.startsAt,
        ends_at: data.endsAt,
        all_day: Boolean(data.allDay),
        category: data.category || 'errand',
        color: data.color || '',
        created_by: mapUid(data.createdBy, uidMap),
        assignee_id: data.assigneeId ? mapUid(data.assigneeId, uidMap) : null,
        created_at: data.createdAt || new Date().toISOString(),
        updated_at: data.updatedAt || new Date().toISOString(),
      }
    })
    console.log(`circle_events: ${rows.length}`)
    await upsert('circle_events', rows)
  }

  // --- circle_posts ---
  {
    const snap = await db.collection('circlePosts').get()
    const rows = snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        circle_id: data.circleId,
        author_id: mapUid(data.authorId, uidMap),
        message: data.message,
        created_at: data.createdAt || new Date().toISOString(),
      }
    })
    console.log(`circle_posts: ${rows.length}`)
    await upsert('circle_posts', rows)
  }

  // --- together_posts ---
  {
    const snap = await db.collection('togetherPosts').get()
    const rows = []
    for (const d of snap.docs) {
      const data = d.data()
      const authorId = mapUid(data.authorId, uidMap)
      const media = (data.media || []).map((m) => {
        let path = m.path || ''
        // Firebase: together/{uid}/{postId}/file → bucket-relative {newUid}/{postId}/file
        const parts = path.replace(/^together\//, '').split('/')
        if (parts.length >= 3) {
          parts[0] = mapUid(parts[0], uidMap)
          path = parts.join('/')
        }
        return { ...m, path, url: undefined }
      })
      rows.push({
        id: d.id,
        author_id: authorId,
        created_at: data.createdAt || new Date().toISOString(),
        text: data.text || '',
        audience: data.audience,
        circle_id: data.circleId || null,
        viewer_ids: mapUidArray(data.viewerIds, uidMap),
        media,
        card: data.card || null,
      })
    }
    console.log(`together_posts: ${rows.length}`)
    await upsert('together_posts', rows)
  }

  // --- circle_invites ---
  {
    const snap = await db.collection('circleInvites').get()
    const rows = snap.docs.map((d) => {
      const data = d.data()
      const invitee = data.inviteeUid ? mapUid(data.inviteeUid, uidMap) : null
      let token = data.token || d.id
      if (token.startsWith('direct_') && invitee) {
        const circleId = data.circleId
        token = `direct_${circleId}_${invitee}`
      }
      return {
        token,
        circle_id: data.circleId,
        circle_name: data.circleName,
        created_by: mapUid(data.createdBy, uidMap),
        created_at: data.createdAt || new Date().toISOString(),
        expires_at: data.expiresAt,
        used_by: mapUidArray(data.usedBy || [], uidMap),
        invitee_uid: invitee,
        status: data.status || null,
        responded_at: data.respondedAt || null,
      }
    })
    console.log(`circle_invites: ${rows.length}`)
    await upsert('circle_invites', rows)
  }

  // --- notifications ---
  {
    const snap = await db.collection('notifications').get()
    const rows = snap.docs.map((d) => {
      const data = d.data()
      const meta = { ...(data.meta || {}) }
      if (meta.fromUid) meta.fromUid = mapUid(meta.fromUid, uidMap)
      return {
        id: d.id,
        uid: mapUid(data.uid, uidMap),
        kind: data.kind,
        title: data.title,
        body: data.body,
        href: data.href || '',
        read: Boolean(data.read),
        created_at: data.createdAt || new Date().toISOString(),
        meta,
      }
    })
    console.log(`notifications: ${rows.length}`)
    await upsert('notifications', rows)
  }

  // --- push_tokens ---
  {
    const snap = await db.collection('pushTokens').get()
    const rows = snap.docs.map((d) => {
      const data = d.data()
      return {
        uid: mapUid(data.uid || d.id, uidMap),
        token: data.token || `migrated:${randomUUID()}`,
        platform: data.platform || 'web',
        updated_at: data.updatedAt || new Date().toISOString(),
      }
    })
    console.log(`push_tokens: ${rows.length}`)
    await upsert('push_tokens', rows)
  }

  // --- workspaces ---
  // Parent workspace docs are often missing (only subcollections exist), so
  // discover owners via collectionGroup instead of workspaces.get().
  {
    const cg = await db.collectionGroup('collections').select().get()
    const ownerIds = new Set()
    for (const d of cg.docs) {
      const parts = d.ref.path.split('/')
      if (parts[0] === 'workspaces' && parts[2] === 'collections') {
        ownerIds.add(parts[1])
      }
    }
    const collectionRows = []
    const metaRows = []
    for (const fbUid of ownerIds) {
      const userId = mapUid(fbUid, uidMap)
      const wsRef = db.collection('workspaces').doc(fbUid)
      let hasAny = false
      const cols = await wsRef.collection('collections').get()
      for (const c of cols.docs) {
        const data = c.data()
        const items = data.items || []
        if (items.length) hasAny = true
        collectionRows.push({
          user_id: userId,
          collection: c.id,
          items,
          updated_at: data.updatedAt || new Date().toISOString(),
        })
      }
      const metaSnap = await wsRef.collection('meta').doc('info').get()
      if (metaSnap.exists) {
        const m = metaSnap.data()
        metaRows.push({
          user_id: userId,
          updated_at: m.updatedAt || new Date().toISOString(),
          has_data: Boolean(m.hasData) || hasAny,
          local_user_id: m.localUserId || null,
        })
      } else {
        metaRows.push({
          user_id: userId,
          updated_at: new Date().toISOString(),
          has_data: hasAny,
          local_user_id: null,
        })
      }
    }
    console.log(`workspace owners: ${ownerIds.size}`)
    console.log(`workspace_collections: ${collectionRows.length}`)
    await upsert('workspace_collections', collectionRows)
    console.log(`workspace_meta: ${metaRows.length}`)
    await upsert('workspace_meta', metaRows)
  }

  // --- Storage copy (optional) ---
  if (process.env.FIREBASE_STORAGE_BUCKET && !DRY_RUN) {
    console.log('Copying Storage together/…')
    try {
      const bucket = getStorage().bucket()
      const [files] = await bucket.getFiles({ prefix: 'together/' })
      let copied = 0
      for (const file of files) {
        const [buf] = await file.download()
        // together/{oldUid}/{postId}/file → {newUid}/{postId}/file
        const parts = file.name.replace(/^together\//, '').split('/')
        if (parts.length < 3) continue
        parts[0] = mapUid(parts[0], uidMap)
        const dest = parts.join('/')
        const { error } = await supabase.storage.from('together').upload(dest, buf, {
          contentType: file.metadata.contentType || 'application/octet-stream',
          upsert: true,
        })
        if (error) console.warn(`  storage ${file.name}:`, error.message)
        else copied += 1
      }
      console.log(`Storage files copied: ${copied}`)
    } catch (err) {
      console.warn('Storage copy skipped:', err instanceof Error ? err.message : err)
    }
  } else if (DRY_RUN) {
    console.log('Storage copy skipped (dry run or no FIREBASE_STORAGE_BUCKET)')
  }

  console.log('UID map size:', uidMap.size)
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
