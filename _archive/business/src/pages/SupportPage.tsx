import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { MotionPage } from '@/components/motion-page'
import { ModuleHelpButton } from '@/components/tour/module-help-button'
import { useModuleTour } from '@/components/tour/use-module-tour'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertCircle, LifeBuoy, Mail, MessageSquare, Loader2, Globe } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { isKatanaPlatformOperator } from '@/lib/platform-support-access'
import {
  getAllPlatformSubmissions,
  getAllSubmissions,
  getMySubmissions,
  isSupportEmailConfigured,
  SUBMISSION_STATUS_LABELS,
  type SubmissionStatus,
  type SupportSubmission,
} from '@/lib/support-api'
import { SubmitSubmissionForm } from '@/components/support/submit-submission-form'
import { SubmissionsTable } from '@/components/support/submissions-table'
import { SubmissionDetailDialog } from '@/components/support/submission-detail-dialog'

export default function SupportPage() {
  useModuleTour('support')
  const { user, profile, organization, hasRole } = useAuth()
  const isOrgAdmin = hasRole(['owner', 'admin'])
  const isPlatformOperator = isKatanaPlatformOperator({
    profile,
    organization,
    userEmail: user?.email,
  })
  const canManageTickets = isPlatformOperator || isOrgAdmin

  const submitterName = profile?.full_name?.trim() || user?.email?.split('@')[0] || 'User'
  const submitterEmail = profile?.email || user?.email || ''
  const organizationName = organization?.name || 'Unknown organization'
  const updateActor = {
    userId: user?.id ?? '',
    name: profile?.full_name?.trim() || user?.email?.split('@')[0] || 'User',
    email: profile?.email || user?.email || '',
  }

  const [activeTab, setActiveTab] = useState('submit')
  const [mySubmissions, setMySubmissions] = useState<SupportSubmission[]>([])
  const [orgSubmissions, setOrgSubmissions] = useState<SupportSubmission[]>([])
  const [platformSubmissions, setPlatformSubmissions] = useState<SupportSubmission[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedSubmission, setSelectedSubmission] = useState<SupportSubmission | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const [pilotSearch, setPilotSearch] = useState('')
  const [pilotStatusFilter, setPilotStatusFilter] = useState<SubmissionStatus | 'all'>('all')

  const emailConfigured = isSupportEmailConfigured()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [mine, org, platform] = await Promise.all([
        getMySubmissions(),
        isOrgAdmin && !isPlatformOperator ? getAllSubmissions() : Promise.resolve([]),
        isPlatformOperator ? getAllPlatformSubmissions() : Promise.resolve([]),
      ])
      setMySubmissions(mine)
      setOrgSubmissions(org)
      setPlatformSubmissions(platform)
    } catch (err) {
      console.error('Error loading support data:', err)
      toast.error('Failed to load support data')
    } finally {
      setLoading(false)
    }
  }, [isOrgAdmin, isPlatformOperator])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    const channel = supabase
      .channel('support_submissions_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_submissions' }, () => {
        void fetchData()
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [fetchData])

  const filteredPlatformSubmissions = useMemo(() => {
    return platformSubmissions.filter((s) => {
      if (pilotStatusFilter !== 'all' && s.status !== pilotStatusFilter) return false
      if (pilotSearch.trim()) {
        const q = pilotSearch.toLowerCase()
        return (
          s.subject.toLowerCase().includes(q) ||
          s.submitter_name.toLowerCase().includes(q) ||
          s.submitter_email.toLowerCase().includes(q) ||
          (s.organization_name ?? '').toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [platformSubmissions, pilotStatusFilter, pilotSearch])

  const openPilotCount = platformSubmissions.filter((s) => s.status === 'open').length

  const handleSubmitted = (submission: SupportSubmission) => {
    setMySubmissions((prev) => [submission, ...prev])
    if (isOrgAdmin) setOrgSubmissions((prev) => [submission, ...prev])
    if (isPlatformOperator) setPlatformSubmissions((prev) => [submission, ...prev])
    setActiveTab('my-submissions')
  }

  const handleUpdated = (updated: SupportSubmission) => {
    const merge = (list: SupportSubmission[]) =>
      list.map((s) => (s.id === updated.id ? updated : s))
    setMySubmissions(merge)
    setOrgSubmissions(merge)
    setPlatformSubmissions(merge)
  }

  const handleDeleted = (id: string) => {
    const remove = (list: SupportSubmission[]) => list.filter((s) => s.id !== id)
    setMySubmissions(remove)
    setOrgSubmissions(remove)
    setPlatformSubmissions(remove)
    setSelectedSubmission(null)
  }

  const openDetail = (submission: SupportSubmission) => {
    setSelectedSubmission(submission)
    setDetailOpen(true)
  }

  return (
    <MotionPage subtle>
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link to="/hub" className="hover:text-foreground transition-colors">
                Hub
              </Link>
              <span>/</span>
              <span className="text-foreground">Katana Support</span>
            </div>
            <ModuleHelpButton moduleId="support" />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <LifeBuoy className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-tour="support-header">
                Katana Support
              </h1>
              <p className="text-sm text-muted-foreground">
                Report issues and share feedback during the pilot. The Katana team responds by email.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {!isSupabaseConfigured && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="pt-6 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Supabase not configured</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Support submissions require a database connection.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {isSupabaseConfigured && !emailConfigured && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="pt-6 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Support email not configured</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Set EmailJS variables so tickets reach the Katana pilot team.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {isPlatformOperator && (
          <Card className="bg-violet-500/5 border-violet-500/20">
            <CardContent className="pt-6 flex items-start gap-3">
              <Globe className="h-5 w-5 text-violet-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Katana platform operator</p>
                <p className="text-muted-foreground mt-1">
                  You can see and manage support tickets from <strong>all pilot organizations</strong>{' '}
                  in the <strong>Pilot Queue</strong> tab. Reply by email, then update status here.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-primary/5 border-primary/20" data-tour="support-workflow-banner">
          <CardContent className="pt-6 flex items-start gap-3">
            <Mail className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Hybrid workflow</p>
              <p className="text-muted-foreground mt-1">
                <strong className="text-foreground">Email:</strong> tickets go to katanatechnologysystems@gmail.com
                — reply directly to the pilot user.{' '}
                <strong className="text-foreground">Katana:</strong> Katana operators update status in the
                Pilot Queue after handling each ticket.
              </p>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} data-tour="support-tabs">
          <TabsList>
            <TabsTrigger value="submit">Submit</TabsTrigger>
            <TabsTrigger value="my-submissions" data-tour="support-my-submissions-tab">
              My Submissions
              {mySubmissions.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                  {mySubmissions.length}
                </Badge>
              )}
            </TabsTrigger>
            {isPlatformOperator && (
              <TabsTrigger value="pilot-queue">
                Pilot Queue
                {openPilotCount > 0 && (
                  <Badge variant="destructive" className="ml-2 h-5 px-1.5">
                    {openPilotCount}
                  </Badge>
                )}
              </TabsTrigger>
            )}
            {isOrgAdmin && !isPlatformOperator && (
              <TabsTrigger value="manage">Manage</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="submit" className="mt-4">
            <SubmitSubmissionForm
              submitterName={submitterName}
              submitterEmail={submitterEmail}
              organizationName={organizationName}
              onSubmitted={handleSubmitted}
            />
          </TabsContent>

          <TabsContent value="my-submissions" className="mt-4" data-tour="support-my-submissions">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-3">
                  Your submitted tickets. Click a row to view or delete test submissions.
                </p>
                <SubmissionsTable
                  submissions={mySubmissions}
                  onView={openDetail}
                  emptyMessage="You haven't submitted any requests yet."
                />
              </>
            )}
          </TabsContent>

          {isPlatformOperator && (
            <TabsContent value="pilot-queue" className="mt-4 space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Input
                      placeholder="Search all pilot tickets..."
                      value={pilotSearch}
                      onChange={(e) => setPilotSearch(e.target.value)}
                      className="sm:max-w-xs"
                    />
                    <Select
                      value={pilotStatusFilter}
                      onValueChange={(v) => setPilotStatusFilter(v as SubmissionStatus | 'all')}
                    >
                      <SelectTrigger className="sm:w-40">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        {(Object.keys(SUBMISSION_STATUS_LABELS) as SubmissionStatus[]).map((s) => (
                          <SelectItem key={s} value={s}>
                            {SUBMISSION_STATUS_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground sm:ml-auto">
                      {filteredPlatformSubmissions.length} of {platformSubmissions.length} tickets
                    </p>
                  </div>
                  <SubmissionsTable
                    submissions={filteredPlatformSubmissions}
                    onView={openDetail}
                    showSubmitter
                    showOrganization
                    emptyMessage="No pilot tickets yet."
                  />
                </>
              )}
            </TabsContent>
          )}

          {isOrgAdmin && !isPlatformOperator && (
            <TabsContent value="manage" className="mt-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mb-3">
                    Submissions from your organization only.
                  </p>
                  <SubmissionsTable
                    submissions={orgSubmissions}
                    onView={openDetail}
                    showSubmitter
                    emptyMessage="No submissions in your organization yet."
                  />
                </>
              )}
            </TabsContent>
          )}
        </Tabs>

        <Card className="bg-muted/30" data-tour="support-status-footer">
          <CardContent className="pt-6 flex items-start gap-3">
            <MessageSquare className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p>
                Status is updated in Katana after you handle a ticket by email — it does not change
                automatically from email replies. Katana operators use <strong className="text-foreground">Pilot Queue</strong> →
                open ticket → <strong className="text-foreground">Save status</strong>.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <SubmissionDetailDialog
        submission={selectedSubmission}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        canManage={canManageTickets}
        currentUserId={user?.id}
        actor={updateActor.userId ? updateActor : undefined}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
      />
    </MotionPage>
  )
}
