import { toDateKey } from '@/lib/due-date-utils'
"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ArrowLeft, Edit, Check, X, FileText, Calendar, DollarSign, Package, Loader2 } from "lucide-react"
import { purchaseOrders } from "@/lib/inventory-data"
import {
  getPurchaseOrder,
  updatePurchaseOrder,
  createPOLineItem,
  deletePOLineItem,
  getInventoryItems,
  receivePurchaseOrderLines,
  type InventoryItem,
} from "@/lib/inventory-api"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"
import type { PurchaseOrder as ApiPO } from "@/lib/inventory-api"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import {
  PoLineItemsEditor,
  newPoLineDraft,
  type PoLineDraft,
} from "@/components/inventory/po-line-items-editor"

interface PurchaseOrderDetailProps {
  poId: string
}

function mapApiPoToDisplay(api: ApiPO) {
  return {
    id: api.id,
    poNumber: api.po_number,
    supplier: api.supplier_name ?? "",
    status: api.status,
    total: api.total ?? 0,
    createdDate: api.created_date ? new Date(api.created_date) : new Date(),
    expectedDate: api.expected_date ? new Date(api.expected_date) : undefined,
    lineItems: (api.line_items ?? []).map((li) => ({
      id: li.id,
      itemId: li.item_id ?? "",
      sku: li.sku,
      productName: li.product_name,
      quantity: li.quantity,
      receivedQty: li.received_qty ?? 0,
      unitCost: li.unit_cost ?? 0,
      total: li.total ?? li.quantity * li.unit_cost,
    })),
    notes: api.notes ?? "",
  }
}

