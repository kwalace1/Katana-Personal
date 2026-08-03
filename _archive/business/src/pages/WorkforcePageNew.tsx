import { formatDateOnly } from '@/lib/due-date-utils'
import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  Trash2,
  Loader2,
  Mail,
} from "lucide-react"
import {
  getTechnicians,
  getJobs,
  getWFMStats,
  getTechnicianActiveJobs,
  createTechnician,
  updateTechnician,
  deleteTechnician,
  createJob,
  updateJob,
  deleteJob,
  type Technician,
  type Job,
} from '@/lib/wfm-api'
import { isSupabaseConfigured } from '@/lib/supabase'

export default function WorkforcePage() {
  const [activeTab, setActiveTab] = useState("dashboard")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Data state
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [stats, setStats] = useState({
    totalTechnicians: 0,
    activeTechnicians: 0,
    totalJobs: 0,
    activeJobs: 0,
    completedJobs: 0,
    pendingTimesheets: 0,
  })
  const [technicianActiveJobs, setTechnicianActiveJobs] = useState<Record<string, number>>({})
  
  // Selection state
  const [selectedTechnicianIds, setSelectedTechnicianIds] = useState<string[]>([])
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([])
  
  // Dialog state
  const [isAddTechnicianOpen, setIsAddTechnicianOpen] = useState(false)
  const [isAddJobOpen, setIsAddJobOpen] = useState(false)
  const [editingTechnician, setEditingTechnician] = useState<Technician | null>(null)
  const [editingJob, setEditingJob] = useState<Job | null>(null)
  const [isDeleteTechDialogOpen, setIsDeleteTechDialogOpen] = useState(false)
  const [isDeleteJobDialogOpen, setIsDeleteJobDialogOpen] = useState(false)
  
  // Technician form state
  const [techName, setTechName] = useState("")
  const [techEmail, setTechEmail] = useState("")
  const [techPhone, setTechPhone] = useState("")
  const [techRole, setTechRole] = useState<"technician" | "lead" | "supervisor">("technician")
  const [techStatus, setTechStatus] = useState<"active" | "inactive" | "on-leave">("active")
  
  // Job form state
  const [jobTitle, setJobTitle] = useState("")
  const [jobDescription, setJobDescription] = useState("")
  const [jobCustomerName, setJobCustomerName] = useState("")
  const [jobCustomerPhone, setJobCustomerPhone] = useState("")
  const [jobLocation, setJobLocation] = useState("")
  const [jobTechnicianId, setJobTechnicianId] = useState("")
  const [jobStatus, setJobStatus] = useState<"assigned" | "in-progress" | "completed" | "on-hold" | "cancelled">("assigned")
  const [jobPriority, setJobPriority] = useState<"low" | "medium" | "high" | "urgent">("medium")
  const [jobStartDate, setJobStartDate] = useState("")
  const [jobEndDate, setJobEndDate] = useState("")
  const [jobEstimatedHours, setJobEstimatedHours] = useState("")

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [techsData, jobsData, statsData] = await Promise.all([
        getTechnicians(),
        getJobs(),
        getWFMStats(),
      ])
      
      setTechnicians(techsData)
      setJobs(jobsData)
      setStats(statsData)
      
      // Fetch active job counts for each technician
      const counts: Record<string, number> = {}
      for (const tech of techsData) {
        counts[tech.id] = await getTechnicianActiveJobs(tech.id)
      }
      setTechnicianActiveJobs(counts)
    } catch (error) {
      console.error('Error fetching WFM data:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetTechnicianForm = () => {
    setTechName("")
    setTechEmail("")
    setTechPhone("")
    setTechRole("technician")
    setTechStatus("active")
    setEditingTechnician(null)
  }

  const resetJobForm = () => {
    setJobTitle("")
    setJobDescription("")
    setJobCustomerName("")
    setJobCustomerPhone("")
    setJobLocation("")
    setJobTechnicianId("")
    setJobStatus("assigned")
    setJobPriority("medium")
    setJobStartDate("")
    setJobEndDate("")
    setJobEstimatedHours("")
    setEditingJob(null)
  }

  const handleSaveTechnician = async () => {
    if (!techName) {
      alert("Please enter technician name")
      return
    }

    setSaving(true)
    try {
      if (editingTechnician) {
        const updated = await updateTechnician(editingTechnician.id, {
          name: techName,
          email: techEmail || null,
          phone: techPhone || null,
          role: techRole,
          status: techStatus,
        })
        if (updated) {
          setTechnicians(technicians.map(t => t.id === updated.id ? updated : t))
        }
      } else {
        const newTech = await createTechnician({
          name: techName,
          email: techEmail || null,
          phone: techPhone || null,
          role: techRole,
          status: techStatus,
          skills: null,
          hourly_rate: null,
          avatar_url: null,
          notes: null,
          is_active: true,
        })
        if (newTech) {
          setTechnicians([...technicians, newTech])
        }
      }
      
      resetTechnicianForm()
      setIsAddTechnicianOpen(false)
      await fetchData() // Refresh stats
    } catch (error) {
      console.error('Error saving technician:', error)
      alert('Failed to save technician')
    } finally {
      setSaving(false)
    }
  }

  const handleEditTechnician = (tech: Technician) => {
    setEditingTechnician(tech)
    setTechName(tech.name)
    setTechEmail(tech.email || "")
    setTechPhone(tech.phone || "")
    setTechRole(tech.role)
    setTechStatus(tech.status)
    setIsAddTechnicianOpen(true)
  }

  const handleDeleteTechnicians = async () => {
    if (selectedTechnicianIds.length === 0) return

    setSaving(true)
    try {
      const deletePromises = selectedTechnicianIds.map(id => deleteTechnician(id))
      await Promise.all(deletePromises)
      
      await fetchData()
      setSelectedTechnicianIds([])
      setIsDeleteTechDialogOpen(false)
      alert(`Successfully deleted ${selectedTechnicianIds.length} technician(s)`)
    } catch (error) {
      console.error('Error deleting technicians:', error)
      alert('Failed to delete technicians')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveJob = async () => {
    if (!jobTitle) {
      alert("Please enter job title")
      return
    }

    setSaving(true)
    try {
      const jobData = {
        title: jobTitle,
        description: jobDescription || null,
        customer_name: jobCustomerName || null,
        client_id: null,
        customer_phone: jobCustomerPhone || null,
        customer_email: null,
        location: jobLocation || null,
        location_address: null,
        status: jobStatus,
        priority: jobPriority,
        technician_id: jobTechnicianId || null,
        start_date: jobStartDate ? new Date(jobStartDate).toISOString() : null,
        end_date: jobEndDate ? new Date(jobEndDate).toISOString() : null,
        start_time: null as string | null,
        end_time: null as string | null,
        estimated_hours: jobEstimatedHours ? parseFloat(jobEstimatedHours) : null,
        actual_hours: null,
        notes: null,
        completion_notes: null,
        is_active: true,
        project_id: null,
        task_id: null,
        invoice_id: null,
      }

      if (editingJob) {
        const updated = await updateJob(editingJob.id, jobData)
        if (updated) {
          setJobs(jobs.map(j => j.id === updated.id ? updated : j))
        }
      } else {
        const newJob = await createJob(jobData)
        if (newJob) {
          setJobs([newJob, ...jobs])
        }
      }
      
      resetJobForm()
      setIsAddJobOpen(false)
      await fetchData() // Refresh stats
    } catch (error) {
      console.error('Error saving job:', error)
      alert('Failed to save job')
    } finally {
      setSaving(false)
    }
  }

  const handleEditJob = (job: Job) => {
    setEditingJob(job)
    setJobTitle(job.title)
    setJobDescription(job.description || "")
    setJobCustomerName(job.customer_name || "")
    setJobCustomerPhone(job.customer_phone || "")
    setJobLocation(job.location || "")
    setJobTechnicianId(job.technician_id || "")
    setJobStatus(job.status)
    setJobPriority(job.priority)
    setJobStartDate(job.start_date ? job.start_date.split('T')[0] : "")
    setJobEndDate(job.end_date ? job.end_date.split('T')[0] : "")
    setJobEstimatedHours(job.estimated_hours?.toString() || "")
    setIsAddJobOpen(true)
  }

  const handleDeleteJobs = async () => {
    if (selectedJobIds.length === 0) return

    setSaving(true)
    try {
      const deletePromises = selectedJobIds.map(id => deleteJob(id))
      await Promise.all(deletePromises)
      
      await fetchData()
      setSelectedJobIds([])
      setIsDeleteJobDialogOpen(false)
      alert(`Successfully deleted ${selectedJobIds.length} job(s)`)
    } catch (error) {
      console.error('Error deleting jobs:', error)
      alert('Failed to delete jobs')
    } finally {
      setSaving(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'completed':
        return 'bg-green-500/10 text-green-600 border-green-500/20'
      case 'in-progress':
      case 'assigned':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20'
      case 'on-hold':
      case 'on-leave':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
      case 'cancelled':
      case 'inactive':
        return 'bg-red-500/10 text-red-600 border-red-500/20'
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500/10 text-red-600 border-red-500/20'
      case 'high':
        return 'bg-orange-500/10 text-orange-600 border-orange-500/20'
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
      case 'low':
        return 'bg-green-500/10 text-green-600 border-green-500/20'
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20'
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <Card className="p-8 text-center">
            <Briefcase className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Database Not Configured</h2>
            <p className="text-muted-foreground mb-4">
              Please configure your database environment variables to use Katana Workforce.
            </p>
            <p className="text-sm text-muted-foreground">
              Set <code className="bg-muted px-1 rounded">VITE_SUPABASE_URL</code> and{' '}
              <code className="bg-muted px-1 rounded">VITE_SUPABASE_ANON_KEY</code> in your .env file.
            </p>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 -mx-6 px-6 mb-6">
        <div className="py-6">
          <div className="flex items-center justify-between">
            <div>
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                <span className="hover:text-foreground cursor-pointer transition-colors">Home</span>
                <ChevronRight className="h-4 w-4" />
                <span className="text-foreground">Katana Workforce</span>
              </div>
              
              {/* Title with Icon */}
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2.5 rounded-lg">
                  <Briefcase className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-3xl font-bold">Katana Workforce</h1>
              </div>
              
              <p className="text-muted-foreground mt-2">Manage technicians, jobs, and schedules</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="dashboard">
            <BarChart3 className="w-4 h-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="jobs">
            <ClipboardCheck className="w-4 h-4 mr-2" />
            Jobs
          </TabsTrigger>
          <TabsTrigger value="technicians">
            <Users className="w-4 h-4 mr-2" />
            Technicians
          </TabsTrigger>
          <TabsTrigger value="timesheets">
            <Clock className="w-4 h-4 mr-2" />
            Timesheets
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          {/* KPI Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Total Technicians</p>
                <p className="text-3xl font-bold">{loading ? '-' : stats.totalTechnicians}</p>
                <p className="text-xs text-muted-foreground">{stats.activeTechnicians} active</p>
              </div>
            </Card>
            <Card className="p-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Active Jobs</p>
                <p className="text-3xl font-bold text-blue-600">{loading ? '-' : stats.activeJobs}</p>
                <p className="text-xs text-muted-foreground">{stats.totalJobs} total</p>
              </div>
            </Card>
            <Card className="p-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Completed Jobs</p>
                <p className="text-3xl font-bold text-green-600">{loading ? '-' : stats.completedJobs}</p>
              </div>
            </Card>
            <Card className="p-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Pending Timesheets</p>
                <p className="text-3xl font-bold text-yellow-600">{loading ? '-' : stats.pendingTimesheets}</p>
              </div>
            </Card>
          </div>

          {/* Recent Jobs */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Jobs</CardTitle>
              <CardDescription>Latest work orders and their status</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  <p className="text-muted-foreground">Loading jobs...</p>
                </div>
              ) : jobs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No jobs yet. Create your first job!
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job #</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Technician</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Start Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.slice(0, 5).map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-mono text-sm">{job.job_number}</TableCell>
                        <TableCell>{job.title}</TableCell>
                        <TableCell>{job.technician?.name || 'Unassigned'}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(job.status)}>
                            {job.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getPriorityColor(job.priority)}>
                            {job.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>{job.start_date ? formatDateOnly(job.start_date) : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Jobs Tab */}
        <TabsContent value="jobs" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Jobs & Work Orders</CardTitle>
                  <CardDescription>Manage all work orders and assignments</CardDescription>
                </div>
                <div className="flex gap-2">
                  {selectedJobIds.length > 0 && (
                    <Dialog open={isDeleteJobDialogOpen} onOpenChange={setIsDeleteJobDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete ({selectedJobIds.length})
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Delete Jobs</DialogTitle>
                          <DialogDescription>
                            Are you sure you want to delete {selectedJobIds.length} job(s)? This action cannot be undone.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="flex gap-2 pt-4">
                          <Button 
                            variant="destructive" 
                            className="flex-1" 
                            onClick={handleDeleteJobs}
                            disabled={saving}
                          >
                            {saving ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Deleting...
                              </>
                            ) : (
                              'Delete'
                            )}
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={() => setIsDeleteJobDialogOpen(false)}
                            disabled={saving}
                          >
                            Cancel
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                  <Dialog open={isAddJobOpen} onOpenChange={(open) => {
                    setIsAddJobOpen(open)
                    if (!open) resetJobForm()
                  }}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="w-4 h-4 mr-2" />
                        New Job
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>{editingJob ? 'Edit Job' : 'Create New Job'}</DialogTitle>
                        <DialogDescription>
                          {editingJob ? 'Update job details' : 'Create a new work order'}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="job-title">Job Title *</Label>
                            <Input
                              id="job-title"
                              placeholder="Enter job title"
                              value={jobTitle}
                              onChange={(e) => setJobTitle(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label htmlFor="job-technician">Assign Technician</Label>
                            <Select value={jobTechnicianId} onValueChange={setJobTechnicianId}>
                              <SelectTrigger id="job-technician">
                                <SelectValue placeholder="Select technician" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">Unassigned</SelectItem>
                                {technicians.filter(t => t.status === 'active').map((tech) => (
                                  <SelectItem key={tech.id} value={tech.id}>
                                    {tech.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="job-description">Description</Label>
                          <Textarea
                            id="job-description"
                            placeholder="Enter job description"
                            value={jobDescription}
                            onChange={(e) => setJobDescription(e.target.value)}
                            rows={3}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="job-customer">Customer Name</Label>
                            <Input
                              id="job-customer"
                              placeholder="Customer name"
                              value={jobCustomerName}
                              onChange={(e) => setJobCustomerName(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label htmlFor="job-customer-phone">Customer Phone</Label>
                            <Input
                              id="job-customer-phone"
                              placeholder="(555) 123-4567"
                              value={jobCustomerPhone}
                              onChange={(e) => setJobCustomerPhone(e.target.value)}
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="job-location">Location</Label>
                          <Input
                            id="job-location"
                            placeholder="Job location"
                            value={jobLocation}
                            onChange={(e) => setJobLocation(e.target.value)}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label htmlFor="job-status">Status</Label>
                            <Select value={jobStatus} onValueChange={(value: any) => setJobStatus(value)}>
                              <SelectTrigger id="job-status">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="assigned">Assigned</SelectItem>
                                <SelectItem value="in-progress">In Progress</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="on-hold">On Hold</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="job-priority">Priority</Label>
                            <Select value={jobPriority} onValueChange={(value: any) => setJobPriority(value)}>
                              <SelectTrigger id="job-priority">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="urgent">Urgent</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="job-hours">Estimated Hours</Label>
                            <Input
                              id="job-hours"
                              type="number"
                              step="0.5"
                              placeholder="4.0"
                              value={jobEstimatedHours}
                              onChange={(e) => setJobEstimatedHours(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="job-start-date">Start Date</Label>
                            <Input
                              id="job-start-date"
                              type="date"
                              value={jobStartDate}
                              onChange={(e) => setJobStartDate(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label htmlFor="job-end-date">End Date</Label>
                            <Input
                              id="job-end-date"
                              type="date"
                              value={jobEndDate}
                              onChange={(e) => setJobEndDate(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 pt-4">
                          <Button className="flex-1" onClick={handleSaveJob} disabled={saving}>
                            {saving ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              editingJob ? 'Update Job' : 'Create Job'
                            )}
                          </Button>
                          <Button variant="outline" onClick={() => {
                            setIsAddJobOpen(false)
                            resetJobForm()
                          }}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  <p className="text-muted-foreground">Loading jobs...</p>
                </div>
              ) : jobs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No jobs yet. Create your first job!
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={jobs.length > 0 && jobs.every(j => selectedJobIds.includes(j.id))}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedJobIds(jobs.map(j => j.id))
                            } else {
                              setSelectedJobIds([])
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Job #</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Technician</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedJobIds.includes(job.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedJobIds([...selectedJobIds, job.id])
                              } else {
                                setSelectedJobIds(selectedJobIds.filter(id => id !== job.id))
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">{job.job_number}</TableCell>
                        <TableCell>{job.title}</TableCell>
                        <TableCell>{job.customer_name || '-'}</TableCell>
                        <TableCell>{job.technician?.name || 'Unassigned'}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(job.status)}>
                            {job.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getPriorityColor(job.priority)}>
                            {job.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>{job.start_date ? formatDateOnly(job.start_date) : '-'}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => handleEditJob(job)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Technicians Tab */}
        <TabsContent value="technicians" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Technicians</CardTitle>
                  <CardDescription>Manage your workforce</CardDescription>
                </div>
                <div className="flex gap-2">
                  {selectedTechnicianIds.length > 0 && (
                    <Dialog open={isDeleteTechDialogOpen} onOpenChange={setIsDeleteTechDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete ({selectedTechnicianIds.length})
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Delete Technicians</DialogTitle>
                          <DialogDescription>
                            Are you sure you want to delete {selectedTechnicianIds.length} technician(s)? This action cannot be undone.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="flex gap-2 pt-4">
                          <Button 
                            variant="destructive" 
                            className="flex-1" 
                            onClick={handleDeleteTechnicians}
                            disabled={saving}
                          >
                            {saving ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Deleting...
                              </>
                            ) : (
                              'Delete'
                            )}
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={() => setIsDeleteTechDialogOpen(false)}
                            disabled={saving}
                          >
                            Cancel
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                  <Dialog open={isAddTechnicianOpen} onOpenChange={(open) => {
                    setIsAddTechnicianOpen(open)
                    if (!open) resetTechnicianForm()
                  }}>
                    <DialogTrigger asChild>
                      <Button>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Add Technician
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{editingTechnician ? 'Edit Technician' : 'Add New Technician'}</DialogTitle>
                        <DialogDescription>
                          {editingTechnician ? 'Update technician details' : 'Add a new technician to your workforce'}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="tech-name">Name *</Label>
                          <Input
                            id="tech-name"
                            placeholder="Enter name"
                            value={techName}
                            onChange={(e) => setTechName(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="tech-email">Email</Label>
                          <Input
                            id="tech-email"
                            type="email"
                            placeholder="email@example.com"
                            value={techEmail}
                            onChange={(e) => setTechEmail(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="tech-phone">Phone</Label>
                          <Input
                            id="tech-phone"
                            placeholder="(555) 123-4567"
                            value={techPhone}
                            onChange={(e) => setTechPhone(e.target.value)}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="tech-role">Role</Label>
                            <Select value={techRole} onValueChange={(value: any) => setTechRole(value)}>
                              <SelectTrigger id="tech-role">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="technician">Technician</SelectItem>
                                <SelectItem value="lead">Lead</SelectItem>
                                <SelectItem value="supervisor">Supervisor</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="tech-status">Status</Label>
                            <Select value={techStatus} onValueChange={(value: any) => setTechStatus(value)}>
                              <SelectTrigger id="tech-status">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                                <SelectItem value="on-leave">On Leave</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-4">
                          <Button className="flex-1" onClick={handleSaveTechnician} disabled={saving}>
                            {saving ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              editingTechnician ? 'Update Technician' : 'Add Technician'
                            )}
                          </Button>
                          <Button variant="outline" onClick={() => {
                            setIsAddTechnicianOpen(false)
                            resetTechnicianForm()
                          }}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  <p className="text-muted-foreground">Loading technicians...</p>
                </div>
              ) : technicians.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No technicians yet. Add your first technician!
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={technicians.length > 0 && technicians.every(t => selectedTechnicianIds.includes(t.id))}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedTechnicianIds(technicians.map(t => t.id))
                            } else {
                              setSelectedTechnicianIds([])
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Active Jobs</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {technicians.map((tech) => (
                      <TableRow key={tech.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedTechnicianIds.includes(tech.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedTechnicianIds([...selectedTechnicianIds, tech.id])
                              } else {
                                setSelectedTechnicianIds(selectedTechnicianIds.filter(id => id !== tech.id))
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{tech.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {tech.email || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {tech.phone || '-'}
                        </TableCell>
                        <TableCell className="capitalize">{tech.role}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(tech.status)}>
                            {tech.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{technicianActiveJobs[tech.id] || 0}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => handleEditTechnician(tech)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timesheets Tab */}
        <TabsContent value="timesheets" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Timesheets</CardTitle>
              <CardDescription>Track technician hours and attendance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Timesheet management coming soon...</p>
                <p className="text-sm mt-2">Clock in/out, break tracking, and time approval features</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}






