"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, Plus } from "lucide-react"
import { RequestTimeOffDialog } from "@/components/employee/request-time-off-dialog"
import {
  getTimeOffRequestsByEmployeeId,
  timeOffPortalNoticeBody,
  timeOffPortalNoticeTitle,
  type TimeOffRequest,
} from "@/lib/hr-api"

interface HrMemberTimeOffTabProps {
  employeeId: string
}

export function HrMemberTimeOffTab({ employeeId }: HrMemberTimeOffTabProps) {
  const [requests, setRequests] = useState<TimeOffRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const rows = await getTimeOffRequestsByEmployeeId(employeeId)
      setRequests(rows)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [employeeId])

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Time off</CardTitle>
            <CardDescription>Request time off and track the status of your requests.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Request time off
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : requests.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Calendar className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No time-off requests yet.</p>
              <Button className="mt-4" variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
                Submit your first request
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => (
                <div key={req.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{timeOffPortalNoticeTitle(req)}</p>
                      <p className="text-sm text-muted-foreground mt-1">{timeOffPortalNoticeBody(req)}</p>
                    </div>
                    <Badge
                      variant={
                        req.status === "Approved"
                          ? "default"
                          : req.status === "Denied"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {req.status}
                    </Badge>
                  </div>
                  {req.manager_notes && (
                    <p className="text-xs text-muted-foreground mt-2 border-t pt-2">
                      Manager note: {req.manager_notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <RequestTimeOffDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employeeId={employeeId}
        onSubmitted={(req) => {
          setRequests((prev) => [req, ...prev.filter((r) => r.id !== req.id)])
        }}
      />
    </>
  )
}
