import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { WidgetCatalogEntry } from '@/lib/module-widget-layout'

interface WidgetCatalogDialogProps {
  available: readonly WidgetCatalogEntry[]
  onAdd: (entry: WidgetCatalogEntry) => void
  triggerClassName?: string
}

export function WidgetCatalogDialog({
  available,
  onAdd,
  triggerClassName,
}: WidgetCatalogDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className={triggerClassName}>
          <Plus className="h-4 w-4 mr-2" />
          Add widget
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a widget</DialogTitle>
          <DialogDescription>
            Place any available capability on your canvas. Drag and resize after adding.
          </DialogDescription>
        </DialogHeader>
        {available.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Every widget from this catalog is already on your layout.
          </p>
        ) : (
          <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
            {available.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{entry.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{entry.description}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="shrink-0"
                  onClick={() => onAdd(entry)}
                >
                  Add
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
