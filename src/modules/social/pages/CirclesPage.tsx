import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Flame,
  Droplets,
  Moon,
  Salad,
  Dumbbell,
  RefreshCw,
  Plus,
  Settings2,
  Trash2,
  LogOut,
  Link2,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { pageEnterSubtle } from '@/lib/motion-ui'
import { loadCirclesBoard, listFriendActivity } from '@/lib/social/streaks'
import {
  createCircle,
  deleteCircle,
  leaveCircle,
  listMyCircles,
  renameCircle,
  setCircleMembers,
} from '@/lib/social/circles'
import { createCircleInvite } from '@/lib/social/invites'
import { listFriendProfiles } from '@/lib/social/friends'
import type { CircleGroup, CloudProfile, StreakSnapshot } from '@/lib/social/types'
import { cn } from '@/lib/utils'

type BoardMetric = 'water' | 'sleep' | 'nutrition' | 'workout' | 'habit'

const METRICS: {
  id: BoardMetric
  label: string
  icon: typeof Flame
  score: (s: StreakSnapshot) => number
}[] = [
  { id: 'water', label: 'Hydration', icon: Droplets, score: (s) => s.waterStreak },
  { id: 'sleep', label: 'Sleep', icon: Moon, score: (s) => s.sleepStreak },
  { id: 'nutrition', label: 'Nutrition', icon: Salad, score: (s) => s.nutritionStreak },
  { id: 'workout', label: 'Workouts', icon: Dumbbell, score: (s) => s.workoutStreak },
  { id: 'habit', label: 'Habits', icon: Flame, score: (s) => s.habitStreakBest },
]

