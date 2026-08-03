"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, Scan, Check, AlertTriangle, Loader2, Camera } from "lucide-react"
import { getInventoryItemBySku, performCheckOut, type InventoryItem } from "@/lib/inventory-api"
import { getAvailableQty } from "@/lib/inventory-utils"
import { getJobs, type Job } from "@/lib/wfm-api"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"
import {
  InventoryShell,
  InventoryContent,
  InventorySubpageHeader,
  InventoryNotConfigured,
} from "@/components/inventory/InventoryUi"

interface RecentCheckout {
  item: InventoryItem
  quantity: number
  timestamp: Date
  reference?: string
}

type IssueTarget = "none" | "job" | "project"

export function CheckOut() {
  const [skuInput, setSkuInput] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [issueTarget, setIssueTarget] = useState<IssueTarget>("none")
  const [selectedJobId, setSelectedJobId] = useState("")
  const [selectedProjectId, setSelectedProjectId] = useState("")
  const [jobs, setJobs] = useState<Job[]>([])
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [scannedItem, setScannedItem] = useState<InventoryItem | null>(null)
  const [recentCheckouts, setRecentCheckouts] = useState<RecentCheckout[]>([])
  const [scanning, setScanning] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    void getJobs().then((list) =>
      setJobs(list.filter((j) => j.status !== "completed" && j.status !== "cancelled")),
    )
    void supabase
      .from("projects")
      .select("id, name")
      .order("name")
      .then(({ data }) => setProjects(data ?? []))
  }, [])

  const handleScan = async () => {
    if (!skuInput.trim()) return

    setScanning(true)
    setError(null)

    try {
      const item = await getInventoryItemBySku(skuInput.trim())
      if (item) {
        setScannedItem(item)
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

  const selectedJob = jobs.find((j) => j.id === selectedJobId)
  const selectedProject = projects.find((p) => p.id === selectedProjectId)

  const handleConfirm = async () => {
    if (!scannedItem || !quantity) return

    const qty = parseInt(quantity)
    const available = getAvailableQty(scannedItem)

    if (qty > available) {
      setError(`Cannot check out more than available quantity (${available})`)
      return
    }

    setConfirming(true)
    setError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const userName = user?.user_metadata?.full_name || user?.email || "Unknown User"

      const result = await performCheckOut({
        itemId: scannedItem.id,
        quantity: qty,
        options: {
          reference: issueTarget === "none" ? reference || undefined : undefined,
          userName,
          notes: notes || undefined,
          jobId: issueTarget === "job" ? selectedJobId : undefined,
          projectId: issueTarget === "project" ? selectedProjectId : undefined,
          jobLabel:
            issueTarget === "job" && selectedJob
              ? `${selectedJob.job_number} — ${selectedJob.title}`
              : undefined,
          projectLabel:
            issueTarget === "project" && selectedProject ? selectedProject.name : undefined,
        },
      })

      if (result.success && result.item) {
        let refLabel = reference
        if (issueTarget === "job" && selectedJob) {
          refLabel = `${selectedJob.job_number} — ${selectedJob.title}`
        } else if (issueTarget === "project" && selectedProject) {
          refLabel = selectedProject.name
        }

        setRecentCheckouts([
          { item: result.item, quantity: qty, timestamp: new Date(), reference: refLabel },
          ...recentCheckouts.slice(0, 4),
        ])
        setScannedItem(null)
        setSkuInput("")
        setQuantity("1")
        setReference("")
        setNotes("")
        setIssueTarget("none")
        setSelectedJobId("")
        setSelectedProjectId("")
      } else {
        setError(result.error || "Failed to check out item")
      }
    } catch (err) {
      console.error("Error confirming check-out:", err)
      setError("Failed to complete check-out")
    } finally {
      setConfirming(false)
    }
  }

  const isLowStock =
    scannedItem && scannedItem.on_hand_qty - parseInt(quantity || "0") < scannedItem.min_qty
  const available = scannedItem ? getAvailableQty(scannedItem) : 0

  if (!isSupabaseConfigured) {
    return <InventoryNotConfigured />
  }

  return (
    <InventoryShell>
      <InventoryContent className="max-w-5xl">
        <InventorySubpageHeader
          icon={Scan}
          title="Check-Out"
          description="Issue stock to jobs, projects, or general use"
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className="p-6 border-border/60 bg-card/80 backdrop-blur-sm shadow-sm">
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <Scan className="w-5 h-5 text-orange-600" />
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
                          <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">Found</Badge>
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
                            <p className="text-muted-foreground">Available</p>
                            <p className="font-semibold">{available}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Allocated</p>
                            <p className="font-semibold">{scannedItem.allocated}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {isLowStock && (
                      <div className="p-3 border border-yellow-500/20 rounded-lg bg-yellow-500/10 flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-semibold text-yellow-600">Low Stock Warning</p>
                          <p className="text-yellow-600/80">This checkout will bring stock below minimum quantity</p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        min="1"
                        max={available}
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="Enter quantity..."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Issue to</Label>
                      <Select
                        value={issueTarget}
                        onValueChange={(v) => setIssueTarget(v as IssueTarget)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">General / other</SelectItem>
                          <SelectItem value="job">WFM job</SelectItem>
                          <SelectItem value="project">PM project</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {issueTarget === "job" && (
                      <div className="space-y-2">
                        <Label>Workforce job</Label>
                        <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select job…" />
                          </SelectTrigger>
                          <SelectContent>
                            {jobs.map((job) => (
                              <SelectItem key={job.id} value={job.id}>
                                {job.job_number} — {job.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {issueTarget === "project" && (
                      <div className="space-y-2">
                        <Label>Project</Label>
                        <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select project…" />
                          </SelectTrigger>
                          <SelectContent>
                            {projects.map((project) => (
                              <SelectItem key={project.id} value={project.id}>
                                {project.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {issueTarget === "none" && (
                      <div className="space-y-2">
                        <Label>Reference (Optional)</Label>
                        <Input
                          value={reference}
                          onChange={(e) => setReference(e.target.value)}
                          placeholder="Work order, sales order..."
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Notes (Optional)</Label>
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Additional notes..."
                        rows={3}
                      />
                    </div>

                    <Button onClick={handleConfirm} className="w-full" size="lg" disabled={confirming}>
                      {confirming ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Confirm Check-Out
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
              <h2 className="text-xl font-semibold">Recent Check-Outs</h2>
              {recentCheckouts.length > 0 ? (
                <div className="space-y-3">
                  {recentCheckouts.map((checkout, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <p className="font-semibold">{checkout.item.product_name}</p>
                          <p className="text-sm text-muted-foreground font-mono">{checkout.item.sku}</p>
                          {checkout.reference && (
                            <p className="text-xs text-muted-foreground">→ {checkout.reference}</p>
                          )}
                          <div className="flex items-center gap-2 text-sm">
                            <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">
                              -{checkout.quantity}
                            </Badge>
                            <span className="text-muted-foreground">{checkout.timestamp.toLocaleTimeString()}</span>
                          </div>
                        </div>
                        <Check className="w-5 h-5 text-orange-600" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Scan className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No recent check-outs</p>
                  <p className="text-sm">Start checking out items to see them here</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </InventoryContent>
    </InventoryShell>
  )
}
