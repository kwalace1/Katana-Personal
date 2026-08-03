import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { pageEnterSubtle } from '@/lib/motion-ui'
import { listSharedItems, removeSharedItem } from '@/lib/social/shared'
import type { SharedItem } from '@/lib/social/types'
import { formatShortDate } from '@/lib/dates'

export default function SharedPage() {
  const { cloudUser } = useCloudAuth()
  const [items, setItems] = useState<SharedItem[]>([])
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!cloudUser) return
    void listSharedItems(cloudUser.uid)
      .then(setItems)
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Couldn’t load shared items'))
  }, [cloudUser, tick])

  if (!cloudUser) {
    return (
      <motion.div {...pageEnterSubtle} className="kp-page">
        <PageHeader title="Shared" description="Plans you’ve made together." eyebrow="Social" />
        <EmptyState
          title="Sign in to see shared plans"
          action={
            <Button asChild>
              <Link to="/settings">Settings</Link>
            </Button>
          }
        />
      </motion.div>
    )
  }

  return (
    <motion.div {...pageEnterSubtle} className="kp-page">
      <PageHeader title="Shared" description="Tasks, events, and more with friends." eyebrow="Social" />
      {items.length === 0 ? (
        <EmptyState
          title="Nothing shared yet"
          description="From Tasks or Calendar, tap Share to invite a friend onto something."
        />
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="kp-surface flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.kind}</p>
                <p className="font-medium">{item.title}</p>
                {item.body ? <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{item.body}</p> : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.memberIds.length} people · {formatShortDate(item.updatedAt)}
                </p>
              </div>
              {item.ownerId === cloudUser.uid ? (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={async () => {
                    await removeSharedItem(item.id)
                    setTick((n) => n + 1)
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  )
}