export default function CirclesPage() {
  const { cloudEnabled, cloudUser, cloudProfile, syncStreaksToCloud } = useCloudAuth()
  const [metric, setMetric] = useState<BoardMetric>('water')
  const [circles, setCircles] = useState<CircleGroup[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [board, setBoard] = useState<StreakSnapshot[]>([])
  const [friends, setFriends] = useState<CloudProfile[]>([])
  const [activity, setActivity] = useState<{ uid: string; message: string; updatedAt: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [newName, setNewName] = useState('')
  const [manageOpen, setManageOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editMembers, setEditMembers] = useState<Record<string, boolean>>({})

  const active = circles.find((c) => c.id === activeId) ?? null

  async function loadCirclesList() {
    if (!cloudUser) return
    const list = await listMyCircles(cloudUser.uid)
    setCircles(list)
    setActiveId((prev) => {
      if (prev && list.some((c) => c.id === prev)) return prev
      return list[0]?.id ?? null
    })
    return list
  }

  async function reloadBoard(circle?: CircleGroup | null) {
    if (!cloudUser) return
    setBusy(true)
    try {
      await syncStreaksToCloud()
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
    void (async () => {
      try {
        const [list, friendList] = await Promise.all([
          listMyCircles(cloudUser.uid),
          listFriendProfiles(cloudUser.uid),
        ])
        setCircles(list)
        setFriends(friendList)
        const first = list[0]?.id ?? null
        setActiveId(first)
        await syncStreaksToCloud()
        const circle = list[0] ?? null
        const rows = await loadCirclesBoard(
          cloudUser.uid,
          circle?.memberIds ?? [cloudUser.uid],
        )
        setBoard(rows)
        const feed = await listFriendActivity(friendList.map((f) => f.uid))
        setActivity(feed.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Couldn’t load circles')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudUser?.uid])

  useEffect(() => {
    if (!cloudUser || !activeId) return
    const circle = circles.find((c) => c.id === activeId)
    if (!circle) return
    void reloadBoard(circle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  const ranked = useMemo(() => {
    const m = METRICS.find((x) => x.id === metric)!
    return [...board]
      .map((row) => ({ row, score: m.score(row) }))
      .sort((a, b) => b.score - a.score)
  }, [board, metric])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!cloudUser || !newName.trim()) return
    try {
      const circle = await createCircle({ name: newName, ownerId: cloudUser.uid })
      setNewName('')
      toast.success('Circle created')
      await loadCirclesList()
      setActiveId(circle.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t create circle')
    }
  }

  function openManage() {
    if (!active || !cloudUser) return
    setEditName(active.name)
    const map: Record<string, boolean> = {}
    for (const f of friends) {
      map[f.uid] = active.memberIds.includes(f.uid)
    }
    setEditMembers(map)
    setManageOpen(true)
  }

  async function saveManage(e: FormEvent) {
    e.preventDefault()
    if (!active || !cloudUser) return
    try {
      const memberIds = [
        cloudUser.uid,
        ...Object.entries(editMembers)
          .filter(([, on]) => on)
          .map(([id]) => id),
      ]
      await renameCircle(active.id, editName)
      await setCircleMembers(active.id, memberIds)
      toast.success('Circle updated')
      setManageOpen(false)
      const list = await loadCirclesList()
      const updated = list?.find((c) => c.id === active.id)
      await reloadBoard(updated ?? null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t update')
    }
  }

  if (!cloudEnabled) {
    return (
      <motion.div {...pageEnterSubtle} className="kp-page">
        <PageHeader title="Circles" description="Groups for streaks with people you trust." eyebrow="Social" />
        <EmptyState title="Cloud isn’t connected yet" description="See FIREBASE_SETUP.md to turn on Circles." />
      </motion.div>
    )
  }

  if (!cloudUser) {
    return (
      <motion.div {...pageEnterSubtle} className="kp-page">
        <PageHeader title="Circles" description="Groups for streaks with people you trust." eyebrow="Social" />
        <EmptyState
          title="Sign in to join Circles"
          description="Create groups like gym, family, or roommates — then cheer each other on."
          action={
            <Button asChild>
              <Link to="/settings">Open Settings</Link>
            </Button>
          }
        />
      </motion.div>
    )
  }

  return (
    <motion.div {...pageEnterSubtle} className="kp-page">
      <PageHeader
        title="Circles"
        description="Make different groups — each with its own streak board."
        eyebrow="Social"
        actions={
          <Button
            variant="outline"
            className="gap-2"
            disabled={busy}
            onClick={() => void reloadBoard()}
          >
            <RefreshCw className={cn('h-4 w-4', busy && 'animate-spin')} />
            Refresh
          </Button>
        }
      />

      <p className="mb-4 text-sm text-muted-foreground">
        Sharing is still opt-in in{' '}
        <Link to="/settings" className="text-primary underline">
          Settings
        </Link>
        . Add friends first, then put them in a circle.
        {cloudProfile ? ` You’re ${cloudProfile.displayName}.` : null}
      </p>

      {activity.length > 0 ? (
        <section className="mb-4 overflow-hidden kp-surface p-4">
          <p className="kp-section-label mb-2">Friend activity</p>
          <ul className="space-y-1.5">
            {activity.map((a) => {
              const friend = friends.find((f) => f.uid === a.uid)
              return (
                <li key={`${a.uid}-${a.updatedAt}`} className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{friend?.displayName || 'Friend'}</span>
                  {' — '}
                  {a.message}
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      <form onSubmit={(e) => void onCreate(e)} className="kp-surface mb-4 flex gap-2 p-3 sm:p-4">
        <Input
          placeholder="New circle name (e.g. Gym crew)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" className="gap-1.5 shrink-0">
          <Plus className="h-4 w-4" />
          Create
        </Button>
      </form>

      {circles.length === 0 ? (
        <EmptyState
          title="No circles yet"
          description="1) Add a friend · 2) Turn on streak sharing in Settings · 3) Create a circle here."
          action={
            <Button asChild variant="outline">
              <Link to="/friends">Add friends</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {circles.map((c) => (
              <Button
                key={c.id}
                size="sm"
                variant={activeId === c.id ? 'default' : 'outline'}
                className="rounded-full"
                onClick={() => setActiveId(c.id)}
              >
                {c.name}
                <span className="ml-1.5 opacity-70">{c.memberIds.length}</span>
              </Button>
            ))}
          </div>

          {active ? (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <p className="text-sm text-muted-foreground">
                {active.memberIds.length} member{active.memberIds.length === 1 ? '' : 's'}
                {active.ownerId === cloudUser.uid ? ' · you own this' : ''}
              </p>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={openManage}>
                <Settings2 className="h-3.5 w-3.5" />
                Manage
              </Button>
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
                Copy invite link
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
          ) : null}

          <div className="mb-5 flex flex-wrap gap-2">
            {METRICS.map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                size="sm"
                variant={metric === id ? 'default' : 'outline'}
                className="rounded-full gap-1.5"
                onClick={() => setMetric(id)}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Button>
            ))}
          </div>

          {!active ? (
            <EmptyState title="Pick a circle" description="Select a group above to see the board." />
          ) : ranked.length === 0 ? (
            <EmptyState
              title="No streak data yet"
              description="Members need to opt in to sharing in Settings, then hit Refresh."
            />
          ) : (
            <ol className="space-y-2">
              {ranked.map(({ row, score }, index) => (
                <li
                  key={row.uid}
                  className={cn(
                    'kp-surface flex items-center gap-4 p-4',
                    row.uid === cloudUser.uid && 'ring-1 ring-primary/35',
                  )}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {row.displayName}
                      {row.uid === cloudUser.uid ? ' · you' : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {score} day{score === 1 ? '' : 's'} streak
                      {metric === 'water' && row.waterGlassesToday
                        ? ` · ${row.waterGlassesToday} glasses today`
                        : ''}
                    </p>
                  </div>
                  <Flame className="h-5 w-5 text-primary opacity-80" />
                </li>
              ))}
            </ol>
          )}
        </>
      )}

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage circle</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => void saveManage(e)} className="space-y-4">
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" />
            <div>
              <p className="mb-2 text-sm font-medium">Friends in this circle</p>
              {friends.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No friends yet.{' '}
                  <Link to="/friends" className="text-primary underline">
                    Add friends
                  </Link>
                </p>
              ) : (
                <ul className="max-h-48 space-y-2 overflow-y-auto">
                  {friends.map((f) => (
                    <li key={f.uid} className="flex items-center gap-3 rounded-xl bg-secondary/50 px-3 py-2">
                      <Checkbox
                        id={`c-${f.uid}`}
                        checked={!!editMembers[f.uid]}
                        onCheckedChange={(v) =>
                          setEditMembers((m) => ({ ...m, [f.uid]: Boolean(v) }))
                        }
                      />
                      <label htmlFor={`c-${f.uid}`} className="flex-1 cursor-pointer text-sm font-medium">
                        {f.displayName}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-xs text-muted-foreground">You’re always included as a member.</p>
            </div>
            <Button type="submit" className="w-full">
              Save
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