export function PurchaseOrderDetail({ poId }: PurchaseOrderDetailProps) {
  const [apiPo, setApiPo] = useState<ReturnType<typeof mapApiPoToDisplay> | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [updating, setUpdating] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [linesEditOpen, setLinesEditOpen] = useState(false)
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [editForm, setEditForm] = useState({ supplier_name: "", expected_date: "", notes: "" })
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [newLines, setNewLines] = useState<PoLineDraft[]>([])
  const [receiveQtys, setReceiveQtys] = useState<Record<string, string>>({})

  const mockPo = purchaseOrders.find((p) => p.id === poId)
  const po = apiPo ?? mockPo ?? null

  const loadPo = useCallback(() => {
    if (!isSupabaseConfigured) return
    getPurchaseOrder(poId).then((data) => {
      setApiPo(data ? mapApiPoToDisplay(data) : null)
    })
  }, [poId])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    let cancelled = false
    getPurchaseOrder(poId).then((data) => {
      if (cancelled) return
      setApiPo(data ? mapApiPoToDisplay(data) : null)
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    void getInventoryItems().then(setInventoryItems)
    return () => { cancelled = true }
  }, [poId])

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!po) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <p>Purchase order not found</p>
        </div>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-gray-500/10 text-gray-600 border-gray-500/20"
      case "open":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20"
      case "pending":
        return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
      case "received":
        return "bg-green-500/10 text-green-600 border-green-500/20"
      case "cancelled":
        return "bg-red-500/10 text-red-600 border-red-500/20"
      default:
        return "bg-gray-500/10 text-gray-600 border-gray-500/20"
    }
  }

  const totalReceived = po.lineItems.reduce((sum, item) => sum + item.receivedQty, 0)
  const totalOrdered = po.lineItems.reduce((sum, item) => sum + item.quantity, 0)
  const receiveProgress = totalOrdered > 0 ? (totalReceived / totalOrdered) * 100 : 0
  const canReceive = po.status === "open" || po.status === "pending"
  const canEditLines = po.status === "draft"

  const handleApprove = async () => {
    if (!isSupabaseConfigured || updating) return
    if (po.lineItems.length === 0) {
      toast.error("Add line items before approving")
      return
    }
    setUpdating(true)
    try {
      await updatePurchaseOrder(poId, { status: "open" })
      loadPo()
      toast.success("Purchase order approved")
    } catch (err) {
      toast.error("Failed to approve", { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setUpdating(false)
    }
  }

  const handleEditOpen = () => {
    setEditForm({
      supplier_name: po.supplier,
      expected_date: po.expectedDate ? toDateKey(po.expectedDate) : "",
      notes: apiPo?.notes ?? "",
    })
    setEditOpen(true)
  }

  const handleEditSave = async () => {
    if (!isSupabaseConfigured || updating) return
    setUpdating(true)
    try {
      await updatePurchaseOrder(poId, {
        supplier_name: editForm.supplier_name.trim() || "",
        expected_date: editForm.expected_date || null,
        notes: editForm.notes.trim() || null,
      })
      loadPo()
      setEditOpen(false)
      toast.success("Purchase order updated")
    } catch (err) {
      toast.error("Failed to update", { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setUpdating(false)
    }
  }

  const handleCancelConfirm = async () => {
    if (!isSupabaseConfigured || updating) return
    setUpdating(true)
    try {
      await updatePurchaseOrder(poId, { status: "cancelled" })
      loadPo()
      setCancelConfirmOpen(false)
      toast.success("Purchase order cancelled")
    } catch (err) {
      toast.error("Failed to cancel", { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setUpdating(false)
    }
  }

  const openLinesEditor = () => {
    setNewLines([newPoLineDraft()])
    setLinesEditOpen(true)
  }

  const handleAddLines = async () => {
    const valid = newLines.filter((l) => l.sku && l.product_name && l.quantity > 0)
    if (valid.length === 0) {
      toast.error("Add at least one valid line item")
      return
    }
    setUpdating(true)
    try {
      for (const line of valid) {
        await createPOLineItem({
          po_id: poId,
          item_id: line.item_id,
          sku: line.sku,
          product_name: line.product_name,
          quantity: line.quantity,
          received_qty: 0,
          unit_cost: line.unit_cost,
        })
      }
      setLinesEditOpen(false)
      loadPo()
      toast.success("Line items added")
    } catch (err) {
      toast.error("Failed to add lines", { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setUpdating(false)
    }
  }

  const openReceiveDialog = () => {
    const initial: Record<string, string> = {}
    for (const li of po.lineItems) {
      const remaining = li.quantity - li.receivedQty
      if (remaining > 0) initial[li.id] = String(remaining)
    }
    setReceiveQtys(initial)
    setReceiveOpen(true)
  }

  const handleReceive = async () => {
    if (!isSupabaseConfigured || updating) return
    const lines = po.lineItems
      .map((li) => ({
        po_line_id: li.id,
        quantity: parseInt(receiveQtys[li.id] || "0", 10),
      }))
      .filter((l) => l.quantity > 0)

    if (lines.length === 0) {
      toast.error("Enter quantity to receive for at least one line")
      return
    }

    setUpdating(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const userName = user?.user_metadata?.full_name || user?.email || "Unknown User"
      await receivePurchaseOrderLines(poId, lines, userName)
      setReceiveOpen(false)
      loadPo()
      toast.success("Items received into inventory")
    } catch (err) {
      toast.error("Receive failed", { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/inventory/purchase-orders">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">{po.poNumber}</h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-sm text-muted-foreground">{po.supplier}</span>
                <span className="text-sm text-muted-foreground">•</span>
                <Badge className={getStatusColor(po.status)}>
                  {po.status.charAt(0).toUpperCase() + po.status.slice(1)}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {canReceive && (
              <Button onClick={openReceiveDialog} disabled={updating || po.lineItems.length === 0}>
                <Package className="w-4 h-4 mr-2" />
                Receive Items
              </Button>
            )}
            {canEditLines && (
              <Button variant="outline" onClick={openLinesEditor} disabled={updating}>
                Add Line Items
              </Button>
            )}
            {po.status === "draft" && (
              <Button onClick={handleApprove} disabled={updating || !isSupabaseConfigured}>
                {updating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                Approve
              </Button>
            )}
            {po.status !== "cancelled" && (
              <Button variant="outline" onClick={handleEditOpen} disabled={updating || !isSupabaseConfigured}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}
            {po.status !== "cancelled" && po.status !== "received" && (
              <Button variant="outline" onClick={() => setCancelConfirmOpen(true)} disabled={updating || !isSupabaseConfigured}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            )}
          </div>
        </div>

        {/* dialogs */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Edit purchase order</DialogTitle>
              <DialogDescription>Update supplier, expected date, or notes.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-supplier">Supplier name</Label>
                <Input
                  id="edit-supplier"
                  value={editForm.supplier_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, supplier_name: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-expected">Expected delivery date</Label>
                <Input
                  id="edit-expected"
                  type="date"
                  value={editForm.expected_date}
                  onChange={(e) => setEditForm((f) => ({ ...f, expected_date: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  value={editForm.notes}
                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={updating}>
                Cancel
              </Button>
              <Button onClick={handleEditSave} disabled={updating}>
                {updating ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={linesEditOpen} onOpenChange={setLinesEditOpen}>
          <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add line items</DialogTitle>
            </DialogHeader>
            <PoLineItemsEditor
              lines={newLines}
              onChange={setNewLines}
              inventoryItems={inventoryItems}
              disabled={updating}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setLinesEditOpen(false)} disabled={updating}>
                Cancel
              </Button>
              <Button onClick={handleAddLines} disabled={updating}>
                {updating ? "Saving…" : "Add lines"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>Receive against {po.poNumber}</DialogTitle>
              <DialogDescription>
                Enter quantities received. Stock and PO status update atomically.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {po.lineItems.map((li) => {
                const remaining = li.quantity - li.receivedQty
                if (remaining <= 0) return null
                return (
                  <div key={li.id} className="grid grid-cols-12 gap-2 items-center border rounded-lg p-3">
                    <div className="col-span-7">
                      <p className="font-medium text-sm">{li.productName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{li.sku}</p>
                      <p className="text-xs text-muted-foreground">
                        Ordered {li.quantity} · Received {li.receivedQty} · Remaining {remaining}
                      </p>
                    </div>
                    <div className="col-span-5">
                      <Label className="text-xs">Receive qty</Label>
                      <Input
                        type="number"
                        min={0}
                        max={remaining}
                        value={receiveQtys[li.id] ?? ""}
                        onChange={(e) =>
                          setReceiveQtys((prev) => ({ ...prev, [li.id]: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReceiveOpen(false)} disabled={updating}>
                Cancel
              </Button>
              <Button onClick={handleReceive} disabled={updating}>
                {updating ? "Receiving…" : "Confirm receive"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel purchase order?</AlertDialogTitle>
              <AlertDialogDescription>
                This will mark the purchase order as cancelled. You can still view it but it won’t be active.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={updating}>Keep</AlertDialogCancel>
              <AlertDialogAction onClick={handleCancelConfirm} disabled={updating} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {updating ? "Cancelling…" : "Cancel PO"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">PO Number</p>
                <p className="font-mono font-semibold">{po.poNumber}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-xl font-bold">${po.total.toFixed(2)}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="font-semibold">{po.createdDate.toLocaleDateString()}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Expected</p>
                <p className="font-semibold">{po.expectedDate ? po.expectedDate.toLocaleDateString() : "TBD"}</p>
              </div>
            </div>
          </Card>
        </div>

        {(canReceive || po.status === "received") && totalOrdered > 0 && (
          <Card className="p-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Receiving Progress</h3>
                <span className="text-sm text-muted-foreground">
                  {totalReceived} of {totalOrdered} items received
                </span>
              </div>
              <Progress value={receiveProgress} className="h-2" />
            </div>
          </Card>
        )}

        <Card className="p-6">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Line Items</h2>
            {po.lineItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No line items yet. Add items while in draft status.</p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-4 font-medium">SKU</th>
                      <th className="text-left p-4 font-medium">Product Name</th>
                      <th className="text-left p-4 font-medium">Quantity</th>
                      <th className="text-left p-4 font-medium">Received</th>
                      <th className="text-left p-4 font-medium">Unit Cost</th>
                      <th className="text-left p-4 font-medium">Total</th>
                      {canEditLines && <th className="p-4" />}
                    </tr>
                  </thead>
                  <tbody>
                    {po.lineItems.map((item) => (
                      <tr key={item.id} className="border-t hover:bg-muted/30 transition-colors">
                        <td className="p-4 font-mono text-sm">{item.sku}</td>
                        <td className="p-4">{item.productName}</td>
                        <td className="p-4 font-semibold">{item.quantity}</td>
                        <td className="p-4">
                          <span
                            className={`font-semibold ${item.receivedQty >= item.quantity ? "text-green-600" : "text-yellow-600"}`}
                          >
                            {item.receivedQty}
                          </span>
                        </td>
                        <td className="p-4">${item.unitCost.toFixed(2)}</td>
                        <td className="p-4 font-semibold">${item.total.toFixed(2)}</td>
                        {canEditLines && (
                          <td className="p-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={updating}
                              onClick={async () => {
                                setUpdating(true)
                                try {
                                  await deletePOLineItem(item.id)
                                  loadPo()
                                } finally {
                                  setUpdating(false)
                                }
                              }}
                            >
                              Remove
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/50 border-t-2">
                    <tr>
                      <td colSpan={canEditLines ? 6 : 5} className="p-4 text-right font-semibold">
                        Total:
                      </td>
                      <td className="p-4 font-bold text-lg">${po.total.toFixed(2)}</td>
                      {canEditLines && <td />}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Supplier Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Supplier Name</p>
              <p className="font-medium">{po.supplier}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge className={getStatusColor(po.status)}>
                {po.status.charAt(0).toUpperCase() + po.status.slice(1)}
              </Badge>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
