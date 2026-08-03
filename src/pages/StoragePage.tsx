import { MotionPage } from '@/components/motion-page'
import { StorageDashboard } from '@/components/storage/storage-dashboard'
import { HardDrive } from 'lucide-react'

export default function StoragePage() {
  return (
    <MotionPage>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <HardDrive className="h-7 w-7" />
            Storage Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor storage usage, manage files, and view upload analytics across all modules.
          </p>
        </div>
        <StorageDashboard />
      </div>
    </MotionPage>
  )
}
