import { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { canManageCircle, circleRole } from '@/lib/social/circles'
import type { CircleGroup, CloudProfile } from '@/lib/social/types'

function roleLabel(role: 'owner' | 'moderator' | 'member') {
  if (role === 'owner') return 'Owner'
  if (role === 'moderator') return 'Moderator'
  return 'Member'
}

export function CircleManageDialog({
  open,
  onOpenChange,
  editName,
  setEditName,
  friends,
  memberProfiles,
  circle,
  selfUid,
  pendingInviteeIds,
  inviteBusy,
  onInvite,
  onRemove,
  onSetModerator,
  onSave,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  editName: string
  setEditName: (v: string) => void
  friends: CloudProfile[]
  memberProfiles: CloudProfile[]
  circle: CircleGroup | null
  selfUid: string
  pendingInviteeIds: string[]
  inviteBusy: string | null
  onInvite: (uid: string) => void
  onRemove: (uid: string) => void
  onSetModerator: (uid: string, makeMod: boolean) => void
  onSave: (e: FormEvent) => void
}) {
  if (!circle) return null

  const memberIds = circle.memberIds
  const moderatorIds = new Set(circle.moderatorIds || [])
  const friendByUid = new Map(friends.map((f) => [f.uid, f]))
  const profileByUid = new Map(memberProfiles.map((p) => [p.uid, p]))
  const inviteable = friends.filter((f) => !memberIds.includes(f.uid))
  const pendingSet = new Set(pendingInviteeIds)
  const canManage = canManageCircle(circle, selfUid)

  const memberRows = memberIds.map((uid) => {
    const role = circleRole(circle, uid)
    const name =
      uid === selfUid
        ? 'You'
        : profileByUid.get(uid)?.displayName || friendByUid.get(uid)?.displayName || 'Member'
    return { uid, role, name }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage circle</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void onSave(e)} className="space-y-4">
          {canManage ? (
            <>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" />
              <Button type="submit" variant="secondary" className="w-full">
                Save name
              </Button>
            </>
          ) : null}

          <div>
            <p className="mb-2 text-sm font-medium">In this circle</p>
            <ul className="max-h-48 space-y-2 overflow-y-auto">
              {memberRows.map((row) => (
                <li
                  key={row.uid}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary/50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">{roleLabel(row.role)}</p>
                  </div>
                  {canManage && row.uid !== circle.ownerId && row.uid !== selfUid ? (
                    <div className="flex flex-wrap gap-1">
                      {moderatorIds.has(row.uid) ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => onSetModerator(row.uid, false)}
                        >
                          Demote
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => onSetModerator(row.uid, true)}
                        >
                          Make mod
                        </Button>
                      )}
                      <Button type="button" size="sm" variant="ghost" onClick={() => onRemove(row.uid)}>
                        Remove
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>

          {canManage ? (
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
                They’ll get a notification and can accept in Friends. Moderators can rename, invite,
                and manage members — only the owner can delete the circle.
              </p>
            </div>
          ) : null}
        </form>
      </DialogContent>
    </Dialog>
  )
}
