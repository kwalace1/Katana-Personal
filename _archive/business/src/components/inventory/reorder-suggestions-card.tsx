"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, FileText, Loader2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import {
  fetchLowStockForReorder,
  groupReorderSuggestions,
  createDraftPoFromSuggestion,
  type ReorderSuggestion,
} from "@/lib/inventory-reorder"
import { isSupabaseConfigured } from "@/lib/supabase"
import { toast } from "sonner"
import { Card } from "@/components/ui/card"

export function ReorderSuggestionsCard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<ReorderSuggestion[]>([])

  const load = async () => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const low = await fetchLowStockForReorder()
      setSuggestions(groupReorderSuggestions(low))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const handleCreatePo = async (suggestion: ReorderSuggestion) => {
    setCreating(suggestion.supplierName)
    try {
      const po = await createDraftPoFromSuggestion(suggestion)
      if (po?.id) {
        toast.success(`Draft PO created for ${suggestion.supplierName}`)
        navigate(`/inventory/purchase-orders/${po.id}`)
      } else {
        toast.error("Could not create purchase order")
      }
    } catch (err) {
      toast.error("Failed to create PO", {
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setCreating(null)
    }
  }

  if (!isSupabaseConfigured || loading) return null
  if (suggestions.length === 0) return null

  return (
    <Card className="overflow-hidden border-amber-500/20 bg-gradient-to-br from-amber-500/6 via-card to-card shadow-sm">
      <div className="px-5 py-4 border-b border-amber-500/10 bg-amber-500/5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Reorder suggestions</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Items at or below minimum stock — grouped by supplier for one-click draft POs.
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {suggestions.map((s) => (
          <div
            key={s.supplierName}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border/60 bg-background/60 p-4 hover:bg-background/80 transition-colors"
          >
            <div className="min-w-0">
              <p className="font-semibold">{s.supplierName}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {s.items.slice(0, 4).map((item) => (
                  <Badge key={item.id} variant="outline" className="text-xs font-normal">
                    {item.sku} · {item.on_hand_qty}/{item.min_qty}
                  </Badge>
                ))}
                {s.items.length > 4 && (
                  <Badge variant="secondary" className="text-xs">
                    +{s.items.length - 4} more
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Est. ${s.suggestedTotal.toFixed(2)} · {s.items.length} item{s.items.length === 1 ? '' : 's'}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 bg-background"
              disabled={creating === s.supplierName}
              onClick={() => void handleCreatePo(s)}
            >
              {creating === s.supplierName ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 mr-2" />
              )}
              Create draft PO
            </Button>
          </div>
        ))}
      </div>
    </Card>
  )
}
