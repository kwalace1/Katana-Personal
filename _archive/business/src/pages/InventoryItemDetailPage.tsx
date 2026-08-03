import { useParams } from 'react-router-dom'
import { MotionPage } from '@/components/motion-page'
import { ItemDetail } from '@/components/inventory/item-detail'

export default function InventoryItemDetailPage() {
  const { id } = useParams()
  
  if (!id) {
    return <div>Item not found</div>
  }
  
  return (
    <MotionPage key={id} subtle className="min-w-0">
      <ItemDetail itemId={id} />
    </MotionPage>
  )
}

