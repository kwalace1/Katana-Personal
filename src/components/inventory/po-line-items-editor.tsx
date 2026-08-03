"use client"

import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Trash2 } from "lucide-react"
import type { InventoryItem } from "@/lib/inventory-api"

export interface PoLineDraft {
  key: string
  item_id: string | null
  sku: string
  product_name: string
  quantity: number
  unit_cost: number
}

interface PoLineItemsEditorProps {
  lines: PoLineDraft[]
  onChange: (lines: PoLineDraft[]) => void
  inventoryItems: InventoryItem[]
  disabled?: boolean
}

export function newPoLineDraft(partial?: Partial<PoLineDraft>): PoLineDraft {
  return {
    key: crypto.randomUUID(),
    item_id: null,
    sku: "",
    product_name: "",
    quantity: 1,
    unit_cost: 0,
    ...partial,
  }
}

export function PoLineItemsEditor({
  lines,
  onChange,
  inventoryItems,
  disabled,
}: PoLineItemsEditorProps) {
  const lineTotal = useMemo(
    () => lines.reduce((sum, l) => sum + l.quantity * l.unit_cost, 0),
    [lines],
  )

  const updateLine = (key: string, patch: Partial<PoLineDraft>) => {
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  const pickItem = (key: string, itemId: string) => {
    const item = inventoryItems.find((i) => i.id === itemId)
    if (!item) return
    updateLine(key, {
      item_id: item.id,
      sku: item.sku,
      product_name: item.product_name,
      unit_cost: item.unit_cost ?? 0,
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Line items</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onChange([...lines, newPoLineDraft()])}
        >
          <Plus className="w-4 h-4 mr-1" />
          Add line
        </Button>
      </div>

      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">No line items yet.</p>
      ) : (
        <div className="space-y-3">
          {lines.map((line) => (
            <div key={line.key} className="grid grid-cols-12 gap-2 items-end border rounded-lg p-3">
              <div className="col-span-12 sm:col-span-4 space-y-1">
                <Label className="text-xs">Item</Label>
                <Select
                  value={line.item_id ?? ""}
                  onValueChange={(v) => pickItem(line.key, v)}
                  disabled={disabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select SKU…" />
                  </SelectTrigger>
                  <SelectContent>
                    {inventoryItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.sku} — {item.product_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-4 sm:col-span-2 space-y-1">
                <Label className="text-xs">Qty</Label>
                <Input
                  type="number"
                  min={1}
                  value={line.quantity}
                  disabled={disabled}
                  onChange={(e) =>
                    updateLine(line.key, { quantity: Math.max(1, parseInt(e.target.value) || 1) })
                  }
                />
              </div>
              <div className="col-span-4 sm:col-span-2 space-y-1">
                <Label className="text-xs">Unit cost</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={line.unit_cost}
                  disabled={disabled}
                  onChange={(e) =>
                    updateLine(line.key, { unit_cost: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="col-span-3 sm:col-span-3 text-sm font-medium pb-2">
                ${(line.quantity * line.unit_cost).toFixed(2)}
              </div>
              <div className="col-span-1 flex justify-end pb-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={disabled}
                  onClick={() => onChange(lines.filter((l) => l.key !== line.key))}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-right text-sm font-semibold">
        Estimated total: ${lineTotal.toFixed(2)}
      </div>
    </div>
  )
}
