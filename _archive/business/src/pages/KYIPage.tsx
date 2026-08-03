import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MotionPage } from '@/components/motion-page'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LineChart, Loader2 } from 'lucide-react'
import { ensureOrganizationCompany } from '@/lib/kyi-api'

/**
 * KYI entry point — resolves the signed-in org's workspace and drops the user
 * straight into it (no intermediate landing page).
 */
export default function KYIPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ensureOrganizationCompany()
      .then((company) => {
        if (cancelled) return
        navigate(`/kyi/companies/${company.id}?tab=overview`, { replace: true })
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load your KYI workspace')
      })
    return () => {
      cancelled = true
    }
  }, [navigate])

  if (error) {
    return (
      <MotionPage className="p-6 max-w-2xl">
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Cannot open Know Your Investor</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </MotionPage>
    )
  }

  return (
    <MotionPage className="p-6 flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="flex items-center gap-2.5">
          <LineChart className="w-7 h-7 text-primary" />
          <span className="text-xl font-semibold text-foreground">Know Your Investor</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Opening your workspace…
        </div>
      </div>
    </MotionPage>
  )
}
