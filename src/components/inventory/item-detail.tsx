import { formatDateOnly } from '@/lib/due-date-utils'
"use client"
import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Edit, ArrowDown, ArrowUp, Package, DollarSign, MapPin, TrendingUp, Calendar, Upload, Loader2, SlidersHorizontal, X } from "lucide-react"
import { 
  getInventoryItem, 
  getInventoryMovements, 
  updateInventoryItem,
  performScanIn,
  performCheckOut,
  performAdjustment,
  getItemAllocations,
  createInventoryAllocation,
  cancelInventoryAllocation,
  getSuppliers,
  uploadInventoryItemImage,
  type InventoryItem, 
  type InventoryMovement,
  type InventoryAllocation,
  type Supplier,
} from "@/lib/inventory-api"
import { getAvailableQty } from "@/lib/inventory-utils"
import {
  InventoryShell,
  InventoryContent,
  InventoryStatusBadge,
} from "@/components/inventory/InventoryUi"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { ModuleCustomizeControls, ModuleCustomizeHint } from "@/components/module-layout/ModuleCustomizeBar"
import { ModuleWidgetCanvas } from "@/components/module-layout/ModuleWidgetCanvas"
import { WidgetCatalogDialog } from "@/components/module-layout/WidgetCatalogDialog"
import { useModuleWidgetLayout } from "@/hooks/useModuleWidgetLayout"
import {
  INVENTORY_ITEM_DETAIL_SURFACE,
  INVENTORY_ITEM_DETAIL_WIDGET_CATALOG,
  INVENTORY_MODULE_ID,
  inventoryItemDetailWidgetLayoutToBase,
  normalizeInventoryItemDetailWidgetLayout,
} from "@/lib/inventory/inventory-widget-layout"

interface ItemDetailProps {
  itemId: string
}

