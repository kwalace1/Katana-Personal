"use client"

import { useState, useEffect, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Scan, Check, Loader2, Camera } from "lucide-react"
import {
  getInventoryItemBySku,
  performScanIn,
  getOpenPurchaseOrdersWithLines,
  receivePurchaseOrderLines,
  type InventoryItem,
  type PurchaseOrder,
} from "@/lib/inventory-api"
import { findOpenPoLinesForItem } from "@/lib/inventory-utils"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"
import {
  InventoryShell,
  InventoryContent,
  InventorySubpageHeader,
  InventoryNotConfigured,
} from "@/components/inventory/InventoryUi"

interface RecentScan {
  item: InventoryItem
  quantity: number
  timestamp: Date
  poNumber?: string
}

export function ScanIn() {
  const [skuInput, setSkuInput] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [reference, setReference] = useState("")
  const [reason, setReason] = useState("Scan In")
  const [scannedItem, setScannedItem] = useState<InventoryItem | null>(null)
  const [openPos, setOpenPos] = useState<PurchaseOrder[]>([])
  const [receiveMode, setReceiveMode] = useState<"standalone" | string>("standalone")
  const [recentScans, setRecentScans] = useState<RecentScan[]>([])
  const [scanning, setScanning] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    void getOpenPurchaseOrdersWithLines().then(setOpenPos).catch(console.error)
  }, [])

  const poLineMatches = useMemo(
    () => (scannedItem ? findOpenPoLinesForItem(openPos, scannedItem) : []),
    [openPos, scannedItem],
  )

  const selectedMatch = poLineMatches.find((m) => m.lineId === receiveMode)

  const handleScan = async () => {
    if (!skuInput.trim()) return

    setScanning(true)
    setError(null)

    try {
      const item = await getInventoryItemBySku(skuInput.trim())
      if (item) {
        setScannedItem(item)
        const matches = findOpenPoLinesForItem(openPos, item)
        if (matches.length === 1) {
          setReceiveMode(matches[0].lineId)
          setReference(matches[0].poNumber)
          setReason("PO Receive")
        } else {
          setReceiveMode("standalone")
        }
      } else {
        setError("Item not found. Please check the SKU or barcode.")
        setScannedItem(null)
      }
    } catch (err) {
      console.error("Error scanning item:", err)
      setError("Failed to look up item")
      setScannedItem(null)
    } finally {
      setScanning(false)
    }
  }

  const handleConfirm = async () => {
    if (!scannedItem || !quantity) return

    const qty = parseInt(quantity, 10)
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Enter a valid quantity")
      return
    }

    if (selectedMatch && qty > selectedMatch.remainingQty) {
      setError(`Cannot receive more than ${selectedMatch.remainingQty} remaining on this PO line`)
      return
    }

    setConfirming(true)
    setError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const userName = user?.user_metadata?.full_name || user?.email || "Unknown User"

      if (selectedMatch) {
        await receivePurchaseOrderLines(
          selectedMatch.poId,
          [{ po_line_id: selectedMatch.lineId, quantity: qty }],
          userName,
        )
        const refreshed = await getInventoryItemBySku(scannedItem.sku)
        setRecentScans([
          {
            item: refreshed ?? scannedItem,
            quantity: qty,
            timestamp: new Date(),
            poNumber: selectedMatch.poNumber,
          },
          ...recentScans.slice(0, 4),
        ])
      } else {
        const result = await performScanIn(scannedItem.id, qty, {
          reference: reference || undefined,
          userName,
          reason,
        })

        if (result.success && result.item) {
          setRecentScans([
            { item: result.item, quantity: qty, timestamp: new Date() },
            ...recentScans.slice(0, 4),
          ])
        } else {
          setError(result.error || "Failed to scan in item")
          return
        }
      }

      setScannedItem(null)
      setSkuInput("")
      setQuantity("1")
      setReference("")
      setReason("Scan In")
      setReceiveMode("standalone")
      const refreshedPos = await getOpenPurchaseOrdersWithLines()
      setOpenPos(refreshedPos)
    } catch (err) {
      console.error("Error confirming scan-in:", err)
      setError(err instanceof Error ? err.message : "Failed to complete scan-in")
    } finally {
      setConfirming(false)
    }
  }

  if (!isSupabaseConfigured) {
    return <InventoryNotConfigured />
  }

  return (
    <InventoryShell>
      <InventoryContent>
        <InventorySubpageHeader
          icon={Scan}
          title="Scan-In"
          description="Receive stock against open POs or ad-hoc"
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className="p-6 border-border/60 bg-card/80 backdrop-blur-sm shadow-sm">
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Scan className="w-5 h-5 text-green-600" />
                </div>
                <h2 className="text-xl font-semibold">Scan Item</h2>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>SKU / Barcode</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter or scan SKU/barcode..."
                      value={skuInput}
                      onChange={(e) => setSkuInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleScan()}
                      disabled={scanning}
                      autoFocus
                    />
                    <Button onClick={handleScan} disabled={scanning || !skuInput.trim()}>
                      {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scan className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Camera className="w-3 h-3" />
                    Use a USB/Bluetooth barcode scanner — it types into the field automatically.
                  </p>
                </div>

                {error && (
                  <div className="p-3 border border-red-500/20 rounded-lg bg-red-500/10 text-red-600 text-sm">
                    {error}
                  </div>
                )}

                {scannedItem && (
                  <>
                    <div className="p-4 border rounded-lg bg-muted/30">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold">{scannedItem.product_name}</h3>
                          <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Found</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">SKU</p>
                            <p className="font-mono">{scannedItem.sku}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Location</p>
                            <p className="font-mono">{scannedItem.location || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Current Stock</p>
                            <p className="font-semibold">{scannedItem.on_hand_qty}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Unit Cost</p>
                            <p className="font-semibold">${scannedItem.unit_cost}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {poLineMatches.length > 0 && (
                      <div className="space-y-2">
                        <Label>Receive against PO</Label>
                        <Select
                          value={receiveMode}
                          onValueChange={(v) => {
                            setReceiveMode(v)
                            if (v === "standalone") {
                              setReason("Scan In")
                            } else {
                              const match = poLineMatches.find((m) => m.lineId === v)
                              if (match) {
                                setReference(match.poNumber)
                                setReason("PO Receive")
                                setQuantity(String(Math.min(parseInt(quantity, 10) || 1, match.remainingQty)))
                              }
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select PO line" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="standalone">Standalone scan-in (no PO)</SelectItem>
                            {poLineMatches.map((m) => (
                              <SelectItem key={m.lineId} value={m.lineId}>
                                {m.poNumber} — {m.remainingQty} remaining
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        min="1"
                        max={selectedMatch?.remainingQty}
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="Enter quantity..."
                      />
                      {selectedMatch && (
                        <p className="text-xs text-muted-foreground">
                          Max {selectedMatch.remainingQty} remaining on {selectedMatch.poNumber}
                        </p>
                      )}
                    </div>

                    {!selectedMatch && (
                      <>
                        <div className="space-y-2">
                          <Label>Reason</Label>
                          <Input
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Scan In"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Reference (Optional)</Label>
                          <Input
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                            placeholder="Delivery note..."
                          />
                        </div>
                      </>
                    )}

                    <Button onClick={handleConfirm} className="w-full" size="lg" disabled={confirming}>
                      {confirming ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          {selectedMatch ? "Receive against PO" : "Confirm Scan-In"}
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-6 border-border/60 bg-card/80 backdrop-blur-sm shadow-sm">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Recent Scans</h2>
              {recentScans.length > 0 ? (
                <div className="space-y-3">
                  {recentScans.map((scan, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <p className="font-semibold">{scan.item.product_name}</p>
                          <p className="text-sm text-muted-foreground font-mono">{scan.item.sku}</p>
                          <div className="flex items-center gap-2 text-sm flex-wrap">
                            <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                              +{scan.quantity}
                            </Badge>
                            {scan.poNumber && (
                              <Badge variant="outline" className="text-blue-600">
                                {scan.poNumber}
                              </Badge>
                            )}
                            <span className="text-muted-foreground">{scan.timestamp.toLocaleTimeString()}</span>
                          </div>
                        </div>
                        <Check className="w-5 h-5 text-green-600" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Scan className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No recent scans</p>
                  <p className="text-sm">Start scanning items to see them here</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </InventoryContent>
    </InventoryShell>
  )
}
