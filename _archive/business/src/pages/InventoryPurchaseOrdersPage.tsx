import { MotionPage } from '@/components/motion-page'
import { PurchaseOrdersList } from '@/components/inventory/purchase-orders-list'

export default function InventoryPurchaseOrdersPage() {
  return (
    <MotionPage subtle className="min-w-0">
      <PurchaseOrdersList />
    </MotionPage>
  )
}

