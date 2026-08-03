import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface BudgetUtilizationWidgetProps {
  totalSpent: number
  totalBudget: number
  className?: string
}

export function BudgetUtilizationWidget({ 
  totalSpent, 
  totalBudget,
  className = "" 
}: BudgetUtilizationWidgetProps) {
  const percentage = Math.round((totalSpent / totalBudget) * 100)
  
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardDescription>Budget Utilization</CardDescription>
        <CardTitle className="text-2xl">{percentage}%</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-xs text-muted-foreground">
          ${(totalSpent / 1000).toFixed(0)}K / ${(totalBudget / 1000).toFixed(0)}K
        </div>
      </CardContent>
    </Card>
  )
}







