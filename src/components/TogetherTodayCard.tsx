import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Users, Trophy, Share2, UserPlus, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { listFriendships, getCloudProfile } from '@/lib/social/friends'
import { listMyCircles } from '@/lib/social/circles'
import { listSharedItems } from '@/lib/social/shared'
import { loadCirclesBoard } from '@/lib/social/streaks'
import { InviteFriendButton } from '@/components/InviteFriendButton'
import { springSoft } from '@/lib/motion-ui'
import { cn } from '@/lib/utils'
import type { StreakSnapshot } from '@/lib/social/types'

type StripMode =
  | { kind: 'offline' }
  | { kind: 'connect' }
  | { kind: 'pending'; count: number; names: string[] }
  | {
      kind: 'board'
      circleName: string
      rows: { name: string; score: number; you: boolean }[]
      challengeTitle?: string
      sharedIncoming?: number
    }
  | { kind: 'empty'; sharedIncoming?: number }

export function TogetherTodayCard() {
  const { cloudEnabled, cloudUser, cloudProfile, syncStreaksToCloud } = useCloudAuth()
  const [mode, setMode] = useState<StripMode | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!cloudEnabled) {
        setMode({ kind: 'offline' })
        return
      }
      if (!cloudUser || !cloudProfile) {
        setMode({ kind: 'connect' })
        return
      }
      try {
        const friendships = await listFriendships(cloudUser.uid)
        const incoming = friendships.filter(
          (f) => f.status === 'pending' && f.requestedBy !== cloudUser.uid,
        )
        if (incoming.length > 0) {
          const names: string[] = []
          for (const f of incoming.slice(0, 2)) {
            const p = await getCloudProfile(f.requestedBy)
            if (p) names.push(p.displayName)
          }
          if (!cancelled) setMode({ kind: 'pending', count: incoming.length, names })
          return
        }

        const [circles, shared] = await Promise.all([
          listMyCircles(cloudUser.uid),
          listSharedItems(cloudUser.uid).catch(() => []),
        ])
        const sharedIncoming = shared.filter((s) => s.ownerId !== cloudUser.uid).length
        const accepted = friendships.filter((f) => f.status === 'accepted')
        if (circles.length > 0 && accepted.length > 0) {
          await syncStreaksToCloud().catch(() => undefined)
          const circle = circles[0]
          const board = await loadCirclesBoard(cloudUser.uid, circle.memberIds)
          const ranked = [...board]
            .map((row: StreakSnapshot) => ({
              name: row.displayName,
              score: Math.max(
                row.habitStreakBest,
                row.waterStreak,
                row.workoutStreak,
                row.liftStreak ?? 0,
                row.sleepStreak,
              ),
              you: row.uid === cloudUser.uid,
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
          const challenge = circle.challenge
          const challengeLive =
            challenge &&
            new Date(challenge.startsAt).getTime() <= Date.now() &&
            new Date(challenge.endsAt).getTime() >= Date.now()
              ? challenge.title
              : undefined
          if (!cancelled)
            setMode({
              kind: 'board',
              circleName: circle.name,
              rows: ranked,
              challengeTitle: challengeLive,
              sharedIncoming,
            })
          return
        }

        if (!cancelled) setMode({ kind: 'empty', sharedIncoming })
      } catch {
        if (!cancelled) setMode({ kind: 'empty' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [cloudEnabled, cloudUser?.uid, cloudProfile?.uid, syncStreaksToCloud])

  if (!mode) return null

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSoft}
      className="mb-6 overflow-hidden kp-surface border border-primary/15 p-5 sm:p-6"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="kp-section-label">Together</p>
        <Link to="/friends" className="text-xs font-medium text-primary hover:underline">
          Open
        </Link>
      </div>

      {mode.kind === 'offline' && (
        <div>
          <p className="font-display text-xl tracking-tight">Friends & Circles</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect cloud in Settings to invite friends and cheer streaks together.
          </p>
          <Button asChild size="sm" variant="outline" className="mt-3">
            <Link to="/settings">Connect cloud</Link>
          </Button>
        </div>
      )}

      {mode.kind === 'connect' && (
        <div>
          <p className="font-display text-xl tracking-tight">Invite someone you trust</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect once — share plans, cheer streaks, stay accountable.
          </p>
          <Button asChild size="sm" className="mt-3 gap-1.5">
            <Link to="/settings">
              Connect
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">Only what you choose to share.</p>
        </div>
      )}

      {mode.kind === 'pending' && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-display text-xl tracking-tight">
              {mode.count === 1 ? 'Friend request waiting' : `${mode.count} friend requests`}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode.names.length > 0 ? mode.names.join(', ') : 'Someone wants to connect'}
            </p>
          </div>
          <Button asChild className="gap-1.5">
            <Link to="/friends">
              <UserPlus className="h-4 w-4" />
              Review
            </Link>
          </Button>
        </div>
      )}

      {mode.kind === 'board' && (
        <div>
          <p className="font-display text-xl tracking-tight">{mode.circleName}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {mode.challengeTitle
              ? `Challenge: ${mode.challengeTitle}`
              : 'Live streaks with your circle'}
          </p>
          <ul className="mt-3 space-y-1.5">
            {mode.rows.map((row, i) => (
              <li
                key={`${row.name}-${i}`}
                className={cn(
                  'flex items-center justify-between rounded-xl px-3 py-2 text-sm',
                  row.you ? 'bg-primary/10 font-medium' : 'bg-secondary/50',
                )}
              >
                <span>
                  <span className="mr-2 text-muted-foreground">{i + 1}.</span>
                  {row.you ? 'You' : row.name}
                </span>
                <span className="tabular-nums text-primary">{row.score}d</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link to="/circles">
                <Trophy className="h-3.5 w-3.5" />
                Full board
              </Link>
            </Button>
            {(mode.sharedIncoming ?? 0) > 0 ? (
              <Button asChild size="sm" variant="ghost" className="gap-1.5">
                <Link to="/shared">
                  <Share2 className="h-3.5 w-3.5" />
                  {mode.sharedIncoming} shared with you
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {mode.kind === 'empty' && (
        <div>
          <p className="font-display text-xl tracking-tight">Accountability starts here</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Friends are people. Shared is plans you copy in. Circles are streaks — Schedule shows on
            Calendar.
          </p>
          {(mode.sharedIncoming ?? 0) > 0 ? (
            <p className="mt-2 text-sm font-medium text-primary">
              {mode.sharedIncoming} plan{mode.sharedIncoming === 1 ? '' : 's'} waiting in Shared
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <InviteFriendButton size="sm" />
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link to="/shared">
                <Share2 className="h-3.5 w-3.5" />
                Shared
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link to="/circles">
                <Trophy className="h-3.5 w-3.5" />
                Start a circle
              </Link>
            </Button>
          </div>
        </div>
      )}
    </motion.section>
  )
}
