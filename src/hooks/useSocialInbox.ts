import { useCallback, useEffect, useRef, useState } from 'react'
import { listFriendships, subscribeFriendships } from '@/lib/social/friends'
import {
  listMyPendingCircleInvites,
  subscribeMyPendingCircleInvites,
  type CircleInvite,
} from '@/lib/social/invites'
import type { Friendship } from '@/lib/social/types'

const POLL_MS = 3000

/**
 * Live social inbox: Firestore listeners + 3s poll fallback (iOS PWA Safari).
 * Refresh on tab focus too.
 * Pass uid=undefined to no-op (when a parent already owns the inbox).
 */
export function useSocialInbox(uid: string | undefined) {
  const [friendships, setFriendships] = useState<Friendship[]>([])
  const [circleInvites, setCircleInvites] = useState<CircleInvite[]>([])
  const [revision, setRevision] = useState(0)
  const uidRef = useRef(uid)
  uidRef.current = uid

  const pull = useCallback(async () => {
    const id = uidRef.current
    if (!id) return
    try {
      const [list, invites] = await Promise.all([
        listFriendships(id),
        listMyPendingCircleInvites(id).catch(() => [] as CircleInvite[]),
      ])
      setFriendships(list)
      setCircleInvites(invites)
      setRevision((n) => n + 1)
    } catch {
      // keep last good snapshot
    }
  }, [])

  useEffect(() => {
    if (!uid) {
      setFriendships([])
      setCircleInvites([])
      return
    }

    void pull()

    const unsubFriends = subscribeFriendships(uid, (list) => {
      setFriendships(list)
      setRevision((n) => n + 1)
    })
    const unsubInvites = subscribeMyPendingCircleInvites(
      uid,
      (invites) => {
        setCircleInvites(invites)
        setRevision((n) => n + 1)
      },
      () => {
        // index may still be building — poll covers it
      },
    )

    const poll = window.setInterval(() => {
      void pull()
    }, POLL_MS)

    function onVisible() {
      if (document.visibilityState === 'visible') void pull()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      unsubFriends()
      unsubInvites()
      window.clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [uid, pull])

  const incomingFriendCount = !uid
    ? 0
    : friendships.filter((f) => f.status === 'pending' && f.requestedBy !== uid).length

  return {
    friendships,
    circleInvites,
    revision,
    refresh: pull,
    pendingCount: incomingFriendCount + circleInvites.length,
    incomingFriendCount,
  }
}
