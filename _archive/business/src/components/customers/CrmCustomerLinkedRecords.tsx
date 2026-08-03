import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LifeBuoy, Wrench, FileText } from 'lucide-react'
import {
  getLinkedInvoices,
  getLinkedSupportTickets,
  getLinkedWfmJobs,
  type LinkedInvoice,
  type LinkedSupportTicket,
  type LinkedWfmJob,
} from '@/lib/customer-linked-records'
import { workforceTabPath } from '@/lib/wfm-deep-links'
import { formatDateOnly } from '@/lib/due-date-utils'
import { useModuleAccess } from '@/contexts/ModuleAccessContext'
import { invoiceDeepLink, financeMatchDeepLink } from '@/lib/module-integrations'
import { ModuleDiscussion } from '@/components/comms/ModuleDiscussion'

interface CrmCustomerLinkedRecordsProps {
  clientId: string
}

export function CrmCustomerLinkedRecords({ clientId }: CrmCustomerLinkedRecordsProps) {
  const { allowedModules, canIntegrateModules, canOrgIntegrate, hasModuleAccess } = useModuleAccess()
  const [jobs, setJobs] = useState<LinkedWfmJob[]>([])
  const [tickets, setTickets] = useState<LinkedSupportTicket[]>([])
  const [invoices, setInvoices] = useState<LinkedInvoice[]>([])
  const [loading, setLoading] = useState(true)

  const orgHasCsWfm = canOrgIntegrate('customer-success', 'workforce')
  const orgHasCsSupport = canOrgIntegrate('customer-success', 'support')
  const userCanOpenWfm = hasModuleAccess('workforce')
  const userCanOpenFinance = canIntegrateModules('customer-success', 'finance')

  useEffect(() => {
    let cancelled = false
    const loaders: Promise<void>[] = []

    if (orgHasCsWfm) {
      loaders.push(
        getLinkedWfmJobs(clientId).then((j) => {
          if (!cancelled) setJobs(j)
        }),
      )
    }
    if (orgHasCsSupport) {
      loaders.push(
        getLinkedSupportTickets(clientId).then((t) => {
          if (!cancelled) setTickets(t)
        }),
      )
    }
    if (orgHasCsWfm || orgHasCsSupport || allowedModules.includes('customer-success')) {
      loaders.push(
        getLinkedInvoices(clientId).then((inv) => {
          if (!cancelled) setInvoices(inv)
        }),
      )
    }

    void Promise.all(loaders).finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [clientId, orgHasCsWfm, orgHasCsSupport, allowedModules])

  if (loading) return null
  if (jobs.length === 0 && tickets.length === 0 && invoices.length === 0) {
    return (
      <ModuleDiscussion
        contextType="client"
        contextId={clientId}
        title="Client discussion"
        className="mt-4"
      />
    )
  }

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-base">Linked records</h4>
      <div className="grid gap-4 md:grid-cols-2">
        {jobs.length > 0 && (
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Workforce jobs ({jobs.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-4">
              {jobs.slice(0, 5).map((job) =>
                userCanOpenWfm ? (
                  <Link
                    key={job.id}
                    to={workforceTabPath('work', 'list', job.id)}
                    className="flex items-center justify-between text-sm border-b pb-2 last:border-0 hover:bg-muted/50 rounded px-1 -mx-1"
                  >
                    <div>
                      <p className="font-medium">{job.title}</p>
                      <p className="text-xs text-muted-foreground">{job.job_number}</p>
                    </div>
                    <Badge variant="outline">{job.status}</Badge>
                  </Link>
                ) : (
                  <div
                    key={job.id}
                    className="flex items-center justify-between text-sm border-b pb-2 last:border-0"
                  >
                    <div>
                      <p className="font-medium">{job.title}</p>
                      <p className="text-xs text-muted-foreground">{job.job_number}</p>
                    </div>
                    <Badge variant="outline">{job.status}</Badge>
                  </div>
                ),
              )}
              {userCanOpenWfm && (
                <Link to={workforceTabPath('work')} className="text-xs text-primary hover:underline">
                  Open Workforce →
                </Link>
              )}
            </CardContent>
          </Card>
        )}
        {invoices.length > 0 && (
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Invoices ({invoices.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-4">
              {invoices.slice(0, 5).map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between text-sm border-b pb-2 last:border-0"
                >
                  <div className="min-w-0 pr-2">
                    <Link
                      to={invoiceDeepLink(inv.id, allowedModules)}
                      className="font-medium hover:underline"
                    >
                      {inv.invoice_number}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      ${inv.total.toFixed(2)}
                      {inv.due_date ? ` · due ${formatDateOnly(inv.due_date)}` : ''}
                    </p>
                  </div>
                  <Badge variant="outline">{inv.status}</Badge>
                </div>
              ))}
              {userCanOpenFinance && (
                <Link to={financeMatchDeepLink()} className="text-xs text-primary hover:underline">
                  Match payments in Finance →
                </Link>
              )}
            </CardContent>
          </Card>
        )}
        {tickets.length > 0 && (
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <LifeBuoy className="h-4 w-4" />
                Support tickets ({tickets.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-4">
              {tickets.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                  <div className="min-w-0 pr-2">
                    <p className="font-medium truncate">{t.subject}</p>
                    <p className="text-xs text-muted-foreground">{formatDateOnly(t.created_at.slice(0, 10))}</p>
                  </div>
                  <Badge variant="outline">{t.status}</Badge>
                </div>
              ))}
              <Link to="/support" className="text-xs text-primary hover:underline">
                Open Support →
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
      <ModuleDiscussion
        contextType="client"
        contextId={clientId}
        title="Client discussion"
      />
    </div>
  )
}
