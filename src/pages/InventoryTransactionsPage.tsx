import { MotionPage } from '@/components/motion-page'
import { TransactionsList } from '@/components/inventory/transactions-list'

export default function InventoryTransactionsPage() {
  return (
    <MotionPage subtle className="min-w-0">
      <TransactionsList />
    </MotionPage>
  )
}

