import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2 } from 'lucide-react'
import type { LineItem } from '@/lib/customer-crm-api'
import { normalizeLineItems } from '@/lib/crm-commerce-templates'

interface CrmLineItemsEditorProps {
  items: LineItem[]
  onChange: (items: LineItem[]) => void
  currency?: string
}

export function CrmLineItemsEditor({ items, onChange, currency = 'USD' }: CrmLineItemsEditorProps) {
  const updateItem = (index: number, patch: Partial<LineItem>) => {
    const next = items.map((item, i) => {
      if (i !== index) return item
      const merged = { ...item, ...patch }
      const quantity = Number(merged.quantity) || 0
      const unit_price = Number(merged.unit_price) || 0
      return { ...merged, quantity, unit_price, total: Math.round(quantity * unit_price * 100) / 100 }
    })
    onChange(normalizeLineItems(next))
  }

  const addItem = () => {
    onChange([...items, { description: '', quantity: 1, unit_price: 0, total: 0 }])
  }

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
  }

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0)

  return (
    <div className="space-y-3">
      <div className="rounded-lg border overflow-hidden">
        <div className="grid grid-cols-[1fr_80px_100px_100px_36px] gap-2 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
          <span>Description</span>
          <span>Qty</span>
          <span>Unit ({currency})</span>
          <span>Total</span>
          <span />
        </div>
        {items.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground text-center">No line items yet</p>
        ) : (
          items.map((item, index) => (
            <div
              key={index}
              className="grid grid-cols-[1fr_80px_100px_100px_36px] gap-2 px-3 py-2 border-t items-center"
            >
              <Input
                value={item.description}
                onChange={(e) => updateItem(index, { description: e.target.value })}
                placeholder="Item description"
                className="h-8"
              />
              <Input
                type="number"
                min="0"
                step="1"
                value={item.quantity || ''}
                onChange={(e) => updateItem(index, { quantity: parseFloat(e.target.value) || 0 })}
                className="h-8"
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                value={item.unit_price || ''}
                onChange={(e) => updateItem(index, { unit_price: parseFloat(e.target.value) || 0 })}
                className="h-8"
              />
              <span className="text-sm tabular-nums font-medium px-1">
                ${(item.quantity * item.unit_price).toFixed(2)}
              </span>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeItem(index)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))
        )}
      </div>
      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add line item
        </Button>
        <p className="text-sm text-muted-foreground">
          Subtotal: <span className="font-semibold text-foreground tabular-nums">${subtotal.toFixed(2)}</span>
        </p>
      </div>
    </div>
  )
}
