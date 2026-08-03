import { formatDateOnly } from '@/lib/due-date-utils'
"use client"

import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Plus, ChevronLeft, ChevronRight, Loader2, ChevronUp, ChevronDown, ArrowUpDown, FileText } from "lucide-react"
import { getPurchaseOrders, type PurchaseOrder } from "@/lib/inventory-api"
import { isSupabaseConfigured } from "@/lib/supabase"
import { NewPurchaseOrderDialog } from "@/components/inventory/new-purchase-order-dialog"
import {
  InventoryShell,
  InventoryContent,
  InventorySubpageHeader,
  InventoryNotConfigured,
  InventorySection,
  InventoryTableWrap,
  InventoryTable,
  InventoryTableHead,
  InventoryTableTh,
  InventoryTableRow,
  InventoryTableTd,
  InventorySearchInput,
  InventoryEmptyState,
  PoStatusBadge,
} from "@/components/inventory/InventoryUi"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function PurchaseOrdersList() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [newPODialogOpen, setNewPODialogOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [sortBy, setSortBy] = useState<"status" | "po_number" | "created_date">("created_date")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  useEffect(() => {
    fetchPurchaseOrders()
  }, [])

  const fetchPurchaseOrders = async () => {
    setLoading(true)
    try {
      const data = await getPurchaseOrders()
      setPurchaseOrders(data)
    } catch (error) {
      console.error('Error fetching purchase orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredPOs = purchaseOrders.filter((po) => {
    const matchesSearch =
      po.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.supplier_name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || po.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const statusOrder: Record<string, number> = {
    draft: 0,
    open: 1,
    pending: 2,
    received: 3,
    cancelled: 4,
  }
  const sortedPOs = [...filteredPOs].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1
    if (sortBy === "status") {
      return mul * ((statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5))
    }
    if (sortBy === "po_number") {
      return mul * a.po_number.localeCompare(b.po_number)
    }
    if (sortBy === "created_date") {
      return mul * (new Date(a.created_date).getTime() - new Date(b.created_date).getTime())
    }
    return 0
  })

  const totalPages = Math.ceil(sortedPOs.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedPOs = sortedPOs.slice(startIndex, startIndex + itemsPerPage)

  const handleSort = (field: "status" | "po_number" | "created_date") => {
    if (sortBy === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setSortBy(field)
      setSortDir("asc")
    }
    setCurrentPage(1)
  }

  const SortHeader = ({
    field,
    children,
  }: {
    field: "status" | "po_number" | "created_date"
    children: React.ReactNode
  }) => (
    <InventoryTableTh>
      <button
        type="button"
        onClick={() => handleSort(field)}
        className="flex items-center gap-1 hover:text-foreground transition-colors normal-case tracking-normal font-semibold"
      >
        {children}
        {sortBy === field ? (
          sortDir === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </button>
    </InventoryTableTh>
  )

  if (!isSupabaseConfigured) {
    return <InventoryNotConfigured />
  }

  return (
    <InventoryShell>
      <InventoryContent>
        <InventorySubpageHeader
          icon={FileText}
          title="Purchase Orders"
          description="Manage and track purchase orders"
          actions={
            <Button size="sm" onClick={() => setNewPODialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Purchase Order
            </Button>
          }
        />

        <NewPurchaseOrderDialog
          open={newPODialogOpen}
          onOpenChange={setNewPODialogOpen}
          onSuccess={(createdId) => {
            fetchPurchaseOrders()
            navigate(`/inventory/purchase-orders/${createdId}`)
          }}
        />

        <InventorySection
          title="All Purchase Orders"
          description={`${sortedPOs.length} order${sortedPOs.length === 1 ? '' : 's'}`}
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1) }}>
                <SelectTrigger className="w-[140px] h-9 rounded-lg">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <InventorySearchInput
                value={searchQuery}
                onChange={(v) => { setSearchQuery(v); setCurrentPage(1) }}
                placeholder="Search PO or supplier…"
              />
            </div>
          }
        >
          <InventoryTableWrap>
            <InventoryTable>
              <InventoryTableHead>
                <tr>
                  <SortHeader field="po_number">PO Number</SortHeader>
                  <InventoryTableTh>Supplier</InventoryTableTh>
                  <SortHeader field="status">Status</SortHeader>
                  <InventoryTableTh>Total</InventoryTableTh>
                  <SortHeader field="created_date">Created</SortHeader>
                  <InventoryTableTh>Expected</InventoryTableTh>
                  <InventoryTableTh>Actions</InventoryTableTh>
                </tr>
              </InventoryTableHead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Loading purchase orders…</p>
                    </td>
                  </tr>
                ) : paginatedPOs.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <InventoryEmptyState
                        icon={FileText}
                        title={searchQuery || statusFilter !== "all" ? "No orders match" : "No purchase orders yet"}
                        description="Create a PO to start receiving stock."
                      />
                    </td>
                  </tr>
                ) : (
                  paginatedPOs.map((po) => (
                    <InventoryTableRow key={po.id}>
                      <InventoryTableTd className="font-mono text-xs">{po.po_number}</InventoryTableTd>
                      <InventoryTableTd className="font-medium">{po.supplier_name}</InventoryTableTd>
                      <InventoryTableTd>
                        <PoStatusBadge status={po.status} />
                      </InventoryTableTd>
                      <InventoryTableTd className="font-semibold tabular-nums">${po.total.toFixed(2)}</InventoryTableTd>
                      <InventoryTableTd className="text-muted-foreground">{formatDateOnly(po.created_date)}</InventoryTableTd>
                      <InventoryTableTd className="text-muted-foreground">{po.expected_date ? formatDateOnly(po.expected_date) : "—"}</InventoryTableTd>
                      <InventoryTableTd>
                        <Link to={`/inventory/purchase-orders/${po.id}`}>
                          <Button variant="ghost" size="sm" className="h-8">View</Button>
                        </Link>
                      </InventoryTableTd>
                    </InventoryTableRow>
                  ))
                )}
              </tbody>
            </InventoryTable>
          </InventoryTableWrap>

          {!loading && sortedPOs.length > 0 && (
            <div className="flex items-center justify-between pt-4 mt-2 border-t border-border/40">
              <p className="text-sm text-muted-foreground">
                Showing {startIndex + 1}–{Math.min(startIndex + itemsPerPage, sortedPOs.length)} of {sortedPOs.length}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-8" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm tabular-nums px-1">{currentPage} / {totalPages || 1}</span>
                <Button variant="outline" size="sm" className="h-8" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </InventorySection>
      </InventoryContent>
    </InventoryShell>
  )
}
