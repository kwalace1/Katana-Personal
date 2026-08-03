import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const DEFAULT_MESSAGE =
  "Your account isn't in the company directory yet. Ask your HR team or manager to add you in Katana HR with your work email. Once you're added, you'll see your employee portal here."

interface EmployeePortalNoAccessProps {
  /** Optional error message; if provided, shown instead of the default onboarding message */
  error?: string | null
}

export function EmployeePortalNoAccess({ error }: EmployeePortalNoAccessProps) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>No portal access yet</CardTitle>
          <CardDescription>{error ?? DEFAULT_MESSAGE}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            If you&apos;re an admin, you can add yourself (or others) in the HR module.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/">Back to home</Link>
            </Button>
            <Button asChild>
              <Link to="/hr">Go to HR (admin)</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
