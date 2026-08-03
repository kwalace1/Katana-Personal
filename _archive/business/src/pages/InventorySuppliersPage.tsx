import { MotionPage } from '@/components/motion-page'
import { SuppliersList } from '@/components/inventory/suppliers-list'

export default function InventorySuppliersPage() {
  return (
    <MotionPage subtle className="min-w-0">
      <SuppliersList />
    </MotionPage>
  )
}

