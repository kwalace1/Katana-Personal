import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

interface PortfolioHealthWidgetProps {
  healthPercentage: number
  className?: string
}

export function PortfolioHealthWidget({ 
  healthPercentage,
  className = "" 
}: PortfolioHealthWidgetProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardDescription>Portfolio Health</CardDescription>
        <CardTitle className="text-2xl">{healthPercentage}%</CardTitle>
      </CardHeader>
      <CardContent>
        <Progress value={healthPercentage} className="h-1" />
      </CardContent>
    </Card>
  )
}







