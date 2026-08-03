import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { GraduationCap, PartyPopper } from 'lucide-react'

interface OnboardingTourWelcomeDialogProps {
  open: boolean
  moduleCount: number
  onStart: () => void
}

/** Mandatory first-login training prompt — no skip option. */
export function OnboardingTourWelcomeDialog({
  open,
  moduleCount,
  onStart,
}: OnboardingTourWelcomeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-lg"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <GraduationCap className="h-6 w-6 text-primary" />
            Welcome to Katana
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed pt-1">
            Before you begin, we will walk you through the entire platform — starting at your
            Employee Launchpad, then the Hub, and every module you have access to ({moduleCount}{' '}
            stops). This training tour is required on your first login and takes about 15–20
            minutes. You can replay it anytime from the Launchpad or Hub.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onStart} className="gap-2">
            <GraduationCap className="h-4 w-4" />
            Start training tour
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface OnboardingTourResumeDialogProps {
  open: boolean
  progressLabel: string
  onResume: () => void
  onRestart: () => void
}

export function OnboardingTourResumeDialog({
  open,
  progressLabel,
  onResume,
  onRestart,
}: OnboardingTourResumeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            Continue your training
          </DialogTitle>
          <DialogDescription>
            You have an in-progress training tour ({progressLabel}). Resume where you left off or
            start over from the beginning.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onRestart}>
            Start over
          </Button>
          <Button onClick={onResume}>Resume tour</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface OnboardingTourCompleteDialogProps {
  open: boolean
  onClose: () => void
}

export function OnboardingTourCompleteDialog({
  open,
  onClose,
}: OnboardingTourCompleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PartyPopper className="h-5 w-5 text-primary" />
            Training complete
          </DialogTitle>
          <DialogDescription className="leading-relaxed">
            You have finished the full Katana training tour. You are ready to work across every
            module. Replay the tour anytime from the Training Tour button on your Launchpad or Hub,
            or open individual module tours from the Setup Guide.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onClose}>Get started</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
