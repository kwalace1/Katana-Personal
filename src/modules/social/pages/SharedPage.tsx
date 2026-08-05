import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckSquare, LogOut, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { TogetherSetup } from '@/components/TogetherSetup'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { pageEnterSubtle } from '@/lib/motion-ui'
import { leaveSharedItem, listSharedItems, removeSharedItem, sharedItemHref } from '@/lib/social/shared'
import { getCloudProfile } from '@/lib/social/friends'
import { tasksApi } from '@/modules/tasks/api'
import type { SharedItem } from '@/lib/social/types'
import { formatShortDate } from '@/lib/dates'

export default function SharedPage() {
  const { user } = useAuth()
  const { cloudUser } = useCloudAuth()
  const [items, setItems] = useState<SharedItem[]>([])
  const [selected, setSelected] = useState<SharedItem | null>(null)
  const [memberNames, setMemberNames] = useState<Record<string, string>>({})
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!cloudUser) return
    void listSharedItems(cloudUser.uid)
      .then(setItems)
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Couldn’t load shared items'))
  }, [cloudUser, tick])

  useEffect(() => {
    if (!selected) return
    let cancelled = false
    ;(async () => {
      const map: Record<string, string> = {}
      await Promise.all(
        selected.memberIds.map(async (id) => {
          const p = await getCloudProfile(id)
          if (p) map[id] = p.displayName
        }),
      )
      if (!cancelled) setMemberNames(map)
    })()
    return () => {
      cancelled = true
    }
  }, [selected])

  if (!cloudUser) {
    return (
      <motion.div {...pageEnterSubtle} className="kp-page">
        <PageHeader title="Shared" description="Plans you’ve made together." eyebrow="Together" />
        <TogetherSetup highlight="shared" />
      </motion.div>
    )
  }

  return (
    <motion.div {...pageEnterSubtle} className="kp-page">
      <PageHeader title="Shared" description="Tasks and plans with friends and circles." eyebrow="Together" />
      {items.length === 0 ? (
        <>
          <TogetherSetup highlight="shared" className="mb-4" />
          <EmptyState
            title="Nothing shared yet"
            description="Open a task, tap Share, pick a circle or friend — it lands here."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild>
                  <Link to="/tasks">Open Tasks → pick one → Share</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/circles">Open Circles</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/friends">Find friends</Link>
                </Button>
              </div>
            }
          />
        </>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const mine = item.ownerId === cloudUser.uid
            const circleNames = Array.isArray(item.data?.sharedCircleNames)
              ? (item.data.sharedCircleNames as string[]).filter(Boolean)
              : []
            return (
            <li key={item.id}>
              <button
                type="button"
                className="kp-surface flex w-full items-start justify-between gap-3 p-4 text-left transition hover:border-primary/30"
                onClick={() => setSelected(item)}
              >
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {item.kind} · {mine ? 'You shared' : 'Shared with you'}
                  </p>
                  <p className="font-medium">{item.title}</p>
                  {item.body ? (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.body}</p>
                  ) : null}
                  <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {circleNames.length > 0
                      ? `${circleNames.join(', ')} · ${item.memberIds.length} people`
                      : `${item.memberIds.length} people`}
                    {' · '}
                    {formatShortDate(item.updatedAt)}
                  </p>
                </div>
              </button>
            </li>
            )
          })}
        </ul>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-xl tracking-tight">{selected.title}</DialogTitle>
              </DialogHeader>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{selected.kind}</p>
              {Array.isArray(selected.data?.sharedCircleNames) &&
              (selected.data.sharedCircleNames as string[]).length > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Shared via {(selected.data.sharedCircleNames as string[]).join(', ')}
                </p>
              ) : null}
              {selected.body ? <p className="text-sm text-muted-foreground">{selected.body}</p> : null}
              <div>
                <p className="mb-2 text-sm font-medium">People</p>
                <ul className="space-y-1">
                  {selected.memberIds.map((id) => (
                    <li key={id} className="rounded-xl bg-secondary/50 px-3 py-2 text-sm">
                      {memberNames[id] || '…'}
                      {id === selected.ownerId ? (
                        <span className="ml-2 text-xs text-muted-foreground">owner</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-wrap gap-2">
                {sharedItemHref(selected) && selected.ownerId === cloudUser.uid ? (
                  <Button asChild variant="outline">
                    <Link to={sharedItemHref(selected)!} onClick={() => setSelected(null)}>
                      Open related
                    </Link>
                  </Button>
                ) : null}
                {selected.kind === 'task' && user ? (
                  <Button
                    className="gap-1.5"
                    onClick={() => {
                      const lists = tasksApi.listLists(user.id)
                      const task = tasksApi.createTask(user.id, {
                        title: selected.title,
                        notes: selected.body || '',
                        list_id: lists[0]?.id ?? null,
                        due_at:
                          typeof selected.data?.due_at === 'string' ? selected.data.due_at : null,
                      })
                      toast.success('Copied into your tasks')
                      setSelected(null)
                      window.location.href = `/tasks?id=${task.id}`
                    }}
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                    Copy into my tasks
                  </Button>
                ) : null}
                {selected.ownerId === cloudUser.uid ? (
                  <Button
                    variant="destructive"
                    className="gap-1.5"
                    onClick={async () => {
                      await removeSharedItem(selected.id)
                      setSelected(null)
                      setTick((n) => n + 1)
                      toast.message('Removed')
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="gap-1.5"
                    onClick={async () => {
                      await leaveSharedItem(cloudUser.uid, selected)
                      setSelected(null)
                      setTick((n) => n + 1)
                      toast.message('Left')
                    }}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Leave
                  </Button>
                )}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
