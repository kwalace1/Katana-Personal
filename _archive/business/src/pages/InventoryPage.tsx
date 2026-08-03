import { useState, useEffect } from 'react'
import { MotionPage } from '@/components/motion-page'
import { ModuleHelpButton } from '@/components/tour/module-help-button'
import { useModuleTour } from '@/components/tour/use-module-tour'
import { Link, useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Box,
  Plus,
  FileText,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Truck,
  Download,
  Upload,
  History,
  DollarSign,
  Package,
  Archive,
  RotateCcw,
  Warehouse,
} from 'lucide-react'
import { 
  getInventoryItems, 
  createInventoryItem, 
  getInventoryStats,
  getOpenPOCount,
  deleteInventoryItem,
  restoreInventoryItem,
  bulkImportInventoryItems,
  getSuppliers,
  type InventoryItem,
  type Supplier,
} from '@/lib/inventory-api'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { NewPurchaseOrderDialog } from '@/components/inventory/new-purchase-order-dialog'
import { ReorderSuggestionsCard } from '@/components/inventory/reorder-suggestions-card'
import { StockroomTeaserBanner } from '@/components/inventory/virtual-stockroom'
import {
  InventoryShell,
  InventoryContent,
  InventoryHubHeader,
  InventoryStatGrid,
  InventoryStatCard,
  InventoryQuickActionsGrid,
  InventoryQuickAction,
  InventorySection,
  InventoryTableWrap,
  InventoryTable,
  InventoryTableHead,
  InventoryTableTh,
  InventoryTableRow,
  InventoryTableTd,
  InventoryStatusBadge,
  InventorySearchInput,
  InventoryEmptyState,
  InventoryNotConfigured,
  InventoryViewToggle,
  formatCurrency,
} from '@/components/inventory/InventoryUi'
import { inventoryItemsToCsv, parseInventoryCsv, downloadCsv } from '@/lib/inventory-csv'
import { getTodayDateKey } from '@/lib/due-date-utils'
import { SwitchImportDivert } from '@/components/switch/switch-import-divert'
import { toast } from 'sonner'
import { ModuleCustomizeControls, ModuleCustomizeHint } from '@/components/module-layout/ModuleCustomizeBar'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import { WidgetCatalogDialog } from '@/components/module-layout/WidgetCatalogDialog'
import { useModuleWidgetLayout } from '@/hooks/useModuleWidgetLayout'
import {
  INVENTORY_CATALOG_SURFACE,
  INVENTORY_CATALOG_WIDGET_CATALOG,
  INVENTORY_MODULE_ID,
  inventoryCatalogWidgetLayoutToBase,
  normalizeInventoryCatalogWidgetLayout,
} from '@/lib/inventory/inventory-widget-layout'

