import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Flame,
  Droplets,
  Moon,
  Salad,
  Dumbbell,
  Footprints,
  RefreshCw,
  Plus,
  Settings2,
  Trash2,
  LogOut,
  Link2,
  ChevronLeft,
  Trophy,
  Users,
  Zap,
  Crown,
  Medal,
  CalendarDays,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { TogetherSetup } from '@/components/TogetherSetup'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { pageEnterSubtle, springSoft } from '@/lib/motion-ui'
import { loadCirclesBoard, listFriendActivity, type ActivityFeedItem } from '@/lib/social/streaks'
import {
  createCircle,
  deleteCircle,
  leaveCircle,
  listMyCircles,
  renameCircle,
  setCircleMembers,
  setCircleChallenge,
} from '@/lib/social/circles'
import { createCircleInvite, inviteFriendToCircle, listOutgoingPendingForCircle } from '@/lib/social/invites'
import { listFriendProfiles } from '@/lib/social/friends'
import type { CircleChallengeMetric, CircleGroup, CloudProfile, StreakSnapshot } from '@/lib/social/types'
import { cn } from '@/lib/utils'
import { addDays } from '@/lib/dates'
import { CircleSchedule } from '../components/CircleSchedule'
import { CircleBoardExtras } from '../components/CircleBoardExtras'

type BoardMetric = 'water' | 'sleep' | 'nutrition' | 'workout' | 'lift' | 'habit'

const METRICS: {
  id: BoardMetric
  label: string
  short: string
  icon: typeof Flame
  score: (s: StreakSnapshot) => number
  accent: string
}[] = [
  {
    id: 'water',
    label: 'Hydration',
    short: 'Water',
    icon: Droplets,
    score: (s) => s.waterStreak,
    accent: 'from-sky-500/20 to-transparent',
  },
  {
    id: 'habit',
    label: 'Habits',
    short: 'Habits',
    icon: Flame,
    score: (s) => s.habitStreakBest,
    accent: 'from-orange-500/20 to-transparent',
  },
  {
    id: 'lift',
    label: 'Lifts',
    short: 'Lift',
    icon: Dumbbell,
    score: (s) => s.liftStreak ?? 0,
    accent: 'from-rose-500/20 to-transparent',
  },
  {
    id: 'workout',
    label: 'Workouts',
    short: 'Move',
    icon: Footprints,
    score: (s) => s.workoutStreak,
    accent: 'from-emerald-500/20 to-transparent',
  },
  {
    id: 'sleep',
    label: 'Sleep',
    short: 'Sleep',
    icon: Moon,
    score: (s) => s.sleepStreak,
    accent: 'from-indigo-500/15 to-transparent',
  },
  {
    id: 'nutrition',
    label: 'Nutrition',
    short: 'Fuel',
    icon: Salad,
    score: (s) => s.nutritionStreak,
    accent: 'from-lime-500/20 to-transparent',
  },
]

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

function Avatar({ name, you, size = 'md' }: { name: string; you?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const dims = size === 'lg' ? 'h-16 w-16 text-lg' : size === 'sm' ? 'h-8 w-8 text-[0.65rem]' : 'h-11 w-11 text-sm'
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight',
        dims,
        you
          ? 'bg-primary text-primary-foreground shadow-[0_0_0_3px_hsl(var(--primary)/0.25)]'
          : 'bg-secondary text-foreground',
      )}
    >
      {initials(name)}
    </div>
  )
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-400/90 text-amber-950 shadow-sm">
        <Crown className="h-4 w-4" />
      </span>
    )
  }
  if (rank === 2) {
    return (
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-300/90 text-slate-800">
        <Medal className="h-4 w-4" />
      </span>
    )
  }
  if (rank === 3) {
    return (
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-300/80 text-orange-950">
        <Medal className="h-4 w-4" />
      </span>
    )
  }
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold tabular-nums">
      {rank}
    </span>
  )
}

