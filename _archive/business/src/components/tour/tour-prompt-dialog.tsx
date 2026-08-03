import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Compass } from 'lucide-react'

interface TourPromptDialogProps {
  open: boolean
  moduleName: string
  onAccept: () => void
  onDismiss: () => void
}

export function TourPromptDialog({
  open,
  moduleName,
  onAccept,
  onDismiss,
}: TourPromptDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDismiss()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-primary" />
            Welcome to {moduleName}
          </DialogTitle>
          <DialogDescription>
            Would you like a quick guided tour of this module? You can always start it again
            from the Help button or the Setup Guide.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onDismiss}>
            Skip for now
          </Button>
          <Button onClick={onAccept}>Yes, show me</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
