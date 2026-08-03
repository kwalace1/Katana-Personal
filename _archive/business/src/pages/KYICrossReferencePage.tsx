import { useState, useEffect } from 'react'
import { MotionPage } from '@/components/motion-page'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ChevronLeft, Loader2, GitCompare } from 'lucide-react'
import {
  getCrossReferenceInvestors,
  postCrossReferenceCompare,
  type CrossReferenceInvestor,
  type CrossReferenceCompareResponse,
} from '@/lib/kyi-api'

export default function KYICrossReferencePage() {
  const [investors, setInvestors] = useState<CrossReferenceInvestor[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [compareResult, setCompareResult] = useState<CrossReferenceCompareResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [comparing, setComparing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getCrossReferenceInvestors()
      .then((data) => {
        if (!cancelled) setInvestors(data)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load investors')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const toggle = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setCompareResult(null)
  }

  const handleCompare = async () => {
    if (selectedIds.size < 2) return
    setComparing(true)
    setCompareResult(null)
    setError(null)
    try {
      const res = await postCrossReferenceCompare(Array.from(selectedIds))
      setCompareResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Compare failed')
    } finally {
      setComparing(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <MotionPage subtle className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link to="/kyi">
            <ChevronLeft className="w-5 h-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <GitCompare className="w-8 h-8" />
          Cross-Reference
        </h1>
      </div>
      <p className="text-muted-foreground">
        Select at least two investors who have connections. Compare to see overlapping people and shared companies.
      </p>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Investors with connections</CardTitle>
          <CardDescription>
            Only investors with at least one connection appear here. Select 2 or more to compare.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {investors.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center">
              No investors with connections yet. Add investors and upload connection data in KYI.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-4">
                {investors.map((inv) => (
                  <label
                    key={inv.id}
                    className="flex items-center gap-2 cursor-pointer rounded-lg border border-border px-4 py-2 hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selectedIds.has(inv.id)}
                      onCheckedChange={() => toggle(inv.id)}
                    />
                    <span className="font-medium">{inv.full_name}</span>
                    {inv.firm && (
                      <span className="text-muted-foreground text-sm">· {inv.firm}</span>
                    )}
                    <span className="text-xs text-muted-foreground">({inv.conn_count} connections)</span>
                  </label>
                ))}
              </div>
              <Button
                onClick={handleCompare}
                disabled={selectedIds.size < 2 || comparing}
              >
                {comparing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Compare {selectedIds.size} investors
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {compareResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Comparison results</CardTitle>
            <CardDescription>
              Overlapping people and shared companies across the selected investors.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
              <div className="rounded-lg border border-border p-2">
                <p className="text-xs text-muted-foreground">Investors</p>
                <p className="font-semibold">{compareResult.stats.total_investors}</p>
              </div>
              <div className="rounded-lg border border-border p-2">
                <p className="text-xs text-muted-foreground">Unique people</p>
                <p className="font-semibold">{compareResult.stats.total_unique_people}</p>
              </div>
              <div className="rounded-lg border border-border p-2">
                <p className="text-xs text-muted-foreground">Overlapping people</p>
                <p className="font-semibold">{compareResult.stats.overlapping_people_count}</p>
              </div>
              <div className="rounded-lg border border-border p-2">
                <p className="text-xs text-muted-foreground">Unique companies</p>
                <p className="font-semibold">{compareResult.stats.total_unique_companies}</p>
              </div>
              <div className="rounded-lg border border-border p-2">
                <p className="text-xs text-muted-foreground">Shared companies</p>
                <p className="font-semibold">{compareResult.stats.shared_companies_count}</p>
              </div>
            </div>

            {Object.keys(compareResult.overlapping_people).length > 0 && (
              <div>
                <h3 className="font-medium mb-2">People in multiple networks</h3>
                <ul className="space-y-1 text-sm">
                  {Object.entries(compareResult.overlapping_people).map(([name, invIds]) => (
                    <li key={name} className="flex items-center gap-2">
                      <span className="font-medium">{name}</span>
                      <span className="text-muted-foreground">— in {invIds.length} investor network(s)</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {Object.keys(compareResult.shared_companies).length > 0 && (
              <div>
                <h3 className="font-medium mb-2">Shared companies</h3>
                <ul className="space-y-1 text-sm">
                  {Object.entries(compareResult.shared_companies).map(([company, invIds]) => (
                    <li key={company} className="flex items-center gap-2">
                      <span className="font-medium">{company}</span>
                      <span className="text-muted-foreground">— shared by {invIds.length} investor(s)</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {Object.keys(compareResult.overlapping_people).length === 0 &&
              Object.keys(compareResult.shared_companies).length === 0 && (
              <p className="text-muted-foreground text-sm">No overlapping people or shared companies in this selection.</p>
            )}
          </CardContent>
        </Card>
      )}
    </MotionPage>
  )
}