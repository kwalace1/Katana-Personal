import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Droplets, Dumbbell, MessageSquare, Minus, Plus, Send, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FeedMediaAttach } from '@/components/FeedMediaAttach'
import { useAuth } from '@/contexts/AuthContext'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { useLocalRefresh } from '@/hooks/useLocalRefresh'
import { healthApi, WATER_GOAL_GLASSES } from '@/modules/health/api'
import { liftApi } from '@/modules/health/lift-api'
import { todayKey } from '@/lib/dates'
import {
  createCirclePost,
  deleteCirclePost,
  subscribeCirclePosts,
  type CirclePost,
} from '@/lib/social/circle-posts'
import { createTogetherPost } from '@/lib/social/feed'
import type { CloudProfile, SharePrefs, StreakSnapshot } from '@/lib/social/types'
import { relativeWhen } from './relative-when'
import { cn } from '@/lib/utils'
import {
  MentionTextarea,
  type MentionCandidate,
} from '@/modules/social/components/MentionTextarea'

type TimelineItem =
  | { kind: 'post'; id: string; uid: string; message: string; at: string; postId: string }
  | { kind: 'activity'; id: string; uid: string; message: string; at: string }

function Avatar({ name, you }: { name: string; you?: boolean }) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const initials =
    parts.length === 0
      ? '?'
      : parts.length === 1
        ? parts[0].slice(0, 2).toUpperCase()
        : `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
  return (
    <div
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-semibold',
        you ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground',
      )}
    >
      {initials}
    </div>
  )
}

export function CircleBoardExtras({
  circleId,
  selfUid,
  selfName,
  friends,
  board,
  metric,
  activity,
  onAfterCheckIn,
}: {
  circleId: string
  selfUid: string
  selfName?: string
  friends: CloudProfile[]
  board: StreakSnapshot[]
  metric: string
  activity: { id: string; uid: string; message: string; updatedAt: string }[]
  onAfterCheckIn: () => void
}) {
  const { user } = useAuth()
  const { cloudProfile, saveSharePrefs, syncStreaksToCloud } = useCloudAuth()
  const { tick, refresh } = useLocalRefresh()
  const [posts, setPosts] = useState<CirclePost[]>([])
  const [draft, setDraft] = useState('')
  const [mentions, setMentions] = useState<MentionCandidate[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [posting, setPosting] = useState(false)

  const water = useMemo(() => {
    void tick
    return user ? healthApi.getWater(user.id) : { glasses: 0 }
  }, [user, tick])

  const liftedToday = useMemo(() => {
    void tick
    if (!user) return false
    return liftApi.listSessions(user.id).some((s) => s.date === todayKey())
  }, [user, tick])

  useEffect(() => {
    const unsub = subscribeCirclePosts(
      circleId,
      setPosts,
      (err) => toast.error(err.message || 'Couldn’t load posts'),
    )
    return () => unsub()
  }, [circleId])

  const prefs = cloudProfile?.sharePrefs
  const needsWaterShare = metric === 'water' && prefs && !prefs.healthWater
  const needsHabitsShare = metric === 'habit' && prefs && !prefs.habits
  const needsLiftShare = metric === 'lift' && prefs && !prefs.healthLifts
  const needsActivityShare = prefs && !prefs.activityFeed

  async function enablePref(key: keyof SharePrefs) {
    if (!prefs) return
    try {
      await saveSharePrefs({ ...prefs, [key]: true })
      await syncStreaksToCloud()
      toast.success('Sharing turned on — Sync to refresh the board')
      onAfterCheckIn()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t update sharing')
    }
  }

  function nameFor(uid: string) {
    if (uid === selfUid) return selfName || 'You'
    return (
      friends.find((f) => f.uid === uid)?.displayName ||
      board.find((b) => b.uid === uid)?.displayName ||
      'Member'
    )
  }

  const timeline = useMemo(() => {
    const items: TimelineItem[] = [
      ...posts.map((p) => ({
        kind: 'post' as const,
        id: `post-${p.id}`,
        uid: p.authorId,
        message: p.message,
        at: p.createdAt,
        postId: p.id,
      })),
      ...activity.map((a) => ({
        kind: 'activity' as const,
        id: `act-${a.id}`,
        uid: a.uid,
        message: a.message,
        at: a.updatedAt,
      })),
    ]
    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 36)
  }, [posts, activity])

  async function onPost(e: FormEvent) {
    e.preventDefault()
    if ((!draft.trim() && files.length === 0) || posting) return
    setPosting(true)
    try {
      const message = draft.trim()
      // Dual-write: circle timeline + Together Feed (circle audience)
      await createTogetherPost({
        authorId: selfUid,
        text: message,
        audience: 'circle',
        circleId,
        mentions,
        files,
      })
      try {
        await createCirclePost({
          circleId,
          authorId: selfUid,
          message,
        })
      } catch {
        // Feed post succeeded; legacy circlePosts optional during migration
      }
      setDraft('')
      setMentions([])
      setFiles([])
      toast.success('Posted to the circle')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t post')
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="space-y-6">
      {needsWaterShare || needsHabitsShare || needsLiftShare || needsActivityShare ? (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm">
          <p className="font-medium">Sharing is off for some Circles features</p>
          <p className="mt-0.5 text-muted-foreground">
            Turn these on so friends can see your board and check-in pings.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {needsWaterShare ? (
              <Button size="sm" onClick={() => void enablePref('healthWater')}>
                Share hydration
              </Button>
            ) : null}
            {needsHabitsShare ? (
              <Button size="sm" onClick={() => void enablePref('habits')}>
                Share habits
              </Button>
            ) : null}
            {needsLiftShare ? (
              <Button size="sm" onClick={() => void enablePref('healthLifts')}>
                Share lifts
              </Button>
            ) : null}
            {needsActivityShare ? (
              <Button size="sm" variant="outline" onClick={() => void enablePref('activityFeed')}>
                Share activity pings
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" asChild>
              <Link to="/settings">Settings</Link>
            </Button>
          </div>
        </div>
      ) : null}

      {metric === 'water' && user ? (
        <section className="kp-surface p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="kp-section-label flex items-center gap-1.5">
                <Droplets className="h-3.5 w-3.5" />
                Your water today
              </p>
              <p className="mt-1 font-display text-3xl tracking-tight">
                {water.glasses}
                <span className="ml-1 text-base font-sans text-muted-foreground">
                  / {WATER_GOAL_GLASSES}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Log glasses here — they sync to the Hydration board when sharing is on.
              </p>
            </div>
            <Button
              className="gap-1.5"
              onClick={() => {
                healthApi.addGlass(user.id)
                refresh()
                window.setTimeout(() => onAfterCheckIn(), 900)
              }}
            >
              <Plus className="h-4 w-4" />
              Log a glass
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Array.from({ length: Math.max(WATER_GOAL_GLASSES, water.glasses) }, (_, i) => (
              <span
                key={i}
                className={cn(
                  'h-3 w-3 rounded-full',
                  i < water.glasses ? 'bg-sky-500' : 'bg-secondary',
                )}
              />
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                healthApi.setWater(user.id, Math.max(0, water.glasses - 1))
                refresh()
                window.setTimeout(() => onAfterCheckIn(), 900)
              }}
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                healthApi.addGlass(user.id)
                refresh()
                window.setTimeout(() => onAfterCheckIn(), 900)
              }}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </section>
      ) : null}

      {metric === 'lift' && user ? (
        <section className="kp-surface p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="kp-section-label flex items-center gap-1.5">
                <Dumbbell className="h-3.5 w-3.5" />
                Your lifts today
              </p>
              <p className="mt-1 font-display text-2xl tracking-tight">
                {liftedToday ? 'Logged' : 'Not yet'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Log a session in Health — it counts toward the Lift board when sharing is on.
              </p>
            </div>
            <Button className="gap-1.5" asChild>
              <Link to="/health">
                <Dumbbell className="h-4 w-4" />
                Open Health
              </Link>
            </Button>
          </div>
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="kp-section-label flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            Circle chat
          </p>
          <Link
            to={`/social?circle=${encodeURIComponent(circleId)}`}
            className="text-xs font-medium text-primary hover:underline"
          >
            Open Social
          </Link>
        </div>
        <form onSubmit={(e) => void onPost(e)} className="mb-4 space-y-2">
          <div className="flex gap-2">
          <MentionTextarea
            placeholder="Say something… type @ to mention someone"
            value={draft}
            onChange={setDraft}
            candidates={[
              ...new Map(
                [
                  ...friends.map((friend) => ({ uid: friend.uid, name: friend.displayName })),
                  ...board
                    .filter((member) => member.uid !== selfUid)
                    .map((member) => ({ uid: member.uid, name: member.displayName })),
                ].map((candidate) => [candidate.uid, candidate]),
              ).values(),
            ]}
            mentions={mentions}
            onMentionsChange={setMentions}
            maxLength={500}
            rows={2}
            className="min-h-11 resize-none"
          />
          <Button type="submit" size="icon" disabled={(!draft.trim() && files.length === 0) || posting} aria-label="Post">
            <Send className="h-4 w-4" />
          </Button>
          </div>
          <FeedMediaAttach files={files} onChange={setFiles} disabled={posting} />
        </form>
        <p className="mb-4 text-xs text-muted-foreground">
          Posts also appear on Social. Add photos here or on the feed.
        </p>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <p className="kp-section-label">Activity timeline</p>
          <span className="text-xs text-muted-foreground">Posts + check-ins</span>
        </div>
        {timeline.length === 0 ? (
          <div className="kp-surface p-5 text-sm text-muted-foreground">
            Nothing yet. Post a message, or log water, a meal, a workout, sleep, or a habit — check-ins
            show up here when Activity pings are on in Settings.
          </div>
        ) : (
          <ul className="relative ml-3 space-y-0 border-l border-border/60">
            {timeline.map((item) => {
              const name = item.uid === selfUid ? 'You' : nameFor(item.uid)
              return (
                <li key={item.id} className="relative pb-5 pl-6 last:pb-0">
                  <span
                    className={cn(
                      'absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-background',
                      item.kind === 'post' ? 'bg-primary' : 'bg-sky-500',
                    )}
                  />
                  <div className="kp-surface p-3.5">
                    <div className="flex items-start gap-3">
                      <Avatar name={name} you={item.uid === selfUid} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          <span className="font-semibold">{name}</span>
                          {item.kind === 'post' ? (
                            <span className="text-muted-foreground"> posted</span>
                          ) : (
                            <span className="text-muted-foreground"> — {item.message}</span>
                          )}
                        </p>
                        {item.kind === 'post' ? (
                          <p className="mt-1 text-sm leading-relaxed">{item.message}</p>
                        ) : null}
                        <p className="mt-0.5 text-[0.7rem] text-muted-foreground">
                          {relativeWhen(item.at)}
                          {item.kind === 'activity' ? ' · check-in' : ''}
                        </p>
                      </div>
                      {item.kind === 'post' && item.uid === selfUid ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0"
                          onClick={() => {
                            void deleteCirclePost(item.postId).catch((err) =>
                              toast.error(err instanceof Error ? err.message : 'Couldn’t delete'),
                            )
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
