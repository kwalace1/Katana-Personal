import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  demoPlusAllowed,
  isPlusUnlocked,
  plusFeatureBlurb,
  setPlusUnlocked,
  type PlusFeature,
} from '@/lib/plus'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  feature: PlusFeature
  onUnlocked?: () => void
}

export function PlusPaywallSheet({ open, onOpenChange, feature, onUnlocked }: Props) {
  const blurb = plusFeatureBlurb(feature)
  const navigate = useNavigate()
  const showDemo = demoPlusAllowed()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-lg gap-0 rounded-t-[1.5rem] pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="border-b border-border/40 px-5 pb-4 pt-2 text-left">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
          <SheetTitle className="flex items-center gap-2 font-display text-2xl tracking-tight">
            <Sparkles className="h-5 w-5 text-primary" />
            {blurb.title}
          </SheetTitle>
          <SheetDescription>{blurb.body}</SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-5 py-4">
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">Free:</span> private day loop, Friends,
              Social, Circles boards — win cards you choose to share
            </li>
            <li>
              <span className="font-medium text-foreground">Plus · Accountability pack:</span> deeper
              Ask coach, Circle challenges, meal & label AI, live calendar & health apps
            </li>
          </ul>
          <Button
            className="min-h-11 w-full"
            onClick={() => {
              onOpenChange(false)
              navigate('/settings/plus')
            }}
          >
            See the Accountability pack
          </Button>
          {showDemo ? (
            <Button
              type="button"
              variant="secondary"
              className="min-h-11 w-full"
              onClick={() => {
                setPlusUnlocked(true)
                toast.success('Accountability pack unlocked (dev)')
                onOpenChange(false)
                onUnlocked?.()
              }}
            >
              Unlock for testing
            </Button>
          ) : null}
          <p className="text-center text-xs text-muted-foreground">
            Free stays a full daily OS. Plus is optional.
          </p>
          <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** Re-render when Plus toggles. */
export function usePlusStatus() {
  const [plus, setPlus] = useState(() => isPlusUnlocked())
  useEffect(() => {
    const sync = () => setPlus(isPlusUnlocked())
    window.addEventListener('katana-plus-change', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('katana-plus-change', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return plus
}
