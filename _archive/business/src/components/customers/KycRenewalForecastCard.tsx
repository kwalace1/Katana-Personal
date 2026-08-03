import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CalendarClock } from 'lucide-react'
import type { KycRenewalForecast } from '@/lib/kyc-renewal-forecast'
import { cn } from '@/lib/utils'

interface KycRenewalForecastCardProps {
  forecast: KycRenewalForecast
}

function bandLabel(band: KycRenewalForecast['probability_band']): string {
  switch (band) {
    case 'likely':
      return 'Likely to renew'
    case 'at_risk':
      return 'At risk'
    default:
      return 'Uncertain'
  }
}

function bandClass(band: KycRenewalForecast['probability_band']): string {
  switch (band) {
    case 'likely':
      return 'bg-green-500/10 text-green-600 border-green-500/20'
    case 'at_risk':
      return 'bg-red-500/10 text-red-600 border-red-500/20'
    default:
      return 'bg-amber-500/10 text-amber-600 border-amber-500/20'
  }
}

export function KycRenewalForecastCard({ forecast }: KycRenewalForecastCardProps) {
  return (
    <Card className="border-amber-500/20">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-amber-600" />
            Renewal forecast
          </CardTitle>
          <Badge variant="outline" className={cn(bandClass(forecast.probability_band))}>
            {bandLabel(forecast.probability_band)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        <p className="text-2xl font-bold tabular-nums">{forecast.probability_percent}%</p>
        <p className="text-xs text-muted-foreground">Renewal probability based on visible account factors</p>
        {forecast.reasons.length > 0 && (
          <ul className="space-y-1 pt-2 border-t">
            {forecast.reasons.map((reason) => (
              <li key={reason} className="text-xs text-muted-foreground flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
                {reason}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