export default function InventoryPage() {
  useModuleTour('inventory')
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const [isNewItemOpen, setIsNewItemOpen] = useState(false)
  const [newPODialogOpen, setNewPODialogOpen] = useState(false)
  const [newItemSku, setNewItemSku] = useState('')
  const [newItemName, setNewItemName] = useState('')
  const [newItemLocation, setNewItemLocation] = useState('')
  const [newItemQty, setNewItemQty] = useState('')
  const [newItemMinQty, setNewItemMinQty] = useState('')
  const [newItemReorderQty, setNewItemReorderQty] = useState('')
  const [newItemUnitCost, setNewItemUnitCost] = useState('')
  const [newItemSupplierId, setNewItemSupplierId] = useState('')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [newItemCategory, setNewItemCategory] = useState('')
  const [newItemBarcode, setNewItemBarcode] = useState('')
  
  const [statusFilter, setStatusFilter] = useState<'all' | 'in-stock' | 'low-stock' | 'out-of-stock'>('all')
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [stats, setStats] = useState({ totalItems: 0, lowStockItems: 0, outOfStockItems: 0, totalValue: 0 })
  const [openPOCount, setOpenPOCount] = useState(0)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [catalogView, setCatalogView] = useState<'active' | 'archived'>('active')
  const [restoring, setRestoring] = useState(false)

  const {
    layout: catalogLayout,
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
    surfaceId: INVENTORY_CATALOG_SURFACE,
    catalog: INVENTORY_CATALOG_WIDGET_CATALOG,
    normalize: normalizeInventoryCatalogWidgetLayout,
    toBase: inventoryCatalogWidgetLayoutToBase,
    successMessage: 'Inventory layout saved',
  })

  // Fetch data on mount + subscribe to realtime changes
  useEffect(() => {
    fetchData()

    if (!isSupabaseConfigured) return
    const channel = supabase
      .channel('inventory_items_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, () => {
        fetchData()
      })
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [catalogView])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [itemsData, statsData, poCount, suppliersData] = await Promise.all([
        getInventoryItems({ archivedOnly: catalogView === 'archived' }),
        getInventoryStats(),
        getOpenPOCount(),
        getSuppliers(),
      ])
      setItems(itemsData)
      setStats(statsData)
      setOpenPOCount(poCount)
      setSuppliers(suppliersData)
      setSelectedItems(new Set())
    } catch (error) {
      console.error('Error fetching inventory data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddItem = async () => {
    if (!newItemSku || !newItemName || !newItemLocation || !newItemQty || !newItemMinQty || !newItemUnitCost) {
      alert("Please fill in all required fields")
      return
    }

    setSaving(true)
    try {
      const qty = parseInt(newItemQty)
      const minQty = parseInt(newItemMinQty)
      const unitCost = parseFloat(newItemUnitCost)
      
      const status: 'in-stock' | 'low-stock' | 'out-of-stock' = 
        qty <= 0 ? 'out-of-stock' : qty <= minQty ? 'low-stock' : 'in-stock'

      const selectedSupplier = suppliers.find((s) => s.id === newItemSupplierId)

      const newItem = await createInventoryItem({
        sku: newItemSku,
        product_name: newItemName,
        location: newItemLocation,
        on_hand_qty: qty,
        min_qty: minQty,
        reorder_qty: parseInt(newItemReorderQty) || minQty * 2,
        unit_cost: unitCost,
        allocated: 0,
        supplier_id: newItemSupplierId || null,
        supplier_name: selectedSupplier?.name ?? null,
        status,
        barcode: newItemBarcode || null,
        image_url: null,
        category: newItemCategory || null,
        description: null,
        last_movement_at: null,
        is_active: true,
      })

      if (newItem) {
        setItems([...items, newItem])
        // Reset form
        resetForm()
        setIsNewItemOpen(false)
        // Refresh stats
        const newStats = await getInventoryStats()
        setStats(newStats)
      }
    } catch (error) {
      console.error('Error creating item:', error)
      const msg = error instanceof Error ? error.message : (error as { message?: string })?.message || 'Unknown error'
      alert(`Failed to create item: ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setNewItemSku('')
    setNewItemName('')
    setNewItemLocation('')
    setNewItemQty('')
    setNewItemMinQty('')
    setNewItemReorderQty('')
    setNewItemUnitCost('')
    setNewItemSupplierId('')
    setNewItemCategory('')
    setNewItemBarcode('')
  }

  const handleExportCsv = () => {
    downloadCsv(`inventory_export_${getTodayDateKey()}.csv`, inventoryItemsToCsv(items))
    toast.success('Inventory exported')
  }

  const handleImportCsv = async () => {
    const { rows, errors: parseErrors } = parseInventoryCsv(importText)
    if (rows.length === 0) {
      toast.error(parseErrors[0] ?? 'No valid rows found')
      return
    }
    setImporting(true)
    try {
      const result = await bulkImportInventoryItems(rows)
      await fetchData()
      setImportOpen(false)
      setImportText('')
      setImportFile(null)
      toast.success(`Import complete: ${result.created} created, ${result.updated} updated`, {
        description: [...parseErrors, ...result.errors].slice(0, 3).join('; ') || undefined,
      })
    } catch (err) {
      toast.error('Import failed', { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setImporting(false)
    }
  }

  const handleImportFile = (file: File) => {
    setImportFile(file)
    const reader = new FileReader()
    reader.onload = () => setImportText(String(reader.result ?? ''))
    reader.readAsText(file)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(paginatedItems.map(item => item.id))
      setSelectedItems(allIds)
    } else {
      setSelectedItems(new Set())
    }
  }

  const handleSelectItem = (itemId: string, checked: boolean) => {
    const newSelected = new Set(selectedItems)
    if (checked) {
      newSelected.add(itemId)
    } else {
      newSelected.delete(itemId)
    }
    setSelectedItems(newSelected)
  }

  const handleDeleteSelected = async () => {
    if (selectedItems.size === 0) return

    setDeleting(true)
    try {
      const deletePromises = Array.from(selectedItems).map(id => deleteInventoryItem(id))
      const results = await Promise.all(deletePromises)
      const successCount = results.filter(Boolean).length

      if (successCount > 0) {
        await fetchData()
        setSelectedItems(new Set())
        setIsDeleteDialogOpen(false)
        toast.success(`Archived ${successCount} item${successCount === 1 ? '' : 's'}`)
      } else {
        toast.error('Failed to archive items')
      }
    } catch (error) {
      console.error('Error deleting items:', error)
      toast.error('Failed to archive items')
    } finally {
      setDeleting(false)
    }
  }

  const handleRestoreSelected = async () => {
    if (selectedItems.size === 0) return

    setRestoring(true)
    try {
      const results = await Promise.all(Array.from(selectedItems).map((id) => restoreInventoryItem(id)))
      const successCount = results.filter(Boolean).length

      if (successCount > 0) {
        await fetchData()
        setSelectedItems(new Set())
        toast.success(`Restored ${successCount} item${successCount === 1 ? '' : 's'}`)
      } else {
        toast.error('Failed to restore items')
      }
    } catch (error) {
      console.error('Error restoring items:', error)
      toast.error('Failed to restore items')
    } finally {
      setRestoring(false)
    }
  }

  const filteredItems = items.filter(
    (item) => {
      const matchesSearch = item.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.barcode?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
        (item.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
        (item.location?.toLowerCase().includes(searchQuery.toLowerCase()) || false)
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter
      return matchesSearch && matchesStatus
    }
  )

  type SortField = 'sku' | 'product_name' | 'location' | 'on_hand_qty' | 'min_qty' | 'status'
  const [sortBy, setSortBy] = useState<SortField>('product_name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const sortedItems = [...filteredItems].sort((a, b) => {
    const mul = sortDir === 'asc' ? 1 : -1
    switch (sortBy) {
      case 'sku':
        return mul * (a.sku.localeCompare(b.sku))
      case 'product_name':
        return mul * (a.product_name.localeCompare(b.product_name))
      case 'location':
        return mul * ((a.location ?? '').localeCompare(b.location ?? ''))
      case 'on_hand_qty':
        return mul * (a.on_hand_qty - b.on_hand_qty)
      case 'min_qty':
        return mul * (a.min_qty - b.min_qty)
      case 'status': {
        const order = { 'out-of-stock': 0, 'low-stock': 1, 'in-stock': 2 }
        return mul * ((order[a.status as keyof typeof order] ?? 0) - (order[b.status as keyof typeof order] ?? 0))
      }
      default:
        return 0
    }
  })

  const totalPages = Math.ceil(sortedItems.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedItems = sortedItems.slice(startIndex, startIndex + itemsPerPage)

  const handleSort = (field: SortField) => {
    if (sortBy === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortBy(field)
      setSortDir('asc')
    }
    setCurrentPage(1)
  }

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <InventoryTableTh>
      <button
        type="button"
        onClick={() => handleSort(field)}
        className="flex items-center gap-1 hover:text-foreground transition-colors normal-case tracking-normal font-semibold"
      >
        {children}
        {sortBy === field ? (
          sortDir === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </button>
    </InventoryTableTh>
  )

  if (!isSupabaseConfigured) {
    return <InventoryNotConfigured title="Database Not Configured" />
  }

  return (
    <MotionPage subtle>
      <InventoryShell>
        <InventoryContent className="pb-10">
          <InventoryHubHeader
            icon={Box}
            title="Katana Inventory"
            description="Real-time stock management, receiving, and purchasing"
            actions={
              <>
                <ModuleHelpButton moduleId="inventory" />
                <ModuleCustomizeControls
                  customizeMode={isCustomizeMode}
                  onEnterCustomize={enterCustomize}
                  onDone={() => void saveAndExit()}
                  dataTourCustomize="inventory-customize"
                />
                <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={loading || items.length === 0}>
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
                <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  Import
                </Button>
                <Button size="sm" onClick={() => setIsNewItemOpen(true)} data-tour="inventory-add-item">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </>
            }
          />

          {isCustomizeMode ? (
            <div className="space-y-3 mb-6">
              <ModuleCustomizeHint surfaceLabel="Inventory hub" />
              <div className="flex flex-wrap items-center gap-2">
                <WidgetCatalogDialog available={availableWidgets} onAdd={addWidget} />
                <Button type="button" variant="ghost" size="sm" onClick={resetToDefault}>
                  Reset layout
                </Button>
              </div>
            </div>
          ) : null}

          <ModuleWidgetCanvas
            widgets={catalogLayout.widgets}
            catalog={INVENTORY_CATALOG_WIDGET_CATALOG}
            customizeMode={isCustomizeMode}
            onLayoutChange={onLayoutChange}
            onRemoveWidget={removeWidget}
            rowHeight={36}
            renderWidget={(widgetId) => {
              if (widgetId === 'stats') {
                return (
                  <InventoryStatGrid>
                    <InventoryStatCard icon={Package} label="Total Items" value={loading ? '–' : stats.totalItems} />
                    <InventoryStatCard
                      icon={AlertTriangle}
                      label="Low Stock"
                      value={loading ? '–' : stats.lowStockItems}
                      tone="warning"
                    />
                    <InventoryStatCard
                      icon={FileText}
                      label="Open POs"
                      value={loading ? '–' : openPOCount}
                      tone="info"
                      href="/inventory/purchase-orders"
                    />
                    <InventoryStatCard
                      icon={DollarSign}
                      label="Total Value"
                      value={loading ? '–' : formatCurrency(stats.totalValue)}
                      tone="value"
                    />
                  </InventoryStatGrid>
                )
              }

              if (widgetId === 'reorder_suggestions') {
                return (
                  <div className="h-full overflow-auto">
                    <ReorderSuggestionsCard />
                  </div>
                )
              }

              if (widgetId === 'stockroom_teaser') {
                return <StockroomTeaserBanner />
              }

              if (widgetId === 'quick_actions') {
                return (
                  <InventoryQuickActionsGrid>
                    <InventoryQuickAction
                      icon={FileText}
                      title="Open POs"
                      description="View purchase orders"
                      tone="blue"
                      href="/inventory/purchase-orders"
                    />
                    <InventoryQuickAction
                      icon={Plus}
                      title="New PO"
                      description="Create purchase order"
                      tone="blue"
                      data-tour="inventory-new-po"
                      onClick={() => {
                        if (!isSupabaseConfigured) navigate('/inventory/purchase-orders')
                        else setNewPODialogOpen(true)
                      }}
                    />
                    <InventoryQuickAction
                      icon={ArrowDown}
                      title="Scan-In"
                      description="Receive stock"
                      tone="green"
                      href="/inventory/scan-in"
                      data-tour="inventory-scan-in"
                    />
                    <InventoryQuickAction
                      icon={ArrowUp}
                      title="Check-Out"
                      description="Issue stock"
                      tone="orange"
                      href="/inventory/check-out"
                      data-tour="inventory-check-out"
                    />
                    <InventoryQuickAction
                      icon={Truck}
                      title="Suppliers"
                      description="Manage suppliers"
                      tone="purple"
                      href="/inventory/suppliers"
                      data-tour="inventory-suppliers"
                    />
                    <InventoryQuickAction
                      icon={History}
                      title="Transactions"
                      description="Movement history"
                      tone="slate"
                      href="/inventory/transactions"
                      data-tour="inventory-transactions"
                    />
                    <InventoryQuickAction
                      icon={Warehouse}
                      title="Stockroom"
                      description="Virtual warehouse floor"
                      tone="violet"
                      href="/inventory/stockroom"
                      data-tour="inventory-stockroom"
                    />
                  </InventoryQuickActionsGrid>
                )
              }

              if (widgetId === 'metric_total_items') {
                return (
                  <Card className="h-full p-4 flex flex-col justify-center">
                    <p className="text-xs text-muted-foreground">Total Items</p>
                    <p className="text-3xl font-bold tabular-nums mt-1">{loading ? '–' : stats.totalItems}</p>
                  </Card>
                )
              }

              if (widgetId === 'metric_low_stock') {
                return (
                  <Card className="h-full p-4 flex flex-col justify-center">
                    <p className="text-xs text-muted-foreground">Low Stock</p>
                    <p className="text-3xl font-bold tabular-nums mt-1">{loading ? '–' : stats.lowStockItems}</p>
                  </Card>
                )
              }

              if (widgetId === 'metric_open_pos') {
                return (
                  <Card className="h-full p-4 flex flex-col justify-center">
                    <p className="text-xs text-muted-foreground">Open POs</p>
                    <p className="text-3xl font-bold tabular-nums mt-1">{loading ? '–' : openPOCount}</p>
                  </Card>
                )
              }

              if (widgetId === 'metric_total_value') {
                return (
                  <Card className="h-full p-4 flex flex-col justify-center">
                    <p className="text-xs text-muted-foreground">Total Value</p>
                    <p className="text-3xl font-bold tabular-nums mt-1">{loading ? '–' : formatCurrency(stats.totalValue)}</p>
                  </Card>
                )
              }

              if (widgetId === 'items_catalog') {
                return (
                  <div className="h-full overflow-auto">
                    <InventorySection
                      title={catalogView === 'archived' ? 'Archived Items' : 'Inventory Items'}
                      description={
                        catalogView === 'archived'
                          ? `${sortedItems.length} archived SKU${sortedItems.length === 1 ? '' : 's'}`
                          : `${sortedItems.length} item${sortedItems.length === 1 ? '' : 's'} in catalog`
                      }
                      data-tour="inventory-items"
                      actions={
                        <div className="flex flex-wrap items-center gap-2" data-tour="inventory-search-filter">
                          <InventoryViewToggle
                            value={catalogView}
                            onChange={(v) => {
                              setCatalogView(v)
                              setCurrentPage(1)
                              setSelectedItems(new Set())
                            }}
                          />
                          {selectedItems.size > 0 && catalogView === 'active' && (
                            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                              <DialogTrigger asChild>
                                <Button variant="destructive" size="sm">
                                  <Archive className="w-4 h-4 mr-2" />
                                  Archive ({selectedItems.size})
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Archive Items</DialogTitle>
                                  <DialogDescription>
                                    Archive {selectedItems.size} item(s)? They will be hidden from the active catalog but can be restored later.
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="flex gap-2 pt-4">
                                  <Button
                                    variant="destructive"
                                    className="flex-1"
                                    onClick={handleDeleteSelected}
                                    disabled={deleting}
                                  >
                                    {deleting ? (
                                      <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Archiving…
                                      </>
                                    ) : (
                                      'Archive'
                                    )}
                                  </Button>
                                  <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={deleting}>
                                    Cancel
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                          {selectedItems.size > 0 && catalogView === 'archived' && (
                            <Button variant="outline" size="sm" onClick={() => void handleRestoreSelected()} disabled={restoring}>
                              {restoring ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <RotateCcw className="w-4 h-4 mr-2" />
                              )}
                              Restore ({selectedItems.size})
                            </Button>
                          )}
                          <InventorySearchInput
                            value={searchQuery}
                            onChange={(v) => { setSearchQuery(v); setCurrentPage(1) }}
                            placeholder="Search SKU, name, barcode…"
                          />
                          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as typeof statusFilter); setCurrentPage(1) }}>
                            <SelectTrigger className="w-36 h-9 rounded-lg">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Statuses</SelectItem>
                              <SelectItem value="in-stock">In Stock</SelectItem>
                              <SelectItem value="low-stock">Low Stock</SelectItem>
                              <SelectItem value="out-of-stock">Out of Stock</SelectItem>
                            </SelectContent>
                          </Select>
                          <Dialog open={isNewItemOpen} onOpenChange={setIsNewItemOpen}>
                            <DialogTrigger asChild>
                              {catalogView === 'active' && (
                                <Button size="sm">
                                  <Plus className="w-4 h-4 mr-2" />
                                  Add Item
                                </Button>
                              )}
                            </DialogTrigger>
                          </Dialog>
                        </div>
                      }
                    >
                      <InventoryTableWrap>
                        <InventoryTable>
                          <InventoryTableHead>
                            <tr>
                              <InventoryTableTh className="w-12">
                                <Checkbox
                                  checked={paginatedItems.length > 0 && paginatedItems.every((item) => selectedItems.has(item.id))}
                                  onCheckedChange={handleSelectAll}
                                  aria-label="Select all items"
                                />
                              </InventoryTableTh>
                              <SortHeader field="sku">SKU</SortHeader>
                              <SortHeader field="product_name">Product</SortHeader>
                              <SortHeader field="location">Location</SortHeader>
                              <SortHeader field="on_hand_qty">On Hand</SortHeader>
                              <SortHeader field="min_qty">Min</SortHeader>
                              <SortHeader field="status">Status</SortHeader>
                              <InventoryTableTh>Actions</InventoryTableTh>
                            </tr>
                          </InventoryTableHead>
                          <tbody>
                            {loading ? (
                              <tr>
                                <td colSpan={8} className="p-12 text-center">
                                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-muted-foreground" />
                                  <p className="text-sm text-muted-foreground">Loading inventory…</p>
                                </td>
                              </tr>
                            ) : paginatedItems.length === 0 ? (
                              <tr>
                                <td colSpan={8}>
                                  <InventoryEmptyState
                                    icon={catalogView === 'archived' ? Archive : Package}
                                    title={
                                      searchQuery
                                        ? 'No items match your search'
                                        : catalogView === 'archived'
                                          ? 'No archived items'
                                          : 'No inventory items yet'
                                    }
                                    description={
                                      searchQuery
                                        ? 'Try a different search term or filter.'
                                        : catalogView === 'archived'
                                          ? 'Archived SKUs will appear here when you archive them from the active catalog.'
                                          : 'Add your first SKU to start tracking stock.'
                                    }
                                    action={
                                      !searchQuery && catalogView === 'active' ? (
                                        <Button size="sm" onClick={() => setIsNewItemOpen(true)}>
                                          <Plus className="w-4 h-4 mr-2" />
                                          Add Item
                                        </Button>
                                      ) : undefined
                                    }
                                  />
                                </td>
                              </tr>
                            ) : (
                              paginatedItems.map((item) => (
                                <InventoryTableRow key={item.id}>
                                  <InventoryTableTd>
                                    <Checkbox
                                      checked={selectedItems.has(item.id)}
                                      onCheckedChange={(checked) => handleSelectItem(item.id, checked as boolean)}
                                      aria-label={`Select ${item.product_name}`}
                                    />
                                  </InventoryTableTd>
                                  <InventoryTableTd className="font-mono text-xs text-muted-foreground">{item.sku}</InventoryTableTd>
                                  <InventoryTableTd className="font-medium">
                                    <span className={catalogView === 'archived' ? 'text-muted-foreground' : undefined}>
                                      {item.product_name}
                                    </span>
                                    {catalogView === 'archived' && (
                                      <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                                        Archived
                                      </span>
                                    )}
                                  </InventoryTableTd>
                                  <InventoryTableTd className="font-mono text-xs">{item.location || '—'}</InventoryTableTd>
                                  <InventoryTableTd>
                                    <span className="font-semibold tabular-nums">{item.on_hand_qty}</span>
                                    {item.allocated > 0 && (
                                      <span className="text-xs text-muted-foreground ml-1">({item.allocated} alloc.)</span>
                                    )}
                                  </InventoryTableTd>
                                  <InventoryTableTd className="text-muted-foreground tabular-nums">{item.min_qty}</InventoryTableTd>
                                  <InventoryTableTd>
                                    <InventoryStatusBadge status={item.status} />
                                  </InventoryTableTd>
                                  <InventoryTableTd>
                                    <Link to={`/inventory/items/${item.id}`}>
                                      <Button variant="ghost" size="sm" className="h-8">
                                        View
                                      </Button>
                                    </Link>
                                  </InventoryTableTd>
                                </InventoryTableRow>
                              ))
                            )}
                          </tbody>
                        </InventoryTable>
                      </InventoryTableWrap>

                      {!loading && filteredItems.length > 0 && (
                        <div className="flex items-center justify-between pt-4 mt-2 border-t border-border/40">
                          <p className="text-sm text-muted-foreground">
                            Showing {startIndex + 1}–{Math.min(startIndex + itemsPerPage, sortedItems.length)} of {sortedItems.length}
                          </p>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" className="h-8" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                              <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <span className="text-sm tabular-nums px-1">
                              {currentPage} / {totalPages || 1}
                            </span>
                            <Button variant="outline" size="sm" className="h-8" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0}>
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </InventorySection>
                  </div>
                )
              }

              return null
            }}
          />

          <NewPurchaseOrderDialog
            open={newPODialogOpen}
            onOpenChange={setNewPODialogOpen}
            onSuccess={(createdId) => navigate(`/inventory/purchase-orders/${createdId}`)}
          />

        {/* New Item Dialog */}
        <Dialog open={isNewItemOpen} onOpenChange={setIsNewItemOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Item</DialogTitle>
              <DialogDescription>Create a new SKU in Katana Inventory</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="item-sku">SKU *</Label>
                  <Input 
                    id="item-sku"
                    placeholder="Enter SKU code"
                    value={newItemSku}
                    onChange={(e) => setNewItemSku(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="item-name">Product Name *</Label>
                  <Input 
                    id="item-name"
                    placeholder="Enter product name"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="item-location">Location *</Label>
                  <Input 
                    id="item-location"
                    placeholder="e.g., A1-B2-C3"
                    value={newItemLocation}
                    onChange={(e) => setNewItemLocation(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="item-category">Category</Label>
                  <Select value={newItemCategory} onValueChange={setNewItemCategory}>
                    <SelectTrigger id="item-category">
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
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="item-qty">Initial Quantity *</Label>
                  <Input 
                    id="item-qty"
                    type="number"
                    placeholder="0"
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="item-min-qty">Min Quantity *</Label>
                  <Input 
                    id="item-min-qty"
                    type="number"
                    placeholder="0"
                    value={newItemMinQty}
                    onChange={(e) => setNewItemMinQty(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="item-reorder-qty">Reorder Quantity</Label>
                  <Input 
                    id="item-reorder-qty"
                    type="number"
                    placeholder="Auto-calculated"
                    value={newItemReorderQty}
                    onChange={(e) => setNewItemReorderQty(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="item-unit-cost">Unit Cost *</Label>
                  <Input 
                    id="item-unit-cost"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newItemUnitCost}
                    onChange={(e) => setNewItemUnitCost(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="item-supplier">Supplier</Label>
                  <Select value={newItemSupplierId || 'none'} onValueChange={(v) => setNewItemSupplierId(v === 'none' ? '' : v)}>
                    <SelectTrigger id="item-supplier">
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
              </div>
              <div>
                <Label htmlFor="item-barcode">Barcode</Label>
                <Input 
                  id="item-barcode"
                  placeholder="Enter barcode (optional)"
                  value={newItemBarcode}
                  onChange={(e) => setNewItemBarcode(e.target.value)}
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button className="flex-1" onClick={handleAddItem} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Item'
                  )}
                </Button>
                <Button variant="outline" onClick={() => {
                  setIsNewItemOpen(false)
                  resetForm()
                }}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>Import inventory CSV</DialogTitle>
              <DialogDescription>
                Columns: sku, product_name, location, on_hand_qty, min_qty, reorder_qty, unit_cost, supplier_name, category, barcode, description.
                Existing SKUs are updated.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <Input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleImportFile(file)
                }}
              />
              <textarea
                className="w-full min-h-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Or paste CSV content here…"
                value={importText}
                onChange={(e) => {
                  setImportText(e.target.value)
                  if (!e.target.value.trim()) setImportFile(null)
                }}
              />
              <SwitchImportDivert
                module="inventory"
                entityType="inventory_item"
                sourceLabel="katana.inventory.csv_import"
                file={importFile}
                fileText={importText}
                fileName="inventory.csv"
                rows={
                  importText.trim()
                    ? parseInventoryCsv(importText).rows.map((r) => ({ ...r }))
                    : null
                }
                upsertKey="sku"
                disabled={!importText.trim() && !importFile}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setImportOpen(false)
                  setImportFile(null)
                }}
                disabled={importing}
              >
                Cancel
              </Button>
              <Button onClick={() => void handleImportCsv()} disabled={importing || !importText.trim()}>
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing…
                  </>
                ) : (
                  'Import'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </InventoryContent>
      </InventoryShell>
    </MotionPage>
  )
}