export default function CirclesPage() {
  const { cloudEnabled, cloudUser, cloudProfile, syncStreaksToCloud } = useCloudAuth()
  const [params, setParams] = useSearchParams()
  const [metric, setMetric] = useState<BoardMetric>('habit')
  const [circles, setCircles] = useState<CircleGroup[]>([])
  const [board, setBoard] = useState<StreakSnapshot[]>([])
  const [friends, setFriends] = useState<CloudProfile[]>([])
  const [activity, setActivity] = useState<ActivityFeedItem[]>([])
  const [busy, setBusy] = useState(false)
  const [newName, setNewName] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [pendingInvites, setPendingInvites] = useState<{ token: string; inviteeUid: string }[]>([])
  const [inviteBusy, setInviteBusy] = useState<string | null>(null)
  const [challengeOpen, setChallengeOpen] = useState(false)
  const [challengeTitle, setChallengeTitle] = useState('7-day streak')
  const [challengeMetric, setChallengeMetric] = useState<CircleChallengeMetric>('habit')

  const activeId = params.get('id')
  const detailTab = (params.get('tab') === 'schedule' ? 'schedule' : 'board') as 'board' | 'schedule'
  const active = circles.find((c) => c.id === activeId) ?? null
  const entered = Boolean(active)

  const activeChallenge =
    active?.challenge && new Date(active.challenge.endsAt).getTime() > Date.now()
      ? active.challenge
      : null

  useEffect(() => {
    if (activeChallenge?.metric) {
      setMetric(activeChallenge.metric)
    }
  }, [activeChallenge?.metric, activeId])

  async function loadCirclesList() {
    if (!cloudUser) return
    const list = await listMyCircles(cloudUser.uid)
    setCircles(list)
    return list
  }

  async function reloadBoard(circle?: CircleGroup | null) {
    if (!cloudUser) return
    setBusy(true)
    try {
      try {
        await syncStreaksToCloud()
      } catch {
        // optional
      }
      const target = circle ?? active
      const rows = await loadCirclesBoard(
        cloudUser.uid,
        target?.memberIds ?? [cloudUser.uid],
      )
      setBoard(rows)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t load circle')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!cloudUser) return
    let cancelled = false
    void (async () => {
      try {
        const [list, friendList] = await Promise.all([
          listMyCircles(cloudUser.uid),
          listFriendProfiles(cloudUser.uid),
        ])
        if (cancelled) return
        setCircles(list)
        setFriends(friendList)

        const id = params.get('id')
        const circle = (id && list.find((c) => c.id === id)) || null

        try {
          await syncStreaksToCloud()
        } catch {
          // optional
        }

        if (circle) {
          try {
            const rows = await loadCirclesBoard(cloudUser.uid, circle.memberIds)
            if (!cancelled) setBoard(rows)
          } catch (err) {
            if (!cancelled) {
              toast.error(err instanceof Error ? err.message : 'Couldn’t load the leaderboard')
            }
          }
        }

        try {
          const feed = await listFriendActivity([
            cloudUser.uid,
            ...friendList.map((f) => f.uid),
          ])
          if (!cancelled) {
            setActivity(feed.slice(0, 40))
          }
        } catch {
          // optional
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : 'Couldn’t load circles')
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudUser?.uid])

  useEffect(() => {
    if (!cloudUser || !activeId) {
      setBoard([])
      return
    }
    const circle = circles.find((c) => c.id === activeId)
    if (!circle) return
    void reloadBoard(circle)
    void (async () => {
      try {
        const feed = await listFriendActivity(circle.memberIds)
        setActivity((prev) => {
          const byId = new Map(prev.map((a) => [a.id, a]))
          for (const a of feed) byId.set(a.id, a)
          return [...byId.values()]
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .slice(0, 40)
        })
      } catch {
        // optional
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  const metricDef = METRICS.find((m) => m.id === metric)!

  const ranked = useMemo(() => {
    return [...board]
      .map((row) => ({ row, score: metricDef.score(row) }))
      .sort((a, b) => b.score - a.score)
  }, [board, metricDef])

  const maxScore = Math.max(1, ...ranked.map((r) => r.score))
  const yourRank = ranked.findIndex((r) => r.row.uid === cloudUser?.uid) + 1
  const yourScore = ranked.find((r) => r.row.uid === cloudUser?.uid)?.score ?? 0

  const circleActivity = useMemo(() => {
    if (!active) return []
    const members = new Set(active.memberIds)
    return activity.filter((a) => members.has(a.uid)).slice(0, 24)
  }, [activity, active])

  function enterCircle(id: string, tab: 'board' | 'schedule' = 'board') {
    setParams(tab === 'schedule' ? { id, tab: 'schedule' } : { id })
  }

  function setDetailTab(tab: 'board' | 'schedule') {
    if (!activeId) return
    setParams(tab === 'schedule' ? { id: activeId, tab: 'schedule' } : { id: activeId })
  }

  function exitCircle() {
    setParams({})
    setBoard([])
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!cloudUser || !newName.trim()) return
    try {
      const circle = await createCircle({
        name: newName,
        ownerId: cloudUser.uid,
        memberIds: [],
      })
      setNewName('')
      setCreateOpen(false)
      toast.success('Circle created — invite friends from Manage')
      await loadCirclesList()
      enterCircle(circle.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t create circle')
    }
  }

  async function openManage() {
    if (!active || !cloudUser) return
    setEditName(active.name)
    try {
      const pending = await listOutgoingPendingForCircle(active.id, cloudUser.uid)
      setPendingInvites(
        pending
          .filter((p) => p.inviteeUid)
          .map((p) => ({ token: p.token, inviteeUid: p.inviteeUid as string })),
      )
    } catch {
      setPendingInvites([])
    }
    setManageOpen(true)
  }

  async function saveManage(e: FormEvent) {
    e.preventDefault()
    if (!active || !cloudUser) return
    try {
      await renameCircle(active.id, editName)
      toast.success('Circle updated')
      setManageOpen(false)
      await loadCirclesList()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t update')
    }
  }

  async function inviteFriend(friendUid: string) {
    if (!active || !cloudUser) return
    setInviteBusy(friendUid)
    try {
      await inviteFriendToCircle({
        circle: active,
        createdBy: cloudUser.uid,
        inviteeUid: friendUid,
      })
      toast.success('Invite sent — they’ll see it in Friends')
      try {
        const pending = await listOutgoingPendingForCircle(active.id, cloudUser.uid)
        setPendingInvites(
          pending
            .filter((p) => p.inviteeUid)
            .map((p) => ({ token: p.token, inviteeUid: p.inviteeUid as string })),
        )
      } catch {
        setPendingInvites((prev) =>
          prev.some((p) => p.inviteeUid === friendUid)
            ? prev
            : [...prev, { token: `direct_${active.id}_${friendUid}`, inviteeUid: friendUid }],
        )
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t invite')
    } finally {
      setInviteBusy(null)
    }
  }

  async function removeMember(uid: string) {
    if (!active || !cloudUser) return
    if (uid === active.ownerId) {
      toast.error('Can’t remove the circle owner')
      return
    }
    try {
      await setCircleMembers(
        active.id,
        active.memberIds.filter((id) => id !== uid),
      )
      toast.message('Removed from circle')
      await loadCirclesList()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t remove')
    }
  }

  if (!cloudEnabled || !cloudUser) {
    return (
      <motion.div {...pageEnterSubtle} className="kp-page">
        <PageHeader title="Circles" description="Streak boards with people you trust." eyebrow="Together" />
        <TogetherSetup highlight="circles" />
      </motion.div>
    )
  }

  /* ——— DETAIL VIEW ——— */
  if (entered && active) {
    const podium = ranked.slice(0, 3)

    return (
      <motion.div {...pageEnterSubtle} className="kp-page">
        <button
          type="button"
          onClick={exitCircle}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          All circles
        </button>

        <section className="relative mb-6 overflow-hidden kp-surface p-6 sm:p-8">
          <div
            className={cn(
              'pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90',
              metricDef.accent,
            )}
          />
          <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="kp-section-label flex items-center gap-1.5">
                  <Trophy className="h-3.5 w-3.5" />
                  Circle
                </p>
                <h1 className="font-display mt-2 text-3xl tracking-tight sm:text-4xl">{active.name}</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {active.memberIds.length} member{active.memberIds.length === 1 ? '' : 's'}
                  {detailTab === 'board' && yourRank > 0
                    ? ` · You’re #${yourRank} in ${metricDef.short.toLowerCase()}`
                    : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {detailTab === 'board' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={busy}
                    onClick={() => void reloadBoard(active)}
                  >
                    <RefreshCw className={cn('h-3.5 w-3.5', busy && 'animate-spin')} />
                    Sync
                  </Button>
                ) : null}
                <Button size="sm" variant="outline" className="gap-1.5" onClick={openManage}>
                  <Settings2 className="h-3.5 w-3.5" />
                  Manage
                </Button>
              </div>
            </div>

            {detailTab === 'board' && yourRank > 0 ? (
              <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-background/70 px-4 py-3 backdrop-blur-sm">
                <Zap className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">
                  {yourScore === 0
                    ? 'Start a streak to climb the board'
                    : yourRank === 1
                      ? `Leading with a ${yourScore}-day ${metricDef.short.toLowerCase()} streak`
                      : `${yourScore}-day streak · ${ranked[0].score - yourScore} day${ranked[0].score - yourScore === 1 ? '' : 's'} behind #1`}
                </p>
              </div>
            ) : null}
          </div>
        </section>

        {active.memberIds.length <= 1 ? (
          <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
            <p className="font-medium">Only you are in this circle</p>
            <p className="mt-0.5 text-muted-foreground">
              Friends won’t see it until you add them in Manage — or share an invite link below.
            </p>
            <Button size="sm" className="mt-2" onClick={openManage}>
              Add friends
            </Button>
          </div>
        ) : null}

        {activeChallenge ? (
          <div className="mb-6 overflow-hidden rounded-2xl border border-primary/25 bg-primary/5 px-4 py-4 sm:px-5">
            <p className="kp-section-label">Active challenge</p>
            <p className="mt-1 font-display text-xl tracking-tight">{activeChallenge.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {METRICS.find((m) => m.id === activeChallenge.metric)?.label ?? 'Streak'} · ends{' '}
              {new Date(activeChallenge.endsAt).toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setMetric(activeChallenge.metric)}
              >
                Show board
              </Button>
              {active.ownerId === cloudUser.uid ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    try {
                      await setCircleChallenge(active.id, null)
                      toast.message('Challenge cleared')
                      await loadCirclesList()
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Couldn’t clear')
                    }
                  }}
                >
                  End early
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-secondary/50 px-4 py-3.5">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Start a 7-day challenge</p>
              <p className="text-xs text-muted-foreground">
                Pick a metric. Climb together. Ends automatically.
              </p>
            </div>
            <Button size="sm" onClick={() => setChallengeOpen(true)}>
              Start
            </Button>
          </div>
        )}

        <div className="mb-6 flex gap-2">
          <Button
            size="sm"
            variant={detailTab === 'board' ? 'default' : 'outline'}
            className="rounded-full gap-1.5"
            onClick={() => setDetailTab('board')}
          >
            <Trophy className="h-3.5 w-3.5" />
            Board
          </Button>
          <Button
            size="sm"
            variant={detailTab === 'schedule' ? 'default' : 'outline'}
            className="rounded-full gap-1.5"
            onClick={() => setDetailTab('schedule')}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Schedule
          </Button>
        </div>

        {detailTab === 'schedule' ? (
          <CircleSchedule
            circle={active}
            selfUid={cloudUser.uid}
            selfName={cloudProfile?.displayName}
            friends={friends}
          />
        ) : (
          <>
        {/* Metric chips */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
          {METRICS.map(({ id, short, icon: Icon }) => (
            <Button
              key={id}
              size="sm"
              variant={metric === id ? 'default' : 'outline'}
              className="shrink-0 rounded-full gap-1.5"
              onClick={() => setMetric(id)}
            >
              <Icon className="h-3.5 w-3.5" />
              {short}
            </Button>
          ))}
        </div>

        {/* Podium */}
        {ranked.length > 0 ? (
          <motion.section
            key={metric}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={springSoft}
            className="mb-6"
          >
            <p className="kp-section-label mb-4">{metricDef.label} leaderboard</p>
            <div className="mb-6 grid grid-cols-3 items-end gap-2 sm:gap-4">
              {[1, 0, 2].map((podiumIndex) => {
                const entry = podium[podiumIndex]
                const place = podiumIndex + 1
                const heights = ['h-28 sm:h-32', 'h-36 sm:h-40', 'h-24 sm:h-28']
                if (!entry) {
                  return (
                    <div
                      key={place}
                      className={cn(
                        'rounded-t-3xl bg-secondary/20',
                        place === 1 ? 'order-2' : place === 2 ? 'order-1' : 'order-3',
                        heights[place - 1],
                      )}
                    />
                  )
                }
                return (
                  <motion.div
                    key={entry.row.uid}
                    layout
                    className={cn(
                      'relative flex flex-col items-center rounded-t-3xl px-2 pb-3 pt-4',
                      place === 1
                        ? 'order-2 bg-gradient-to-b from-primary/25 to-primary/5 ring-1 ring-primary/20'
                        : place === 2
                          ? 'order-1 bg-secondary/70'
                          : 'order-3 bg-secondary/50',
                      heights[place - 1],
                    )}
                  >
                    {place === 1 ? (
                      <Crown className="mb-1 h-4 w-4 text-amber-500" />
                    ) : (
                      <span className="mb-1 text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
                        #{place}
                      </span>
                    )}
                    <Avatar
                      name={entry.row.displayName}
                      you={entry.row.uid === cloudUser.uid}
                      size={place === 1 ? 'lg' : 'md'}
                    />
                    <p className="mt-2 line-clamp-1 text-center text-xs font-semibold sm:text-sm">
                      {entry.row.uid === cloudUser.uid ? 'You' : entry.row.displayName.split(' ')[0]}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-sm font-bold tabular-nums text-primary">
                      <Flame className="h-3.5 w-3.5" />
                      {entry.score}
                    </p>
                    <span className="mt-auto pt-2 text-[0.65rem] font-medium text-muted-foreground">
                      day streak
                    </span>
                  </motion.div>
                )
              })}
            </div>

            <p className="kp-section-label mb-3">Standings</p>
            <ol className="space-y-2">
              <AnimatePresence initial={false}>
                {ranked.map(({ row, score }, index) => {
                  const width = Math.max(8, (score / maxScore) * 100)
                  return (
                    <motion.li
                      key={row.uid}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        'kp-surface relative overflow-hidden p-0',
                        row.uid === cloudUser.uid && 'ring-1 ring-primary/40',
                      )}
                    >
                      <div
                        className="pointer-events-none absolute inset-y-0 left-0 bg-primary/10 transition-[width]"
                        style={{ width: `${width}%` }}
                      />
                      <div className="relative flex items-center gap-3 px-4 py-3.5">
                        <RankBadge rank={index + 1} />
                        <Avatar name={row.displayName} you={row.uid === cloudUser.uid} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {row.displayName}
                            {row.uid === cloudUser.uid ? ' · you' : ''}
                          </p>
                            <p className="text-xs text-muted-foreground">
                            {score} day{score === 1 ? '' : 's'}
                            {metric === 'water' && row.waterGlassesToday
                              ? ` · ${row.waterGlassesToday} glass${row.waterGlassesToday === 1 ? '' : 'es'} today`
                              : ''}
                            {metric === 'sleep' && row.sleepHoursLast
                              ? ` · last ${row.sleepHoursLast}h`
                              : ''}
                            {metric === 'habit' && (row.habitsDueToday ?? 0) > 0
                              ? ` · ${row.habitsDoneToday ?? 0}/${row.habitsDueToday} habits today`
                              : ''}
                            {metric === 'nutrition' && (row.caloriesToday ?? 0) > 0
                              ? ` · ${row.caloriesToday} cal today`
                              : ''}
                            {metric === 'workout' && (row.workoutMinutesToday ?? 0) > 0
                              ? ` · ${row.workoutMinutesToday} min today`
                              : ''}
                            {metric === 'lift' && (row.liftStreak ?? 0) > 0 && score > 0
                              ? ` · lifting streak`
                              : ''}
                          </p>
                        </div>
                        <span className="text-lg font-bold tabular-nums text-primary">{score}</span>
                      </div>
                    </motion.li>
                  )
                })}
              </AnimatePresence>
            </ol>
          </motion.section>
        ) : (
          <EmptyState
            className="mb-6"
            title="No streak data yet"
            description="Turn on sharing in Settings, log water, habits, lifts, or meals, then Sync."
          />
        )}

        {/* Timeline + posts + water check-in */}
        <div className="mb-8">
          <CircleBoardExtras
            circleId={active.id}
            selfUid={cloudUser.uid}
            selfName={cloudProfile?.displayName}
            friends={friends}
            board={board}
            metric={metric}
            activity={circleActivity}
            onAfterCheckIn={() => {
              void reloadBoard(active)
              void (async () => {
                try {
                  const feed = await listFriendActivity(active.memberIds)
                  setActivity(feed.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 20))
                } catch {
                  // optional
                }
              })()
            }}
          />
        </div>
          </>
        )}

        <div className="flex flex-wrap gap-2 border-t border-border/40 pt-4">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={async () => {
              try {
                const { url } = await createCircleInvite({
                  circle: active,
                  createdBy: cloudUser.uid,
                })
                await navigator.clipboard.writeText(url)
                toast.success('Invite link copied')
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Couldn’t create invite')
              }
            }}
          >
            <Link2 className="h-3.5 w-3.5" />
            Invite link
          </Button>
          {active.ownerId === cloudUser.uid ? (
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-destructive"
              onClick={async () => {
                if (!confirm(`Delete “${active.name}”?`)) return
                await deleteCircle(active.id)
                toast.message('Circle deleted')
                exitCircle()
                await loadCirclesList()
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5"
              onClick={async () => {
                try {
                  await leaveCircle(active, cloudUser.uid)
                  toast.message('Left circle')
                  exitCircle()
                  await loadCirclesList()
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Couldn’t leave')
                }
              }}
            >
              <LogOut className="h-3.5 w-3.5" />
              Leave
            </Button>
          )}
        </div>

        <ManageDialog
          open={manageOpen}
          onOpenChange={setManageOpen}
          editName={editName}
          setEditName={setEditName}
          friends={friends}
          memberIds={active.memberIds}
          ownerId={active.ownerId}
          selfUid={cloudUser.uid}
          pendingInviteeIds={pendingInvites.map((p) => p.inviteeUid)}
          inviteBusy={inviteBusy}
          onInvite={(uid) => void inviteFriend(uid)}
          onRemove={(uid) => void removeMember(uid)}
          onSave={saveManage}
        />

        <Dialog open={challengeOpen} onOpenChange={setChallengeOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>7-day challenge</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault()
                if (!active || !cloudUser) return
                try {
                  const startsAt = new Date().toISOString()
                  const endsAt = addDays(new Date(), 7).toISOString()
                  await setCircleChallenge(active.id, {
                    title: challengeTitle.trim() || '7-day streak',
                    metric: challengeMetric,
                    startsAt,
                    endsAt,
                    startedBy: cloudUser.uid,
                  })
                  setMetric(challengeMetric)
                  setChallengeOpen(false)
                  toast.success('Challenge started — climb the board')
                  await loadCirclesList()
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Couldn’t start challenge')
                }
              }}
            >
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="challenge-title">
                  Name
                </label>
                <Input
                  id="challenge-title"
                  value={challengeTitle}
                  onChange={(e) => setChallengeTitle(e.target.value)}
                  placeholder="Morning walk week"
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Metric</p>
                <div className="flex flex-wrap gap-2">
                  {METRICS.map(({ id, short, icon: Icon }) => (
                    <Button
                      key={id}
                      type="button"
                      size="sm"
                      variant={challengeMetric === id ? 'default' : 'outline'}
                      className="rounded-full gap-1.5"
                      onClick={() => setChallengeMetric(id)}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {short}
                    </Button>
                  ))}
                </div>
              </div>
              <Button type="submit" className="w-full min-h-11">
                Start challenge
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </motion.div>
    )
  }

  /* ——— LIST VIEW ——— */
  return (
    <motion.div {...pageEnterSubtle} className="kp-page">
      <PageHeader
        title="Circles"
        description="Pick a crew. Climb the board. Stay accountable together."
        eyebrow="Together"
        actions={
          <Button className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New
          </Button>
        }
      />

      <p className="mb-5 text-sm text-muted-foreground">
        Streak sharing is opt-in in{' '}
        <Link to="/settings" className="text-primary underline">
          Settings
        </Link>
        .{cloudProfile ? ` Signed in as ${cloudProfile.displayName}.` : null}
      </p>

      {circles.length === 0 ? (
        <>
          <TogetherSetup highlight="circles" className="mb-4" />
          <EmptyState
            title="No circles yet"
            description="Create one for gym buddies, family, or roommates. Enter it for leaderboards, a live timeline, and optional 7-day challenges."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => setCreateOpen(true)}>Create a circle</Button>
                <Button asChild variant="outline">
                  <Link to="/friends">Add friends first</Link>
                </Button>
              </div>
            }
          />
        </>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {circles.map((c, index) => {
            const memberNames = c.memberIds.map((uid) => {
              if (uid === cloudUser.uid) return cloudProfile?.displayName || 'You'
              return friends.find((f) => f.uid === uid)?.displayName || 'Member'
            })
            return (
              <motion.li
                key={c.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...springSoft, delay: index * 0.04 }}
              >
                <button
                  type="button"
                  onClick={() => enterCircle(c.id)}
                  className="kp-surface group relative w-full overflow-hidden p-5 text-left transition hover:border-primary/30 hover:shadow-[0_12px_40px_-24px_hsl(172_40%_20%/0.45)]"
                >
                  <div className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-primary/10 blur-2xl transition group-hover:bg-primary/20" />
                  <div className="relative flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="kp-section-label mb-1.5 flex items-center gap-1">
                        <Trophy className="h-3 w-3" />
                        Circle
                      </p>
                      <h2 className="font-display truncate text-2xl tracking-tight">{c.name}</h2>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        {c.memberIds.length} member{c.memberIds.length === 1 ? '' : 's'}
                        {c.ownerId === cloudUser.uid ? ' · you own' : ''}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Leaderboard · shared schedule
                      </p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      Enter
                    </span>
                  </div>
                  <div className="relative mt-4 flex -space-x-2">
                    {memberNames.slice(0, 5).map((name, i) => (
                      <div
                        key={`${c.id}-${i}`}
                        className="rounded-full ring-2 ring-background"
                        style={{ zIndex: 5 - i }}
                      >
                        <Avatar name={name} you={name === 'You' || name === cloudProfile?.displayName} size="sm" />
                      </div>
                    ))}
                    {memberNames.length > 5 ? (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-[0.65rem] font-semibold ring-2 ring-background">
                        +{memberNames.length - 5}
                      </div>
                    ) : null}
                  </div>
                </button>
              </motion.li>
            )
          })}
        </ul>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-xl">New circle</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => void onCreate(e)} className="space-y-4">
            <Input
              autoFocus
              placeholder="Name (e.g. Gym crew)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {friends.length > 0
                ? `Your ${friends.length} friend${friends.length === 1 ? '' : 's'} will be added automatically — you can edit in Manage.`
                : 'Add friends first so they can join this circle.'}
            </p>
            <Button type="submit" className="w-full" disabled={!newName.trim()}>
              Create & enter
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ManageDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        editName={editName}
        setEditName={setEditName}
        friends={friends}
        memberIds={active?.memberIds ?? []}
        ownerId={active?.ownerId ?? ''}
        selfUid={cloudUser.uid}
        pendingInviteeIds={pendingInvites.map((p) => p.inviteeUid)}
        inviteBusy={inviteBusy}
        onInvite={(uid) => void inviteFriend(uid)}
        onRemove={(uid) => void removeMember(uid)}
        onSave={saveManage}
      />
    </motion.div>
  )
}

function ManageDialog({
  open,
  onOpenChange,
  editName,
  setEditName,
  friends,
  memberIds,
  ownerId,
  selfUid,
  pendingInviteeIds,
  inviteBusy,
  onInvite,
  onRemove,
  onSave,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  editName: string
  setEditName: (v: string) => void
  friends: CloudProfile[]
  memberIds: string[]
  ownerId: string
  selfUid: string
  pendingInviteeIds: string[]
  inviteBusy: string | null
  onInvite: (uid: string) => void
  onRemove: (uid: string) => void
  onSave: (e: FormEvent) => void
}) {
  const memberFriends = friends.filter((f) => memberIds.includes(f.uid))
  const inviteable = friends.filter((f) => !memberIds.includes(f.uid))
  const pendingSet = new Set(pendingInviteeIds)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage circle</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void onSave(e)} className="space-y-4">
          <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" />
          <Button type="submit" variant="secondary" className="w-full">
            Save name
          </Button>

          <div>
            <p className="mb-2 text-sm font-medium">In this circle</p>
            <ul className="max-h-36 space-y-2 overflow-y-auto">
              <li className="flex items-center justify-between rounded-xl bg-secondary/50 px-3 py-2 text-sm">
                <span className="font-medium">You</span>
                <span className="text-xs text-muted-foreground">Owner</span>
              </li>
              {memberFriends.map((f) => (
                <li
                  key={f.uid}
                  className="flex items-center justify-between gap-2 rounded-xl bg-secondary/50 px-3 py-2"
                >
                  <span className="text-sm font-medium">{f.displayName}</span>
                  {f.uid !== ownerId && f.uid !== selfUid ? (
                    <Button type="button" size="sm" variant="ghost" onClick={() => onRemove(f.uid)}>
                      Remove
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Invite a friend</p>
            {inviteable.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {friends.length === 0 ? (
                  <>
                    No friends yet.{' '}
                    <Link to="/friends" className="text-primary underline">
                      Add friends
                    </Link>
                  </>
                ) : (
                  'Everyone you know is already in this circle.'
                )}
              </p>
            ) : (
              <ul className="max-h-48 space-y-2 overflow-y-auto">
                {inviteable.map((f) => {
                  const pending = pendingSet.has(f.uid)
                  return (
                    <li
                      key={f.uid}
                      className="flex items-center justify-between gap-2 rounded-xl bg-secondary/50 px-3 py-2"
                    >
                      <span className="text-sm font-medium">{f.displayName}</span>
                      {pending ? (
                        <span className="text-xs text-muted-foreground">Pending</span>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          disabled={inviteBusy === f.uid}
                          onClick={() => onInvite(f.uid)}
                        >
                          {inviteBusy === f.uid ? 'Sending…' : 'Invite'}
                        </Button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              They’ll get a notification and can accept in Friends.
            </p>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
