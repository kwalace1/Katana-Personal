import { MotionPage } from '@/components/motion-page'
import { ScanIn } from '@/components/inventory/scan-in'

export default function InventoryScanInPage() {
  return (
    <MotionPage subtle className="min-w-0">
      <ScanIn />
    </MotionPage>
  )
}

