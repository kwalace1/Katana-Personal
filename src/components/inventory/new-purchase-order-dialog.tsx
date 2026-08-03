import { getTodayDateKey } from '@/lib/due-date-utils'
"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  createPurchaseOrder,
  generatePONumber,
  getInventoryItems,
  getSuppliers,
  type InventoryItem,
  type Supplier,
} from "@/lib/inventory-api"
import { isSupabaseConfigured } from "@/lib/supabase"
import { toast } from "sonner"
import {
  PoLineItemsEditor,
  newPoLineDraft,
  type PoLineDraft,
} from "@/components/inventory/po-line-items-editor"

export interface NewPurchaseOrderFormData {
  supplier_id: string
  supplier_name: string
  expected_date: string
  notes: string
}

interface NewPurchaseOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (createdId: string) => void
  /** Pre-fill lines (e.g. from reorder suggestions) */
  initialLines?: PoLineDraft[]
  initialSupplierName?: string
}

const defaultForm: NewPurchaseOrderFormData = {
  supplier_id: "",
  supplier_name: "",
  expected_date: "",
  notes: "",
}

export function NewPurchaseOrderDialog({
  open,
  onOpenChange,
  onSuccess,
  initialLines,
  initialSupplierName,
}: NewPurchaseOrderDialogProps) {
  const [formData, setFormData] = useState<NewPurchaseOrderFormData>(defaultForm)
  const [lines, setLines] = useState<PoLineDraft[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !isSupabaseConfigured) return
    void Promise.all([getSuppliers(), getInventoryItems()]).then(([s, items]) => {
      setSuppliers(s)
      setInventoryItems(items)
    })
    if (initialLines?.length) {
      setLines(initialLines)
    } else {
      setLines([newPoLineDraft()])
    }
    if (initialSupplierName) {
      setFormData((f) => ({ ...f, supplier_name: initialSupplierName }))
    }
  }, [open, initialLines, initialSupplierName])

  const lineTotal = lines.reduce((sum, l) => sum + l.quantity * l.unit_cost, 0)

  const handleSupplierPick = (supplierId: string) => {
    const supplier = suppliers.find((s) => s.id === supplierId)
    setFormData((f) => ({
      ...f,
      supplier_id: supplierId,
      supplier_name: supplier?.name ?? f.supplier_name,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSupabaseConfigured) {
      toast.error("Database is not configured")
      return
    }

    const validLines = lines.filter((l) => l.sku && l.product_name && l.quantity > 0)
    if (validLines.length === 0) {
      toast.error("Add at least one line item with a SKU and quantity")
      return
    }

    setSaving(true)
    try {
      const poNumber = await generatePONumber()
      const created = await createPurchaseOrder(
        {
          po_number: poNumber,
          supplier_id: formData.supplier_id || null,
          supplier_name: formData.supplier_name.trim() || "Unassigned supplier",
          status: "draft",
          total: lineTotal,
          notes: formData.notes.trim() || null,
          created_date: getTodayDateKey(),
          expected_date: formData.expected_date || null,
          received_date: null,
          created_by: null,
        },
        validLines.map((l) => ({
          item_id: l.item_id,
          sku: l.sku,
          product_name: l.product_name,
          quantity: l.quantity,
          received_qty: 0,
          unit_cost: l.unit_cost,
        })),
      )
      if (created?.id) {
        toast.success("Purchase order created")
        setFormData(defaultForm)
        setLines([newPoLineDraft()])
        onOpenChange(false)
        onSuccess(created.id)
      } else {
        toast.error("Could not create purchase order")
      }
    } catch (err) {
      toast.error("Failed to create purchase order", {
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Purchase Order</DialogTitle>
          <DialogDescription>
            Add supplier details and line items. The PO is saved as a draft until approved.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Supplier</Label>
              {suppliers.length > 0 ? (
                <Select value={formData.supplier_id} onValueChange={handleSupplierPick}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier…" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              <Input
                placeholder="Supplier name"
                value={formData.supplier_name}
                onChange={(e) =>
                  setFormData({ ...formData, supplier_name: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="expected_date">Expected delivery date</Label>
              <Input
                id="expected_date"
                type="date"
                value={formData.expected_date}
                onChange={(e) =>
                  setFormData({ ...formData, expected_date: e.target.value })
                }
              />
            </div>
            <PoLineItemsEditor
              lines={lines}
              onChange={setLines}
              inventoryItems={inventoryItems}
              disabled={saving}
            />
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create purchase order"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
