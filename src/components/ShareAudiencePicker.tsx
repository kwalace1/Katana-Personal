import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { listFriendProfiles } from '@/lib/social/friends'
import { listMyCircles } from '@/lib/social/circles'
import type { CircleGroup, CloudProfile } from '@/lib/social/types'

export type ShareAudienceSelection = {
  friendIds: string[]
  circles: CircleGroup[]
  hasAny: boolean
}

function matchesQuery(text: string, query: string) {
  if (!query.trim()) return true
  return text.toLowerCase().includes(query.trim().toLowerCase())
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
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!uid || !enabled) return
    void listFriendProfiles(uid)
      .then((list) =>
        setFriends([...list].sort((a, b) => a.displayName.localeCompare(b.displayName))),
      )
      .catch(() => setFriends([]))
    void listMyCircles(uid).then(setCircles).catch(() => setCircles([]))
  }, [uid, enabled])

  const shareableCircleIds = useMemo(() => {
    return new Set(circles.filter((c) => c.memberIds.some((id) => id !== uid)).map((c) => c.id))
  }, [circles, uid])

  const filteredFriends = useMemo(
    () => friends.filter((f) => matchesQuery(f.displayName, query)),
    [friends, query],
  )

  const filteredCircles = useMemo(
    () => [...circles].filter((c) => matchesQuery(c.name, query)).sort((a, b) => a.name.localeCompare(b.name)),
    [circles, query],
  )

  useEffect(() => {
    if (!onAudienceChange) return
    const pickedCircles = circles.filter(
      (c) => selectedCircles[c.id] && shareableCircleIds.has(c.id),
    )
    const friendIds = Object.entries(selectedFriends)
      .filter(([, v]) => v)
      .map(([id]) => id)
    onAudienceChange({
      friendIds,
      circles: pickedCircles,
      hasAny: friendIds.length > 0 || pickedCircles.length > 0,
    })
  }, [selectedFriends, selectedCircles, circles, shareableCircleIds, onAudienceChange])

  const hasTargets = friends.length > 0 || circles.length > 0

  if (!enabled) return null

  if (!hasTargets) {
    return (
      <p className="text-sm text-muted-foreground">
        Add friends or invite people to a circle to share while creating.{' '}
        <Link to="/social?tab=friends" className="text-primary underline">
          Friends
        </Link>
        {' · '}
        <Link to="/circles" className="text-primary underline">
          Circles
        </Link>
      </p>
    )
  }

  const listMax = compact ? 'max-h-56' : 'max-h-72'

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search friends or circles…"
          className="pl-9"
          aria-label="Search friends or circles"
        />
      </div>

      <div className={`${listMax} space-y-4 overflow-y-auto`}>
        {filteredCircles.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Circles
            </p>
            <ul className="space-y-2">
              {filteredCircles.map((c) => {
                const others = c.memberIds.filter((id) => id !== uid).length
                const canShare = shareableCircleIds.has(c.id)
                return (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 rounded-xl bg-secondary/50 px-3 py-2"
                  >
                    <Checkbox
                      checked={!!selectedCircles[c.id]}
                      disabled={!canShare}
                      onCheckedChange={(v) => {
                        if (!canShare) return
                        onCirclesChange({ ...selectedCircles, [c.id]: Boolean(v) })
                      }}
                      id={`audience-circle-${c.id}`}
                    />
                    <label
                      htmlFor={`audience-circle-${c.id}`}
                      className={`min-w-0 flex-1 ${canShare ? 'cursor-pointer' : 'cursor-default opacity-70'}`}
                    >
                      <span className="block text-sm font-medium">{c.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {canShare
                          ? `${others} member${others === 1 ? '' : 's'} (besides you)`
                          : 'Add members first to share here'}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}

        {filteredFriends.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Friends
            </p>
            <ul className="space-y-2">
              {filteredFriends.map((f) => (
                <li
                  key={f.uid}
                  className="flex items-center gap-3 rounded-xl bg-secondary/50 px-3 py-2"
                >
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

        {query.trim() && filteredFriends.length === 0 && filteredCircles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matches for “{query.trim()}”.</p>
        ) : null}
      </div>
    </div>
  )
}
