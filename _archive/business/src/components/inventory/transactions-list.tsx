"use client"

import { useMemo, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, History, Loader2, X } from "lucide-react"
import { getInventoryTransactions, type InventoryTransaction } from "@/lib/inventory-api"
import { getTransactionTypeMeta } from "@/lib/inventory-utils"
import { isSupabaseConfigured } from "@/lib/supabase"
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
  InventoryEmptyState,
  InventoryFilterToolbar,
} from "@/components/inventory/InventoryUi"
import { Badge } from "@/components/ui/badge"
import { inventoryTransactionsToCsv, downloadCsv } from "@/lib/inventory-csv"
import { getTodayDateKey } from "@/lib/due-date-utils"
import { toast } from "sonner"

type TxTypeFilter = "all" | InventoryTransaction["type"]

export function TransactionsList() {
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 15
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<TxTypeFilter>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  useEffect(() => {
    void fetchTransactions()
  }, [])

  const fetchTransactions = async () => {
    setLoading(true)
    try {
      const data = await getInventoryTransactions()
      setTransactions(data)
    } catch (error) {
      console.error("Error fetching transactions:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const fromMs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null
    const toMs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null

    return transactions.filter((tx) => {
      if (typeFilter !== "all" && tx.type !== typeFilter) return false
      const txMs = new Date(tx.transaction_date).getTime()
      if (fromMs != null && txMs < fromMs) return false
      if (toMs != null && txMs > toMs) return false
      if (!q) return true
      return (
        tx.sku.toLowerCase().includes(q) ||
        tx.product_name.toLowerCase().includes(q) ||
        (tx.reference?.toLowerCase().includes(q) ?? false) ||
        (tx.user_name?.toLowerCase().includes(q) ?? false) ||
        (tx.notes?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [transactions, typeFilter, searchQuery, dateFrom, dateTo])

  const hasFilters = typeFilter !== "all" || searchQuery.trim() !== "" || dateFrom !== "" || dateTo !== ""

  const clearFilters = () => {
    setTypeFilter("all")
    setSearchQuery("")
    setDateFrom("")
    setDateTo("")
    setCurrentPage(1)
  }

  const handleExport = () => {
    if (filteredTransactions.length === 0) {
      toast.error("Nothing to export")
      return
    }
    downloadCsv(
      `inventory_transactions_${getTodayDateKey()}.csv`,
      inventoryTransactionsToCsv(filteredTransactions),
    )
    toast.success(`Exported ${filteredTransactions.length} transaction${filteredTransactions.length === 1 ? "" : "s"}`)
  }

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedTransactions = filteredTransactions.slice(startIndex, startIndex + itemsPerPage)

  if (!isSupabaseConfigured) {
    return <InventoryNotConfigured />
  }

  return (
    <InventoryShell>
      <InventoryContent>
        <InventorySubpageHeader
          icon={History}
          title="Transactions"
          description="Complete audit trail of stock movements"
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={loading || filteredTransactions.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          }
        />

        <InventorySection
          title="Movement History"
          description={`${filteredTransactions.length} of ${transactions.length} transaction${transactions.length === 1 ? "" : "s"}`}
        >
          <InventoryFilterToolbar className="mb-4">
            <Input
              placeholder="Search SKU, product, reference, user…"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="h-9 max-w-xs rounded-lg"
            />
            <Select
              value={typeFilter}
              onValueChange={(v) => {
                setTypeFilter(v as TxTypeFilter)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-40 h-9 rounded-lg">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="scan-in">Scan In</SelectItem>
                <SelectItem value="check-out">Check Out</SelectItem>
                <SelectItem value="adjustment">Adjustment</SelectItem>
                <SelectItem value="po-receive">PO Receive</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value)
                setCurrentPage(1)
              }}
              className="h-9 w-36 rounded-lg"
              aria-label="From date"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value)
                setCurrentPage(1)
              }}
              className="h-9 w-36 rounded-lg"
              aria-label="To date"
            />
            {hasFilters && (
              <Button variant="ghost" size="sm" className="h-9" onClick={clearFilters}>
                <X className="w-4 h-4 mr-1" />
                Clear
              </Button>
            )}
          </InventoryFilterToolbar>

          <InventoryTableWrap>
            <InventoryTable>
              <InventoryTableHead>
                <tr>
                  <InventoryTableTh>Type</InventoryTableTh>
                  <InventoryTableTh>SKU</InventoryTableTh>
                  <InventoryTableTh>Product</InventoryTableTh>
                  <InventoryTableTh>Qty</InventoryTableTh>
                  <InventoryTableTh>Location</InventoryTableTh>
                  <InventoryTableTh>Delta</InventoryTableTh>
                  <InventoryTableTh>Date</InventoryTableTh>
                  <InventoryTableTh>User</InventoryTableTh>
                  <InventoryTableTh>Reference</InventoryTableTh>
                </tr>
              </InventoryTableHead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Loading transactions…</p>
                    </td>
                  </tr>
                ) : paginatedTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <InventoryEmptyState
                        icon={History}
                        title={hasFilters ? "No transactions match your filters" : "No transactions yet"}
                        description={
                          hasFilters
                            ? "Try adjusting filters or clearing them to see more results."
                            : "Stock movements will appear here as you scan in, check out, or adjust inventory."
                        }
                        action={
                          hasFilters ? (
                            <Button variant="outline" size="sm" onClick={clearFilters}>
                              Clear filters
                            </Button>
                          ) : undefined
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  paginatedTransactions.map((transaction) => {
                    const { quantity_delta: delta } = transaction
                    const meta = getTransactionTypeMeta(transaction.type, delta)
                    const inbound = meta.isInbound
                    return (
                      <InventoryTableRow key={transaction.id}>
                        <InventoryTableTd>
                          <Badge className={meta.badgeClass}>
                            {inbound ? <ArrowDown className="w-3 h-3 mr-1" /> : <ArrowUp className="w-3 h-3 mr-1" />}
                            {meta.label}
                          </Badge>
                        </InventoryTableTd>
                        <InventoryTableTd className="font-mono text-xs">{transaction.sku}</InventoryTableTd>
                        <InventoryTableTd className="font-medium">{transaction.product_name}</InventoryTableTd>
                        <InventoryTableTd>
                          <span className={`font-semibold tabular-nums ${inbound ? "text-emerald-600" : "text-orange-600"}`}>
                            {inbound ? "+" : "-"}{transaction.quantity}
                          </span>
                        </InventoryTableTd>
                        <InventoryTableTd className="font-mono text-xs text-muted-foreground">{transaction.location ?? "—"}</InventoryTableTd>
                        <InventoryTableTd>
                          <span className={`font-semibold font-mono tabular-nums ${delta > 0 ? "text-emerald-600" : delta < 0 ? "text-orange-600" : ""}`}>
                            {delta > 0 ? "+" : ""}{delta}
                          </span>
                        </InventoryTableTd>
                        <InventoryTableTd className="text-muted-foreground text-xs">
                          {new Date(transaction.transaction_date).toLocaleString()}
                        </InventoryTableTd>
                        <InventoryTableTd className="text-sm">{transaction.user_name || "—"}</InventoryTableTd>
                        <InventoryTableTd className="font-mono text-xs">{transaction.reference || "—"}</InventoryTableTd>
                      </InventoryTableRow>
                    )
                  })
                )}
              </tbody>
            </InventoryTable>
          </InventoryTableWrap>

          {!loading && filteredTransactions.length > 0 && (
            <div className="flex items-center justify-between pt-4 mt-2 border-t border-border/40">
              <p className="text-sm text-muted-foreground">
                Showing {startIndex + 1}–{Math.min(startIndex + itemsPerPage, filteredTransactions.length)} of {filteredTransactions.length}
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
