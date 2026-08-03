import { MotionPage } from '@/components/motion-page'
import { VirtualStockroom } from '@/components/inventory/virtual-stockroom'

export default function InventoryStockroomPage() {
  return (
    <MotionPage subtle className="min-w-0">
      <VirtualStockroom />
    </MotionPage>
  )
}