export function ItemDetail({ itemId }: ItemDetailProps) {
  const [item, setItem] = useState<InventoryItem | null>(null)
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [allocations, setAllocations] = useState<InventoryAllocation[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  
  // Dialog states
  const [isScanInOpen, setIsScanInOpen] = useState(false)
  const [isScanOutOpen, setIsScanOutOpen] = useState(false)
  const [isAdjustOpen, setIsAdjustOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [isAllocateOpen, setIsAllocateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Form states
  const [scanInQty, setScanInQty] = useState('')
  const [scanInReason, setScanInReason] = useState('')
  const [scanInReference, setScanInReference] = useState('')
  const [scanOutQty, setScanOutQty] = useState('')
  const [scanOutReason, setScanOutReason] = useState('')
  const [scanOutReference, setScanOutReference] = useState('')
  
  // Edit form states
  const [editName, setEditName] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editMinQty, setEditMinQty] = useState('')
  const [editReorderQty, setEditReorderQty] = useState('')
  const [editUnitCost, setEditUnitCost] = useState('')
  const [editSupplierId, setEditSupplierId] = useState('')
  const [editCategory, setEditCategory] = useState('')

  const [adjustQty, setAdjustQty] = useState('')
  const [adjustDirection, setAdjustDirection] = useState<'increase' | 'decrease'>('increase')
  const [adjustReason, setAdjustReason] = useState('Inventory Adjustment')
  const [adjustReference, setAdjustReference] = useState('')

  const [allocateQty, setAllocateQty] = useState('')
  const [allocateLabel, setAllocateLabel] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const {
    layout: detailLayout,
    isCustomizeMode,
    enterCustomize,
    saveAndExit,
    onLayoutChange,
    addWidget,
    removeWidget,
    availableWidgets,
    resetToDefault,
  } = useModuleWidgetLayout({
    moduleId: INVENTORY_MODULE_ID,
    surfaceId: INVENTORY_ITEM_DETAIL_SURFACE,
    catalog: INVENTORY_ITEM_DETAIL_WIDGET_CATALOG,
    normalize: normalizeInventoryItemDetailWidgetLayout,
    toBase: inventoryItemDetailWidgetLayoutToBase,
    successMessage: 'Item detail layout saved',
  })

  useEffect(() => {
    fetchItemData()
    void getSuppliers().then(setSuppliers).catch(console.error)
  }, [itemId])

  useEffect(() => {
    if (item) {
      setEditName(item.product_name || '')
      setEditLocation(item.location || '')
      setEditMinQty(item.min_qty?.toString() || '')
      setEditReorderQty(item.reorder_qty?.toString() || '')
      setEditUnitCost(item.unit_cost?.toString() || '')
      setEditSupplierId(item.supplier_id || '')
      setEditCategory(item.category || '')
    }
  }, [item])

  const getUserName = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    return user?.user_metadata?.full_name || user?.email || 'Unknown User'
  }

  const fetchItemData = async () => {
    setLoading(true)
    try {
      const [itemData, movementsData, allocationsData] = await Promise.all([
        getInventoryItem(itemId),
        getInventoryMovements(itemId),
        getItemAllocations(itemId),
      ])
      setItem(itemData)
      setMovements(movementsData)
      setAllocations(allocationsData)
    } catch (error) {
      console.error('Error fetching item data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Handler functions
  const handleScanIn = async () => {
    if (!scanInQty || !scanInReason || !item) {
      alert("Please fill in quantity and reason")
      return
    }

    setSaving(true)
    try {
      const userName = await getUserName()
      const qty = parseInt(scanInQty, 10)
      const isAdjustment = scanInReason === 'Inventory Adjustment'

      const result = isAdjustment
        ? await performAdjustment(item.id, qty, {
            reason: scanInReason,
            reference: scanInReference || undefined,
            userName,
          })
        : await performScanIn(item.id, qty, {
            reference: scanInReference || undefined,
            userName,
            reason: scanInReason,
          })

      if (result.success && result.item) {
        setItem(result.item)
        await fetchItemData() // Refresh movements
        
        // Reset form
        setScanInQty('')
        setScanInReason('')
        setScanInReference('')
        setIsScanInOpen(false)
      } else {
        alert(result.error || 'Failed to scan in')
      }
    } catch (error) {
      console.error('Error scanning in:', error)
      alert('Failed to scan in')
    } finally {
      setSaving(false)
    }
  }

  const handleScanOut = async () => {
    if (!scanOutQty || !scanOutReason || !item) {
      alert("Please fill in quantity and reason")
      return
    }

    const qty = parseInt(scanOutQty, 10)
    const available = getAvailableQty(item)
    if (qty > available) {
      alert(`Cannot scan out more than available quantity (${available} available, ${item.allocated} allocated)`)
      return
    }

    setSaving(true)
    try {
      const userName = await getUserName()
      const isAdjustment = scanOutReason === 'Inventory Adjustment'

      const result = isAdjustment
        ? await performAdjustment(item.id, -qty, {
            reason: scanOutReason,
            reference: scanOutReference || undefined,
            userName,
          })
        : await performCheckOut({
            itemId: item.id,
            quantity: qty,
            options: {
              reference: scanOutReference || undefined,
              userName,
              reason: scanOutReason,
            },
          })

      if (result.success && result.item) {
        setItem(result.item)
        await fetchItemData() // Refresh movements
        
        // Reset form
        setScanOutQty('')
        setScanOutReason('')
        setScanOutReference('')
        setIsScanOutOpen(false)
      } else {
        alert(result.error || 'Failed to scan out')
      }
    } catch (error) {
      console.error('Error scanning out:', error)
      alert('Failed to scan out')
    } finally {
      setSaving(false)
    }
  }

  const handleEditItem = async () => {
    if (!editName || !editLocation || !editMinQty || !editUnitCost || !item) {
      alert("Please fill in all required fields")
      return
    }

    setSaving(true)
    try {
      const selectedSupplier = suppliers.find((s) => s.id === editSupplierId)
      const updatedItem = await updateInventoryItem(item.id, {
        product_name: editName,
        location: editLocation,
        min_qty: parseInt(editMinQty),
        reorder_qty: parseInt(editReorderQty) || parseInt(editMinQty) * 2,
        unit_cost: parseFloat(editUnitCost),
        supplier_id: editSupplierId || null,
        supplier_name: selectedSupplier?.name ?? (item.supplier_name || null),
        category: editCategory || null,
      })

      if (updatedItem) {
        setItem(updatedItem)
        setIsEditOpen(false)
      } else {
        alert('Failed to update item')
      }
    } catch (error) {
      console.error('Error updating item:', error)
      alert('Failed to update item')
    } finally {
      setSaving(false)
    }
  }

  const handleAdjust = async () => {
    if (!adjustQty || !adjustReason || !item) {
      alert('Please fill in quantity and reason')
      return
    }
    const qty = parseInt(adjustQty, 10)
    if (!Number.isFinite(qty) || qty <= 0) {
      alert('Enter a valid quantity')
      return
    }
    const delta = adjustDirection === 'increase' ? qty : -qty

    setSaving(true)
    try {
      const userName = await getUserName()
      const result = await performAdjustment(item.id, delta, {
        reason: adjustReason,
        reference: adjustReference || undefined,
        userName,
      })
      if (result.success && result.item) {
        setItem(result.item)
        await fetchItemData()
        setAdjustQty('')
        setAdjustReference('')
        setIsAdjustOpen(false)
      } else {
        alert(result.error || 'Failed to adjust stock')
      }
    } catch (error) {
      console.error('Error adjusting stock:', error)
      alert('Failed to adjust stock')
    } finally {
      setSaving(false)
    }
  }

  const handleAllocate = async () => {
    if (!allocateQty || !allocateLabel || !item) {
      alert('Please fill in quantity and label')
      return
    }
    const qty = parseInt(allocateQty, 10)
    if (!Number.isFinite(qty) || qty <= 0) {
      alert('Enter a valid quantity')
      return
    }

    setSaving(true)
    try {
      await createInventoryAllocation({
        itemId: item.id,
        quantity: qty,
        referenceType: 'manual',
        referenceLabel: allocateLabel,
      })
      await fetchItemData()
      setAllocateQty('')
      setAllocateLabel('')
      setIsAllocateOpen(false)
    } catch (error) {
      console.error('Error creating allocation:', error)
      alert(error instanceof Error ? error.message : 'Failed to create allocation')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelAllocation = async (allocationId: string) => {
    setSaving(true)
    try {
      await cancelInventoryAllocation(allocationId)
      await fetchItemData()
    } catch (error) {
      console.error('Error cancelling allocation:', error)
      alert('Failed to cancel allocation')
    } finally {
      setSaving(false)
    }
  }

  const handleImageUpload = async (file: File) => {
    if (!item) return
    setUploadingImage(true)
    setUploadProgress(0)
    try {
      const updated = await uploadInventoryItemImage(item.id, file, setUploadProgress)
      if (updated) {
        setItem(updated)
        setImagePreview(updated.image_url)
        toast.success('Image uploaded')
        setIsUploadOpen(false)
      } else {
        toast.error('Upload failed')
      }
    } catch (err) {
      toast.error('Upload failed', {
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setUploadingImage(false)
      setUploadProgress(0)
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <Card className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Database Not Configured</h2>
            <p className="text-muted-foreground">
              Please configure your database to use this feature.
            </p>
          </Card>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Link to="/inventory">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <p className="text-muted-foreground">Item not found</p>
          </div>
        </div>
      </div>
    )
  }

  const availableQty = getAvailableQty(item)

  return (
    <InventoryShell>
      <InventoryContent>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
          <div className="flex items-start gap-3 min-w-0">
            <Link to="/inventory">
              <Button variant="outline" size="icon" className="shrink-0 rounded-xl h-10 w-10">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight truncate">{item.product_name}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="text-sm text-muted-foreground font-mono">{item.sku}</span>
                {item.location && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-sm text-muted-foreground">{item.location}</span>
                  </>
                )}
                <InventoryStatusBadge status={item.status} />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ModuleCustomizeControls
              customizeMode={isCustomizeMode}
              onEnterCustomize={enterCustomize}
              onDone={() => void saveAndExit()}
              dataTourCustomize="inventory-item-detail-customize"
            />
            <Dialog open={isScanInOpen} onOpenChange={setIsScanInOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <ArrowDown className="w-4 h-4 mr-2" />
                  Scan In
                </Button>
              </DialogTrigger>
            </Dialog>
            <Dialog open={isScanOutOpen} onOpenChange={setIsScanOutOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <ArrowUp className="w-4 h-4 mr-2" />
                  Scan Out
                </Button>
              </DialogTrigger>
            </Dialog>
            <Dialog open={isAdjustOpen} onOpenChange={setIsAdjustOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <SlidersHorizontal className="w-4 h-4 mr-2" />
                  Adjust
                </Button>
              </DialogTrigger>
            </Dialog>
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>
        </div>

        {isCustomizeMode ? (
          <div className="space-y-3 mb-6">
            <ModuleCustomizeHint surfaceLabel="item detail" />
            <div className="flex flex-wrap items-center gap-2">
              <WidgetCatalogDialog available={availableWidgets} onAdd={addWidget} />
              <Button type="button" variant="ghost" size="sm" onClick={resetToDefault}>
                Reset layout
              </Button>
            </div>
          </div>
        ) : null}

        <ModuleWidgetCanvas
          widgets={detailLayout.widgets}
          catalog={INVENTORY_ITEM_DETAIL_WIDGET_CATALOG}
          customizeMode={isCustomizeMode}
          onLayoutChange={onLayoutChange}
          onRemoveWidget={removeWidget}
          rowHeight={36}
          renderWidget={(widgetId) => {
            if (widgetId === 'stats') {
              return (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 h-full">
                  <Card className="p-4 border-l-[3px] border-l-sky-500/50 bg-card/80">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center">
                        <Package className="w-5 h-5 text-sky-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">On Hand</p>
                        <p className="text-2xl font-bold">{item.on_hand_qty}</p>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4 border-l-[3px] border-l-amber-500/50 bg-card/80">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Min Qty</p>
                        <p className="text-2xl font-bold">{item.min_qty}</p>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4 border-l-[3px] border-l-emerald-500/50 bg-card/80">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Unit Cost</p>
                        <p className="text-2xl font-bold">${item.unit_cost}</p>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4 border-l-[3px] border-l-violet-500/50 bg-card/80">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-violet-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Location</p>
                        <p className="text-lg font-bold font-mono">{item.location || 'N/A'}</p>
                      </div>
                    </div>
                  </Card>
                </div>
              )
            }

            if (widgetId === 'item_info') {
              return (
                <Card className="p-6 border-border/60 bg-card/80 h-full overflow-auto">
                  <h2 className="text-lg font-semibold mb-4">Item Information</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Supplier</p>
                      <p className="font-medium">{item.supplier_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Category</p>
                      <p className="font-medium">{item.category || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Barcode</p>
                      <p className="font-mono text-sm">{item.barcode || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Reorder Qty</p>
                      <p className="font-medium">{item.reorder_qty}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Allocated</p>
                      <p className="font-medium">{item.allocated}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Value</p>
                      <p className="font-medium">${item.total_value.toFixed(2)}</p>
                    </div>
                  </div>
                </Card>
              )
            }

            if (widgetId === 'allocations') {
              return (
                <Card className="p-6 border-border/60 bg-card/80 h-full overflow-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Allocations</h2>
                    <Dialog open={isAllocateOpen} onOpenChange={setIsAllocateOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">Reserve Stock</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Reserve Stock</DialogTitle>
                          <DialogDescription>
                            Allocate up to {availableQty} available units ({item.allocated} already reserved)
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="allocate-qty">Quantity *</Label>
                            <Input
                              id="allocate-qty"
                              type="number"
                              min="1"
                              max={availableQty}
                              value={allocateQty}
                              onChange={(e) => setAllocateQty(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label htmlFor="allocate-label">Reference Label *</Label>
                            <Input
                              id="allocate-label"
                              placeholder="Job, project, or note..."
                              value={allocateLabel}
                              onChange={(e) => setAllocateLabel(e.target.value)}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button className="flex-1" onClick={handleAllocate} disabled={saving}>
                              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reserve'}
                            </Button>
                            <Button variant="outline" onClick={() => setIsAllocateOpen(false)}>Cancel</Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  {allocations.length > 0 ? (
                    <div className="space-y-2">
                      {allocations.map((alloc) => (
                        <div key={alloc.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">{alloc.reference_label || 'Reserved'}</p>
                            <p className="text-sm text-muted-foreground">{alloc.quantity} units · {alloc.reference_type}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelAllocation(alloc.id)}
                            disabled={saving}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No active reservations</p>
                  )}
                </Card>
              )
            }

            if (widgetId === 'recent_movements') {
              return (
                <Card className="p-6 border-border/60 bg-card/80 h-full overflow-auto">
                  <h2 className="text-lg font-semibold mb-4">Recent Movements</h2>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-4 font-medium">Date</th>
                          <th className="text-left p-4 font-medium">Reason</th>
                          <th className="text-left p-4 font-medium">Change</th>
                          <th className="text-left p-4 font-medium">Reference</th>
                          <th className="text-left p-4 font-medium">User</th>
                        </tr>
                      </thead>
                      <tbody>
                        {movements.length > 0 ? (
                          movements.map((movement) => (
                            <tr key={movement.id} className="border-t hover:bg-muted/30 transition-colors">
                              <td className="p-4 text-sm">{formatDateOnly(movement.movement_date)}</td>
                              <td className="p-4">{movement.reason}</td>
                              <td className="p-4">
                                <span
                                  className={`font-semibold ${movement.change_qty > 0 ? "text-green-600" : "text-red-600"}`}
                                >
                                  {movement.change_qty > 0 ? "+" : ""}
                                  {movement.change_qty}
                                </span>
                              </td>
                              <td className="p-4 font-mono text-sm">{movement.reference || '-'}</td>
                              <td className="p-4 text-sm">{movement.user_name || '-'}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-muted-foreground">
                              No movements recorded
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )
            }

            if (widgetId === 'item_image') {
              return (
                <Card className="p-6 border-border/60 bg-card/80 overflow-hidden h-full overflow-y-auto">
                  <h3 className="font-semibold mb-4">Item Image</h3>
                  <div className="aspect-square rounded-xl overflow-hidden ring-1 ring-border/60 bg-gradient-to-br from-muted/80 to-muted/30 flex items-center justify-center">
                    {(imagePreview ?? item.image_url) ? (
                      <img
                        src={imagePreview ?? item.image_url ?? ''}
                        alt={item.product_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="w-16 h-16 text-muted-foreground/60" />
                    )}
                  </div>
                  <Dialog
                    open={isUploadOpen}
                    onOpenChange={(open) => {
                      setIsUploadOpen(open)
                      if (!open) setImagePreview(null)
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full mt-4 bg-transparent">
                        <Upload className="w-4 h-4 mr-2" />
                        {item.image_url ? 'Change Image' : 'Upload Image'}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Upload Item Image</DialogTitle>
                        <DialogDescription>Add or update image for {item.product_name}</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="image-upload">Select Image File</Label>
                          <Input
                            id="image-upload"
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            disabled={uploadingImage}
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (!file) return
                              setImagePreview(URL.createObjectURL(file))
                              void handleImageUpload(file)
                            }}
                          />
                        </div>
                        <div
                          className="text-center py-8 border-2 border-dashed border-border/60 rounded-xl bg-muted/20"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault()
                            const file = e.dataTransfer.files?.[0]
                            if (file && file.type.startsWith('image/')) {
                              setImagePreview(URL.createObjectURL(file))
                              void handleImageUpload(file)
                            }
                          }}
                        >
                          {uploadingImage ? (
                            <>
                              <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-primary" />
                              <p className="text-sm text-muted-foreground">Uploading… {uploadProgress}%</p>
                            </>
                          ) : (
                            <>
                              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                              <p className="text-sm text-muted-foreground">
                                Drag and drop an image here, or use the file picker above
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                JPG, PNG, WebP, or GIF up to 5MB
                              </p>
                            </>
                          )}
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => setIsUploadOpen(false)}
                            disabled={uploadingImage}
                          >
                            {uploadingImage ? 'Uploading…' : 'Close'}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </Card>
              )
            }

            if (widgetId === 'quick_stats') {
              return (
                <Card className="p-6 h-full overflow-auto">
                  <h3 className="font-semibold mb-4">Quick Stats</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Available</span>
                      <span className="font-semibold">{item.on_hand_qty - item.allocated}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Allocated</span>
                      <span className="font-semibold">{item.allocated}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Reorder Point</span>
                      <span className="font-semibold">{item.min_qty}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Reorder Qty</span>
                      <span className="font-semibold">{item.reorder_qty}</span>
                    </div>
                    <div className="pt-4 border-t">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Total Value</span>
                        <span className="text-lg font-bold">${item.total_value.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            }

            if (widgetId === 'last_movement') {
              return item.last_movement_at ? (
                <Card className="p-6 h-full">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Last Movement</p>
                      <p className="font-medium">{formatDateOnly(item.last_movement_at)}</p>
                    </div>
                  </div>
                </Card>
              ) : (
                <Card className="p-6 h-full flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">No movements recorded yet</p>
                </Card>
              )
            }

            return null
          }}
        />

        {/* Scan In Dialog */}
        <Dialog open={isScanInOpen} onOpenChange={setIsScanInOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Scan In Inventory</DialogTitle>
              <DialogDescription>Add stock to {item.product_name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="scan-in-qty">Quantity to Add *</Label>
                <Input 
                  id="scan-in-qty"
                  type="number"
                  placeholder="Enter quantity"
                  value={scanInQty}
                  onChange={(e) => setScanInQty(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="scan-in-reason">Reason *</Label>
                <Select value={scanInReason} onValueChange={setScanInReason}>
                  <SelectTrigger id="scan-in-reason">
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Purchase Order Received">Purchase Order Received</SelectItem>
                    <SelectItem value="Return from Customer">Return from Customer</SelectItem>
                    <SelectItem value="Manufacturing Completion">Manufacturing Completion</SelectItem>
                    <SelectItem value="Inventory Adjustment">Inventory Adjustment</SelectItem>
                    <SelectItem value="Transfer In">Transfer In</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="scan-in-reference">Reference (Optional)</Label>
                <Input 
                  id="scan-in-reference"
                  placeholder="PO number, receipt, etc."
                  value={scanInReference}
                  onChange={(e) => setScanInReference(e.target.value)}
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button className="flex-1" onClick={handleScanIn} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <ArrowDown className="w-4 h-4 mr-2" />
                      Scan In Stock
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => {
                  setIsScanInOpen(false)
                  setScanInQty('')
                  setScanInReason('')
                  setScanInReference('')
                }}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Scan Out Dialog */}
        <Dialog open={isScanOutOpen} onOpenChange={setIsScanOutOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Scan Out Inventory</DialogTitle>
              <DialogDescription>Remove stock from {item.product_name} (Available: {availableQty}, On hand: {item.on_hand_qty})</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="scan-out-qty">Quantity to Remove *</Label>
                <Input 
                  id="scan-out-qty"
                  type="number"
                  placeholder="Enter quantity"
                  max={availableQty}
                  value={scanOutQty}
                  onChange={(e) => setScanOutQty(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="scan-out-reason">Reason *</Label>
                <Select value={scanOutReason} onValueChange={setScanOutReason}>
                  <SelectTrigger id="scan-out-reason">
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Customer Order">Customer Order</SelectItem>
                    <SelectItem value="Manufacturing Use">Manufacturing Use</SelectItem>
                    <SelectItem value="Damaged/Defective">Damaged/Defective</SelectItem>
                    <SelectItem value="Transfer Out">Transfer Out</SelectItem>
                    <SelectItem value="Inventory Adjustment">Inventory Adjustment</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="scan-out-reference">Reference (Optional)</Label>
                <Input 
                  id="scan-out-reference"
                  placeholder="Order number, work order, etc."
                  value={scanOutReference}
                  onChange={(e) => setScanOutReference(e.target.value)}
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button className="flex-1" onClick={handleScanOut} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <ArrowUp className="w-4 h-4 mr-2" />
                      Scan Out Stock
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => {
                  setIsScanOutOpen(false)
                  setScanOutQty('')
                  setScanOutReason('')
                  setScanOutReference('')
                }}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Adjust Stock Dialog */}
        <Dialog open={isAdjustOpen} onOpenChange={setIsAdjustOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adjust Stock</DialogTitle>
              <DialogDescription>
                Record a stock correction for {item.product_name} (Available: {availableQty})
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Direction</Label>
                <Select value={adjustDirection} onValueChange={(v) => setAdjustDirection(v as 'increase' | 'decrease')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="increase">Increase stock</SelectItem>
                    <SelectItem value="decrease">Decrease stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="adjust-qty">Quantity *</Label>
                <Input
                  id="adjust-qty"
                  type="number"
                  min="1"
                  max={adjustDirection === 'decrease' ? availableQty : undefined}
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="adjust-reason">Reason *</Label>
                <Input
                  id="adjust-reason"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="adjust-reference">Reference (Optional)</Label>
                <Input
                  id="adjust-reference"
                  value={adjustReference}
                  onChange={(e) => setAdjustReference(e.target.value)}
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button className="flex-1" onClick={handleAdjust} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply Adjustment'}
                </Button>
                <Button variant="outline" onClick={() => setIsAdjustOpen(false)}>Cancel</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Item Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Item Details</DialogTitle>
              <DialogDescription>Update information for {item.sku}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-name">Product Name *</Label>
                  <Input 
                    id="edit-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-location">Location *</Label>
                  <Input 
                    id="edit-location"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="edit-min-qty">Min Quantity *</Label>
                  <Input 
                    id="edit-min-qty"
                    type="number"
                    value={editMinQty}
                    onChange={(e) => setEditMinQty(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-reorder-qty">Reorder Quantity</Label>
                  <Input 
                    id="edit-reorder-qty"
                    type="number"
                    value={editReorderQty}
                    onChange={(e) => setEditReorderQty(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-unit-cost">Unit Cost *</Label>
                  <Input 
                    id="edit-unit-cost"
                    type="number"
                    step="0.01"
                    value={editUnitCost}
                    onChange={(e) => setEditUnitCost(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-supplier">Supplier</Label>
                  <Select value={editSupplierId || 'none'} onValueChange={(v) => setEditSupplierId(v === 'none' ? '' : v)}>
                    <SelectTrigger id="edit-supplier">
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No supplier</SelectItem>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-category">Category</Label>
                  <Select value={editCategory} onValueChange={setEditCategory}>
                    <SelectTrigger id="edit-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Electronics">Electronics</SelectItem>
                      <SelectItem value="Tools">Tools</SelectItem>
                      <SelectItem value="Components">Components</SelectItem>
                      <SelectItem value="Raw Materials">Raw Materials</SelectItem>
                      <SelectItem value="Finished Goods">Finished Goods</SelectItem>
                      <SelectItem value="General">General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button className="flex-1" onClick={handleEditItem} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
                <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </InventoryContent>
    </InventoryShell>
  )
}
