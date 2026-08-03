import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowUpRight, ArrowDownRight } from "lucide-react"

interface OnTimeDeliveryWidgetProps {
  percentage: number
  trend?: {
    value: number
    label: string
  }
  className?: string
}

export function OnTimeDeliveryWidget({ 
  percentage,
  trend,
  className = "" 
}: OnTimeDeliveryWidgetProps) {
  const isPositiveTrend = trend && trend.value >= 0
  
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardDescription>On-Time Delivery</CardDescription>
        <CardTitle className="text-2xl">{percentage}%</CardTitle>
      </CardHeader>
      <CardContent>
        {trend && (
          <div className={`flex items-center text-xs ${isPositiveTrend ? 'text-green-500' : 'text-red-500'}`}>
            {isPositiveTrend ? (
              <ArrowUpRight className="h-3 w-3 mr-1" />
            ) : (
              <ArrowDownRight className="h-3 w-3 mr-1" />
            )}
            {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
          </div>
        )}
      </CardContent>
    </Card>
  )
}







