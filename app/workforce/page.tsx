import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Briefcase,
  Users,
  ClipboardCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  MapPin,
  Phone,
  Edit,
  UserPlus,
  Plus,
  ChevronRight,
  BarChart3,
  FileText,
  Settings,
  Loader2,
  Trash2,
} from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  getJobs,
  getTechnicians,
  getTimesheets,
  deleteTechnician,
  type Job,
  type Technician,
  type Timesheet,
} from "@/lib/wfm-api"

export default function WorkforcePage() {
  const [activePortal, setActivePortal] = useState<"admin" | "technician">("admin")
  const [activeTab, setActiveTab] = useState("dashboard")
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [timesheets, setTimesheets] = useState<Timesheet[]>([])
  const [technicianToDelete, setTechnicianToDelete] = useState<Technician | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Calculate metrics from fetched data
  const totalJobs = jobs.length
  const activeTechnicians = technicians.filter(t => t.status === 'active' && t.is_active).length
  const assignedJobs = jobs.filter(j => j.status === 'assigned').length
  const inProgressJobs = jobs.filter(j => j.status === 'in-progress').length
  
  // Calculate completed this week
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  const completedThisWeek = jobs.filter(j => {
    if (j.status !== 'completed') return false
    const completedDate = j.updated_at ? new Date(j.updated_at) : null
    return completedDate && completedDate >= startOfWeek
  }).length

  // Calculate overdue jobs (end_date in the past and status not completed)
  const overdueJobs = jobs.filter(j => {
    if (j.status === 'completed' || j.status === 'cancelled') return false
    if (!j.end_date) return false
    const endDate = new Date(j.end_date)
    return endDate < new Date()
  }).length

  // Jobs this week (start_date in current week)
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(endOfWeek.getDate() + 6)
  endOfWeek.setHours(23, 59, 59, 999)
  const jobsThisWeek = jobs.filter(j => {
    if (!j.start_date) return false
    const d = new Date(j.start_date)
    return d >= startOfWeek && d <= endOfWeek
  }).length

  // Jobs this month (start_date in current month)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  const jobsThisMonth = jobs.filter(j => {
    if (!j.start_date) return false
    const d = new Date(j.start_date)
    return d >= startOfMonth && d <= endOfMonth
  }).length

  // Top performers by completed jobs
  const completedByTechnician = jobs
    .filter(j => j.status === 'completed' && j.technician_id)
    .reduce<Record<string, number>>((acc, j) => {
      const tid = j.technician_id!
      acc[tid] = (acc[tid] || 0) + 1
      return acc
    }, {})
  const topPerformers = Object.entries(completedByTechnician)
    .map(([techId, count]) => ({
      name: technicians.find(t => t.id === techId)?.name ?? 'Unknown',
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 2)

  // Jobs needing attention (overdue + on-hold)
  const jobsNeedingAttention = jobs.filter(j => {
    if (j.status === 'completed' || j.status === 'cancelled') return false
    if (j.status === 'on-hold') return true
    if (j.end_date && new Date(j.end_date) < new Date()) return true
    return false
  }).length

  // Time tracking stats from real timesheet data (no hardcoded values)
  const activeClockIns = timesheets.filter(t => !t.clock_out).length
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(todayStart)
  todayEnd.setDate(todayEnd.getDate() + 1)
  const hoursToday = timesheets
    .filter(t => {
      const clockIn = new Date(t.clock_in)
      return clockIn >= todayStart && clockIn < todayEnd
    })
    .reduce((sum, t) => sum + (t.total_hours ?? 0), 0)
  const hoursThisWeek = timesheets
    .filter(t => {
      const clockIn = new Date(t.clock_in)
      return clockIn >= startOfWeek && clockIn <= endOfWeek
    })
    .reduce((sum, t) => sum + (t.total_hours ?? 0), 0)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [jobsData, techniciansData, timesheetsData] = await Promise.all([
        getJobs(),
        getTechnicians(),
        getTimesheets(),
      ])
      setJobs(jobsData)
      setTechnicians(techniciansData)
      setTimesheets(timesheetsData)
    } catch (error) {
      console.error('Error fetching WFM data:', error)
    } finally {
      setLoading(false)
    }
  }

  const recentActivity: string[] = []

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "assigned":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20"
      case "in-progress":
      case "in progress":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
      case "completed":
        return "bg-green-500/10 text-green-500 border-green-500/20"
      case "on-hold":
      case "on hold":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20"
      case "cancelled":
        return "bg-gray-500/10 text-gray-500 border-gray-500/20"
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20"
    }
  }

  const formatStatus = (status: string) => {
    switch (status) {
      case "assigned":
        return "Assigned"
      case "in-progress":
        return "In Progress"
      case "completed":
        return "Completed"
      case "on-hold":
        return "On Hold"
      case "cancelled":
        return "Cancelled"
      default:
        return status
    }
  }

  return (
    <div className="min-h-screen bg-background my-24 border-0">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <span>Katana Hub</span>
                <ChevronRight className="h-4 w-4" />
                <span>Workflow Management</span>
              </div>
              <h1 className="text-3xl font-bold">Workflow Management</h1>
              <p className="text-muted-foreground">TaskBeacon</p>
            </div>
            <div className="flex gap-3">
              <Button
                variant={activePortal === "admin" ? "default" : "outline"}
                onClick={() => setActivePortal("admin")}
              >
                <Settings className="h-4 w-4 mr-2" />
                Admin Console
              </Button>
              <Button
                variant={activePortal === "technician" ? "default" : "outline"}
                onClick={() => setActivePortal("technician")}
              >
                <Users className="h-4 w-4 mr-2" />
                Technician Portal
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Portal */}
      {activePortal === "admin" && (
        <div className="container mx-auto px-4 py-8">
          {/* Stats – one rectangular bar */}
          <Card className="overflow-hidden border-border bg-card/50 mb-6">
            <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border">
              <div className="flex-1 flex items-center gap-4 px-6 py-5 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Briefcase className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-muted-foreground">Total Jobs</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {loading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : totalJobs}
                  </p>
                </div>
              </div>
              <div className="flex-1 flex items-center gap-4 px-6 py-5 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Users className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-muted-foreground">Active Technicians</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {loading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : activeTechnicians}
                  </p>
                </div>
              </div>
              <div className="flex-1 flex items-center gap-4 px-6 py-5 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-muted-foreground">Assigned Jobs</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {loading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : assignedJobs}
                  </p>
                </div>
              </div>
              <div className="flex-1 flex items-center gap-4 px-6 py-5 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-muted-foreground">In Progress</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {loading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : inProgressJobs}
                  </p>
                </div>
              </div>
              <div className="flex-1 flex items-center gap-4 px-6 py-5 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-muted-foreground">Completed This Week</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {loading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : completedThisWeek}
                  </p>
                </div>
              </div>
              <div className="flex-1 flex items-center gap-4 px-6 py-5 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-muted-foreground">Overdue Jobs</p>
                  <p className="text-2xl font-bold tabular-nums text-red-500">
                    {loading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : overdueJobs}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Main Content */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList>
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
              <TabsTrigger value="jobs">Jobs</TabsTrigger>
              <TabsTrigger value="technicians">Technicians</TabsTrigger>
              <TabsTrigger value="timesheets">Timesheets</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Jobs Management Table */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Jobs Management</CardTitle>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm">
                            <Plus className="h-4 w-4 mr-2" />
                            New Job
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Create New Job</DialogTitle>
                            <DialogDescription>Add a new job to the system</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="job-title">Job Title</Label>
                              <Input id="job-title" placeholder="Enter job title" />
                            </div>
                            <div>
                              <Label htmlFor="job-description">Description</Label>
                              <Textarea id="job-description" placeholder="Enter job description" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="start-date">Start Date</Label>
                                <Input id="start-date" type="date" />
                              </div>
                              <div>
                                <Label htmlFor="end-date">End Date</Label>
                                <Input id="end-date" type="date" />
                              </div>
                            </div>
                            <Button className="w-full">Create Job</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : jobs.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No jobs found. Create your first job!
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Job #</TableHead>
                            <TableHead>Title</TableHead>
                            <TableHead>Technician</TableHead>
                            <TableHead>Start Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {jobs.slice(0, 10).map((job) => (
                            <TableRow key={job.id}>
                              <TableCell className="font-medium">{job.job_number}</TableCell>
                              <TableCell>{job.title}</TableCell>
                              <TableCell>{job.technician?.name || 'Unassigned'}</TableCell>
                              <TableCell>{job.start_date ? new Date(job.start_date).toLocaleDateString() : '-'}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={getStatusColor(job.status)}>
                                  {formatStatus(job.status)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm">
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                {/* Right Column */}
                <div className="space-y-6">
                  {/* Quick Stats */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Quick Stats</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Jobs This Week</span>
                        <span className="font-bold">{loading ? '–' : jobsThisWeek}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Jobs This Month</span>
                        <span className="font-bold">{loading ? '–' : jobsThisMonth}</span>
                      </div>
                      <div className="pt-2 border-t">
                        <p className="text-sm font-medium mb-2">Top Performers</p>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          {loading ? (
                            <div>–</div>
                          ) : topPerformers.length === 0 ? (
                            <div>No completed jobs yet</div>
                          ) : (
                            topPerformers.map((p) => (
                              <div key={p.name}>{p.name} ({p.count} jobs)</div>
                            ))
                          )}
                        </div>
                      </div>
                      <div className="pt-2 border-t">
                        <div className="flex items-center gap-2 text-red-500">
                          <AlertCircle className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            {loading ? '–' : `${jobsNeedingAttention} job${jobsNeedingAttention !== 1 ? 's' : ''} need attention`}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Recent Activity */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Recent Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {loading ? (
                          <div className="text-sm text-muted-foreground">Loading…</div>
                        ) : recentActivity.length === 0 ? (
                          <div className="text-sm text-muted-foreground">No recent activity</div>
                        ) : (
                          recentActivity.map((activity, index) => (
                            <div key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                              <div className="h-2 w-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                              <span>{activity}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="schedule">
              <Card>
                <CardHeader>
                  <CardTitle>Schedule Calendar</CardTitle>
                  <CardDescription>View and manage job schedules</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center h-64 text-muted-foreground">
                    <div className="text-center">
                      <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Calendar view coming soon</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="jobs">
              <Card>
                <CardHeader>
                  <CardTitle>All Jobs</CardTitle>
                  <CardDescription>Manage all jobs in the system</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : jobs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No jobs found. Create your first job!
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Job #</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Technician</TableHead>
                          <TableHead>Start Date</TableHead>
                          <TableHead>End Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {jobs.map((job) => (
                          <TableRow key={job.id}>
                            <TableCell className="font-medium">{job.job_number}</TableCell>
                            <TableCell>{job.title}</TableCell>
                            <TableCell>{job.technician?.name || 'Unassigned'}</TableCell>
                            <TableCell>{job.start_date ? new Date(job.start_date).toLocaleDateString() : '-'}</TableCell>
                            <TableCell>{job.end_date ? new Date(job.end_date).toLocaleDateString() : '-'}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={getStatusColor(job.status)}>
                                {formatStatus(job.status)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button variant="ghost" size="sm">
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm">
                                  <MapPin className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="technicians">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Technician Management</CardTitle>
                      <CardDescription>Manage your field technicians</CardDescription>
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Add Technician
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add New Technician</DialogTitle>
                          <DialogDescription>Create a new technician account</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="tech-name">Full Name</Label>
                            <Input id="tech-name" placeholder="Enter full name" />
                          </div>
                          <div>
                            <Label htmlFor="tech-phone">Phone</Label>
                            <Input id="tech-phone" placeholder="(555) 123-4567" />
                          </div>
                          <div>
                            <Label htmlFor="tech-email">Email</Label>
                            <Input id="tech-email" type="email" placeholder="email@example.com" />
                          </div>
                          <Button className="w-full">Create Technician</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : technicians.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No technicians found. Add your first technician!
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {technicians.map((tech) => {
                          const activeJobCount = jobs.filter(j => j.technician_id === tech.id && (j.status === 'assigned' || j.status === 'in-progress')).length
                          return (
                            <TableRow key={tech.id}>
                              <TableCell className="font-medium">{tech.name}</TableCell>
                              <TableCell>{tech.phone || '-'}</TableCell>
                              <TableCell>{tech.email || '-'}</TableCell>
                              <TableCell>{tech.role}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={
                                  tech.status === 'active' 
                                    ? "bg-green-500/10 text-green-500 border-green-500/20"
                                    : tech.status === 'inactive'
                                    ? "bg-gray-500/10 text-gray-500 border-gray-500/20"
                                    : "bg-orange-500/10 text-orange-500 border-orange-500/20"
                                }>
                                  {tech.status === 'active' ? 'Active' : tech.status === 'inactive' ? 'Inactive' : 'On Leave'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="sm" title="Edit technician">
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    title="Delete technician"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => setTechnicianToDelete(tech)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <AlertDialog open={!!technicianToDelete} onOpenChange={(open) => !open && setTechnicianToDelete(null)}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete technician</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to remove {technicianToDelete?.name}? They will be removed from the
                      technician list. Any jobs assigned to them will become unassigned.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.preventDefault()
                        handleDeleteTechnician()
                      }}
                      disabled={deleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Deleting…
                        </>
                      ) : (
                        "Delete"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </TabsContent>

            <TabsContent value="timesheets">
              <Card>
                <CardHeader>
                  <CardTitle>Time Tracking</CardTitle>
                  <CardDescription>Monitor technician hours and timesheets</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{loading ? "—" : activeClockIns}</div>
                        <p className="text-sm text-muted-foreground">Active Clock-ins</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{loading ? "—" : hoursToday.toFixed(1)}</div>
                        <p className="text-sm text-muted-foreground">Hours Today</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{loading ? "—" : hoursThisWeek.toFixed(1)}</div>
                        <p className="text-sm text-muted-foreground">Hours This Week</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className={`text-2xl font-bold ${activeClockIns > 0 ? "text-yellow-500" : ""}`}>
                          {loading ? "—" : activeClockIns}
                        </div>
                        <p className="text-sm text-muted-foreground">Open Entries</p>
                      </CardContent>
                    </Card>
                  </div>
                  {loading ? (
                    <div className="flex items-center justify-center h-32 text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : timesheets.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-muted-foreground">
                      <div className="text-center">
                        <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No timesheet entries yet. Time entries will appear here when tracked.</p>
                      </div>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Technician</TableHead>
                          <TableHead>Clock In</TableHead>
                          <TableHead>Clock Out</TableHead>
                          <TableHead>Hours</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {timesheets.map((ts) => (
                          <TableRow key={ts.id}>
                            <TableCell className="font-medium">{ts.technician?.name ?? "—"}</TableCell>
                            <TableCell>{new Date(ts.clock_in).toLocaleString()}</TableCell>
                            <TableCell>{ts.clock_out ? new Date(ts.clock_out).toLocaleString() : "—"}</TableCell>
                            <TableCell>{ts.total_hours != null ? ts.total_hours.toFixed(1) : "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={
                                ts.status === "approved"
                                  ? "bg-green-500/10 text-green-500 border-green-500/20"
                                  : ts.status === "rejected"
                                  ? "bg-red-500/10 text-red-500 border-red-500/20"
                                  : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                              }>
                                {ts.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reports">
              <Card>
                <CardHeader>
                  <CardTitle>Reports & Analytics</CardTitle>
                  <CardDescription>View performance metrics and export data</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <BarChart3 className="h-8 w-8 mb-4 text-muted-foreground" />
                        <h3 className="font-semibold mb-2">Performance Metrics</h3>
                        <p className="text-sm text-muted-foreground">Job completion rates and efficiency</p>
                        <Button variant="outline" className="w-full mt-4 bg-transparent">
                          View Report
                        </Button>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <FileText className="h-8 w-8 mb-4 text-muted-foreground" />
                        <h3 className="font-semibold mb-2">Export Data</h3>
                        <p className="text-sm text-muted-foreground">Download CSV and PDF reports</p>
                        <Button variant="outline" className="w-full mt-4 bg-transparent">
                          Export
                        </Button>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <Calendar className="h-8 w-8 mb-4 text-muted-foreground" />
                        <h3 className="font-semibold mb-2">Scheduled Reports</h3>
                        <p className="text-sm text-muted-foreground">Automated daily and weekly reports</p>
                        <Button variant="outline" className="w-full mt-4 bg-transparent">
                          Configure
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Technician Portal */}
      {activePortal === "technician" && (
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Briefcase className="h-5 w-5 text-muted-foreground" />
                  <span className="text-2xl font-bold">3</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium">Jobs Today</p>
                <p className="text-xs text-muted-foreground">Assigned to you</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-bold">HVAC Repair at 2:00 PM</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium">Next Job</p>
                <p className="text-xs text-muted-foreground">Starting soon</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                  <span className="text-2xl font-bold">32.5</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium">Hours This Week</p>
                <p className="text-xs text-muted-foreground">Time logged</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="today" className="space-y-6">
            <TabsList>
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
              <TabsTrigger value="map">Map</TabsTrigger>
              <TabsTrigger value="profile">Profile</TabsTrigger>
            </TabsList>

            <TabsContent value="today" className="space-y-4">
              {jobs.slice(0, 3).map((job) => (
                <Card key={job.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{job.title}</CardTitle>
                        <CardDescription>
                          {job.id} • {job.startDate}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className={getStatusColor(job.status)}>
                        {job.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>123 Main St, City, State 12345</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>(555) 987-6543</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1 border bg-primary-foreground text-white">Start Job</Button>
                      <Button variant="outline">View Details</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="upcoming">
              <Card>
                <CardHeader>
                  <CardTitle>Upcoming Jobs</CardTitle>
                  <CardDescription>Your scheduled jobs for the next 7 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {jobs.map((job) => (
                      <div key={job.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-medium">{job.title}</p>
                          <p className="text-sm text-muted-foreground">{job.startDate}</p>
                        </div>
                        <Badge variant="outline" className={getStatusColor(job.status)}>
                          {job.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="calendar">
              <Card>
                <CardHeader>
                  <CardTitle>Job Calendar</CardTitle>
                  <CardDescription>Monthly view of your assignments</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center h-64 text-muted-foreground">
                    <div className="text-center">
                      <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Calendar view coming soon</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="map">
              <Card>
                <CardHeader>
                  <CardTitle>Job Locations</CardTitle>
                  <CardDescription>Map view of your assigned jobs</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center h-64 text-muted-foreground">
                    <div className="text-center">
                      <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Map view coming soon</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <CardTitle>Profile Settings</CardTitle>
                  <CardDescription>Manage your account information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="profile-name">Full Name</Label>
                    <Input id="profile-name" placeholder="Your name" />
                  </div>
                  <div>
                    <Label htmlFor="profile-phone">Phone</Label>
                    <Input id="profile-phone" defaultValue="(555) 123-4567" />
                  </div>
                  <div>
                    <Label htmlFor="profile-email">Email</Label>
                    <Input id="profile-email" type="email" defaultValue="john.smith@example.com" />
                  </div>
                  <Button>Save Changes</Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
}
