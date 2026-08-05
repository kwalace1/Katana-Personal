import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Checkbox } from '@/components/ui/checkbox'
import { listFriendProfiles } from '@/lib/social/friends'
import { listMyCircles } from '@/lib/social/circles'
import type { CircleGroup, CloudProfile } from '@/lib/social/types'

export type ShareAudienceSelection = {
  friendIds: string[]
  circles: CircleGroup[]
  hasAny: boolean
}

/** Inline circles + friends picker for create forms and share dialogs. */
export function ShareAudiencePicker({
  uid,
  enabled = true,
  selectedFriends,
  selectedCircles,
  onFriendsChange,
  onCirclesChange,
  onAudienceChange,
  compact = false,
}: {
  uid: string
  enabled?: boolean
  selectedFriends: Record<string, boolean>
  selectedCircles: Record<string, boolean>
  onFriendsChange: (next: Record<string, boolean>) => void
  onCirclesChange: (next: Record<string, boolean>) => void
  onAudienceChange?: (sel: ShareAudienceSelection) => void
  compact?: boolean
}) {
  const [friends, setFriends] = useState<CloudProfile[]>([])
  const [circles, setCircles] = useState<CircleGroup[]>([])

  useEffect(() => {
    if (!uid || !enabled) return
    void listFriendProfiles(uid).then(setFriends).catch(() => setFriends([]))
    void listMyCircles(uid).then(setCircles).catch(() => setCircles([]))
  }, [uid, enabled])

  const shareableCircles = useMemo(
    () => circles.filter((c) => c.memberIds.some((id) => id !== uid)),
    [circles, uid],
  )

  useEffect(() => {
    if (!onAudienceChange) return
    const pickedCircles = shareableCircles.filter((c) => selectedCircles[c.id])
    const friendIds = Object.entries(selectedFriends)
      .filter(([, v]) => v)
      .map(([id]) => id)
    onAudienceChange({
      friendIds,
      circles: pickedCircles,
      hasAny: friendIds.length > 0 || pickedCircles.length > 0,
    })
  }, [selectedFriends, selectedCircles, shareableCircles, onAudienceChange])

  const hasTargets = friends.length > 0 || shareableCircles.length > 0

  if (!enabled) return null

  if (!hasTargets) {
    return (
      <p className="text-sm text-muted-foreground">
        Add friends or invite people to a circle to share while creating.{' '}
        <Link to="/friends" className="text-primary underline">
          Friends
        </Link>
        {' · '}
        <Link to="/circles" className="text-primary underline">
          Circles
        </Link>
      </p>
    )
  }

  return (
    <div className={compact ? 'max-h-40 space-y-3 overflow-y-auto' : 'max-h-56 space-y-4 overflow-y-auto'}>
      {shareableCircles.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Circles
          </p>
          <ul className="space-y-2">
            {shareableCircles.map((c) => {
              const others = c.memberIds.filter((id) => id !== uid).length
              return (
                <li key={c.id} className="flex items-center gap-3 rounded-xl bg-secondary/50 px-3 py-2">
                  <Checkbox
                    checked={!!selectedCircles[c.id]}
                    onCheckedChange={(v) =>
                      onCirclesChange({ ...selectedCircles, [c.id]: Boolean(v) })
                    }
                    id={`audience-circle-${c.id}`}
                  />
                  <label htmlFor={`audience-circle-${c.id}`} className="min-w-0 flex-1 cursor-pointer">
                    <span className="block text-sm font-medium">{c.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {others} member{others === 1 ? '' : 's'} (besides you)
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {friends.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Friends
          </p>
          <ul className="space-y-2">
            {friends.map((f) => (
              <li key={f.uid} className="flex items-center gap-3 rounded-xl bg-secondary/50 px-3 py-2">
                <Checkbox
                  checked={!!selectedFriends[f.uid]}
                  onCheckedChange={(v) =>
                    onFriendsChange({ ...selectedFriends, [f.uid]: Boolean(v) })
                  }
                  id={`audience-friend-${f.uid}`}
                />
                <label
                  htmlFor={`audience-friend-${f.uid}`}
                  className="flex-1 cursor-pointer text-sm font-medium"
                >
                  {f.displayName}
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {circles.length > 0 && shareableCircles.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Your circles only have you so far — invite friends on Circles to share there.
        </p>
      ) : null}
    </div>
  )
}
