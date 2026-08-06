import { FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { setCircleChallenge } from '@/lib/social/circles'
import { addDays } from '@/lib/dates'
import type { CircleChallengeMetric, CircleGroup } from '@/lib/social/types'
import { cn } from '@/lib/utils'

const CHALLENGE_METRICS: { id: CircleChallengeMetric; label: string }[] = [
  { id: 'habit', label: 'Habits' },
  { id: 'water', label: 'Water' },
  { id: 'workout', label: 'Workouts' },
  { id: 'lift', label: 'Lifts' },
  { id: 'sleep', label: 'Sleep' },
  { id: 'nutrition', label: 'Nutrition' },
]

export function CircleChallengeDialog({
  open,
  onOpenChange,
  circle,
  selfUid,
  title,
  setTitle,
  metric,
  setMetric,
  onStarted,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  circle: CircleGroup | null
  selfUid: string
  title: string
  setTitle: (v: string) => void
  metric: CircleChallengeMetric
  setMetric: (m: CircleChallengeMetric) => void
  onStarted: (metric: CircleChallengeMetric) => void | Promise<void>
}) {
  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!circle) return
    try {
      const startsAt = new Date().toISOString()
      const endsAt = addDays(new Date(), 7).toISOString()
      await setCircleChallenge(circle.id, {
        title: title.trim() || '7-day streak',
        metric,
        startsAt,
        endsAt,
        startedBy: selfUid,
      })
      onOpenChange(false)
      toast.success('Challenge started — climb the board')
      await onStarted(metric)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t start challenge')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>7-day challenge</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <div>
            <label className="text-sm font-medium" htmlFor="challenge-title">
              Title
            </label>
            <Input
              id="challenge-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1"
              placeholder="7-day streak"
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Metric</p>
            <div className="flex flex-wrap gap-2">
              {CHALLENGE_METRICS.map(({ id, label }) => (
                <Button
                  key={id}
                  type="button"
                  size="sm"
                  variant={metric === id ? 'default' : 'outline'}
                  className={cn(metric === id && 'shadow-sm')}
                  onClick={() => setMetric(id)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
          <Button type="submit" className="w-full">
            Start challenge
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
