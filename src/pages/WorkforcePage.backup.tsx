import { formatDateOnly } from '@/lib/due-date-utils'
import { useState } from 'react'
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
  Settings,
  Trash2,
} from "lucide-react"

export default function WorkforcePage() {
  const [activePortal, setActivePortal] = useState<"admin" | "technician">("admin")
  const [activeTab, setActiveTab] = useState("dashboard")
  
  // State management for calendar and jobs
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [viewingCalendarJob, setViewingCalendarJob] = useState<any>(null)
  const [editingCalendarJob, setEditingCalendarJob] = useState<any>(null)
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([])
  const [editingJob, setEditingJob] = useState<string | null>(null)
  const [viewingJobLocation, setViewingJobLocation] = useState<string | null>(null)
  
  // Edit form state for jobs
  const [editJobTitle, setEditJobTitle] = useState("")
  const [editJobTechnician, setEditJobTechnician] = useState("")
  const [editJobStartDate, setEditJobStartDate] = useState("")
  const [editJobEndDate, setEditJobEndDate] = useState("")
  const [editJobStatus, setEditJobStatus] = useState("")
  const [editJobLocation, setEditJobLocation] = useState("")
  const [editJobNotes, setEditJobNotes] = useState("")

  // Create job form state
  const [isCreateJobOpen, setIsCreateJobOpen] = useState(false)
  const [newJobTitle, setNewJobTitle] = useState("")
  const [newJobDescription, setNewJobDescription] = useState("")
  const [newJobTechnician, setNewJobTechnician] = useState("")
  const [newJobStartDate, setNewJobStartDate] = useState("")
  const [newJobEndDate, setNewJobEndDate] = useState("")
  const [newJobStatus, setNewJobStatus] = useState("Assigned")

  // Create technician form state
  const [isAddTechnicianOpen, setIsAddTechnicianOpen] = useState(false)
  const [newTechName, setNewTechName] = useState("")
  const [newTechPhone, setNewTechPhone] = useState("")
  const [newTechEmail, setNewTechEmail] = useState("")

  // Edit technician form state
  const [editingTechnicianIndex, setEditingTechnicianIndex] = useState<number | null>(null)
  const [editTechName, setEditTechName] = useState("")
  const [editTechPhone, setEditTechPhone] = useState("")
  const [editTechEmail, setEditTechEmail] = useState("")
  const [editTechStatus, setEditTechStatus] = useState("")

  // Selection state for technicians
  const [selectedTechnicianIndices, setSelectedTechnicianIndices] = useState<number[]>([])

  // Timesheet state
  interface TimesheetEntry {
    id: string
    technician: string
    date: string
    jobId: string
    jobTitle: string
    clockIn: string
    clockOut: string
    hours: number
    status: string
    notes: string
  }

  const [timesheets, setTimesheets] = useState<TimesheetEntry[]>([
    {
      id: "#TS001",
      technician: "John Smith",
      date: "Jan 22, 2025",
      jobId: "#101",
      jobTitle: "HVAC Repair",
      clockIn: "08:00 AM",
      clockOut: "04:30 PM",
      hours: 8.5,
      status: "Approved",
      notes: "Completed installation"
    },
    {
      id: "#TS002",
      technician: "Sarah Johnson",
      date: "Jan 22, 2025",
      jobId: "#102",
      jobTitle: "Electrical Work",
      clockIn: "09:00 AM",
      clockOut: "05:00 PM",
      hours: 8,
      status: "Pending",
      notes: ""
    },
    {
      id: "#TS003",
      technician: "Mike Davis",
      date: "Jan 22, 2025",
      jobId: "#103",
      jobTitle: "Plumbing Fix",
      clockIn: "07:30 AM",
      clockOut: "",
      hours: 0,
      status: "Active",
      notes: ""
    },
  ])

  const [isAddTimesheetOpen, setIsAddTimesheetOpen] = useState(false)
  const [newTimesheetTechnician, setNewTimesheetTechnician] = useState("")
  const [newTimesheetJob, setNewTimesheetJob] = useState("")
  const [newTimesheetDate, setNewTimesheetDate] = useState("")
  const [newTimesheetClockIn, setNewTimesheetClockIn] = useState("")
  const [newTimesheetClockOut, setNewTimesheetClockOut] = useState("")
  const [newTimesheetNotes, setNewTimesheetNotes] = useState("")

  const [editingTimesheetId, setEditingTimesheetId] = useState<string | null>(null)
  const [editTimesheetTechnician, setEditTimesheetTechnician] = useState("")
  const [editTimesheetJob, setEditTimesheetJob] = useState("")
  const [editTimesheetDate, setEditTimesheetDate] = useState("")
  const [editTimesheetClockIn, setEditTimesheetClockIn] = useState("")
  const [editTimesheetClockOut, setEditTimesheetClockOut] = useState("")
  const [editTimesheetStatus, setEditTimesheetStatus] = useState("")
  const [editTimesheetNotes, setEditTimesheetNotes] = useState("")

  const [selectedTimesheetIds, setSelectedTimesheetIds] = useState<string[]>([])

  // Sample data
  const [jobs, setJobs] = useState([
    {
      id: "#101",
      title: "HVAC Repair",
      technician: "John Smith",
      startDate: "Jan 15, 2025",
      endDate: "Jan 15, 2025",
      status: "In Progress",
    },
    {
      id: "#102",
      title: "Plumbing Check",
      technician: "Sarah Johnson",
      startDate: "Jan 16, 2025",
      endDate: "Jan 16, 2025",
      status: "Assigned",
    },
    {
      id: "#103",
      title: "Electrical Install",
      technician: "Mike Davis",
      startDate: "Jan 17, 2025",
      endDate: "Jan 17, 2025",
      status: "Completed",
    },
    {
      id: "#104",
      title: "Roof Inspection",
      technician: "John Smith",
      startDate: "Jan 18, 2025",
      endDate: "Jan 18, 2025",
      status: "Assigned",
    },
    {
      id: "#105",
      title: "Paint Job",
      technician: "Sarah Johnson",
      startDate: "Jan 19, 2025",
      endDate: "Jan 19, 2025",
      status: "Overdue",
    },
  ])

  const [technicians, setTechnicians] = useState([
    { name: "John Smith", phone: "(555) 123-4567", activeJobs: 2, status: "Active" },
    { name: "Sarah Johnson", phone: "(555) 234-5678", activeJobs: 2, status: "Active" },
    { name: "Mike Davis", phone: "(555) 345-6789", activeJobs: 1, status: "Active" },
  ])

  const recentActivity = [
    "Job #103 completed by Mike Davis",
    "New job #104 assigned to John Smith",
    "Sarah Johnson started job #102",
    "Technician login: Mike Davis at 8:30 AM",
  ]

  // Calendar helper functions
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()
    
    return { daysInMonth, startingDayOfWeek, year, month }
  }

  const getJobsForDate = (date: Date) => {
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    return jobs.filter(job => {
      const jobStartDate = job.startDate
      return jobStartDate === dateStr
    })
  }

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }

  const goToToday = () => {
    setCurrentMonth(new Date())
  }

  // Job selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedJobIds(jobs.map(job => job.id))
    } else {
      setSelectedJobIds([])
    }
  }

  const handleSelectJob = (jobId: string, checked: boolean) => {
    if (checked) {
      setSelectedJobIds([...selectedJobIds, jobId])
    } else {
      setSelectedJobIds(selectedJobIds.filter(id => id !== jobId))
    }
  }

  const handleDeleteSelected = () => {
    if (selectedJobIds.length === 0) return
    
    if (confirm(`Are you sure you want to delete ${selectedJobIds.length} job(s)?`)) {
      const updatedJobs = jobs.filter(j => !selectedJobIds.includes(j.id))
      setJobs(updatedJobs)
      setSelectedJobIds([])
    }
  }

  // Job management handlers
  const handleSaveCalendarJob = () => {
    if (!editingCalendarJob) return

    const updatedJobs = jobs.map(job => {
      if (job.id === editingCalendarJob.id) {
        return {
          ...job,
          title: editJobTitle,
          technician: editJobTechnician,
          startDate: editJobStartDate,
          endDate: editJobEndDate,
          status: editJobStatus,
        }
      }
      return job
    })

    setJobs(updatedJobs)
    setEditingCalendarJob(null)
    
    setEditJobTitle("")
    setEditJobTechnician("")
    setEditJobStartDate("")
    setEditJobEndDate("")
    setEditJobStatus("")
    setEditJobLocation("")
    setEditJobNotes("")
  }

  const handleCreateJob = () => {
    if (!newJobTitle || !newJobStartDate || !newJobEndDate) {
      alert("Please fill in all required fields (Title, Start Date, End Date)")
      return
    }

    const maxId = Math.max(...jobs.map(j => parseInt(j.id.slice(1))))
    const newId = `#${maxId + 1}`

    const formattedStartDate = formatDateOnly(newJobStartDate, 'en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    })
    const formattedEndDate = formatDateOnly(newJobEndDate, 'en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    })

    const newJob = {
      id: newId,
      title: newJobTitle,
      technician: newJobTechnician || "Unassigned",
      startDate: formattedStartDate,
      endDate: formattedEndDate,
      status: newJobStatus,
    }

    setJobs([...jobs, newJob])
    
    setNewJobTitle("")
    setNewJobDescription("")
    setNewJobTechnician("")
    setNewJobStartDate("")
    setNewJobEndDate("")
    setNewJobStatus("Assigned")
    setIsCreateJobOpen(false)
  }

  // Technician management handlers
  const handleAddTechnician = () => {
    if (!newTechName || !newTechPhone) {
      alert("Please fill in all required fields (Name and Phone)")
      return
    }

    const newTechnician = {
      name: newTechName,
      phone: newTechPhone,
      activeJobs: 0,
      status: "Active",
    }

    setTechnicians([...technicians, newTechnician])
    
    setNewTechName("")
    setNewTechPhone("")
    setNewTechEmail("")
    setIsAddTechnicianOpen(false)
  }

  const formatPhoneNumber = (value: string) => {
    const phoneNumber = value.replace(/\D/g, '')
    
    if (phoneNumber.length <= 3) {
      return phoneNumber
    } else if (phoneNumber.length <= 6) {
      return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`
    } else {
      return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`
    }
  }

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value)
    setNewTechPhone(formatted)
  }

  const handleEditPhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value)
    setEditTechPhone(formatted)
  }

  const handleEditTechnician = (index: number) => {
    const tech = technicians[index]
    setEditingTechnicianIndex(index)
    setEditTechName(tech.name)
    setEditTechPhone(tech.phone)
    setEditTechEmail("")
    setEditTechStatus(tech.status)
  }

  const handleSaveTechnician = () => {
    if (!editTechName || !editTechPhone) {
      alert("Please fill in all required fields (Name and Phone)")
      return
    }

    if (editingTechnicianIndex === null) return

    const updatedTechnicians = [...technicians]
    updatedTechnicians[editingTechnicianIndex] = {
      ...updatedTechnicians[editingTechnicianIndex],
      name: editTechName,
      phone: editTechPhone,
      status: editTechStatus,
    }

    setTechnicians(updatedTechnicians)
    
    setEditingTechnicianIndex(null)
    setEditTechName("")
    setEditTechPhone("")
    setEditTechEmail("")
    setEditTechStatus("")
  }

  const handleSelectAllTechnicians = (checked: boolean) => {
    if (checked) {
      setSelectedTechnicianIndices(technicians.map((_, index) => index))
    } else {
      setSelectedTechnicianIndices([])
    }
  }

  const handleSelectTechnician = (index: number, checked: boolean) => {
    if (checked) {
      setSelectedTechnicianIndices([...selectedTechnicianIndices, index])
    } else {
      setSelectedTechnicianIndices(selectedTechnicianIndices.filter(i => i !== index))
    }
  }

  const handleDeleteSelectedTechnicians = () => {
    if (selectedTechnicianIndices.length === 0) return
    
    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${selectedTechnicianIndices.length} technician(s)?`
    )
    
    if (confirmDelete) {
      const updatedTechnicians = technicians.filter((_, index) => !selectedTechnicianIndices.includes(index))
      setTechnicians(updatedTechnicians)
      setSelectedTechnicianIndices([])
    }
  }

  // Timesheet management handlers
  const calculateHours = (clockIn: string, clockOut: string) => {
    if (!clockIn || !clockOut) return 0
    
    const [inTime, inPeriod] = clockIn.split(' ')
    const [outTime, outPeriod] = clockOut.split(' ')
    
    let [inHour, inMin] = inTime.split(':').map(Number)
    let [outHour, outMin] = outTime.split(':').map(Number)
    
    if (inPeriod === 'PM' && inHour !== 12) inHour += 12
    if (inPeriod === 'AM' && inHour === 12) inHour = 0
    if (outPeriod === 'PM' && outHour !== 12) outHour += 12
    if (outPeriod === 'AM' && outHour === 12) outHour = 0
    
    const inMinutes = inHour * 60 + inMin
    const outMinutes = outHour * 60 + outMin
    
    return Number(((outMinutes - inMinutes) / 60).toFixed(1))
  }

  const handleAddTimesheet = () => {
    if (!newTimesheetTechnician || !newTimesheetJob || !newTimesheetDate || !newTimesheetClockIn) {
      alert("Please fill in all required fields")
      return
    }

    const maxId = Math.max(...timesheets.map(t => parseInt(t.id.slice(3))))
    const newId = `#TS${String(maxId + 1).padStart(3, '0')}`

    const hours = calculateHours(newTimesheetClockIn, newTimesheetClockOut)
    const status = newTimesheetClockOut ? "Pending" : "Active"

    const selectedJob = jobs.find(j => j.id === newTimesheetJob)

    const newTimesheet: TimesheetEntry = {
      id: newId,
      technician: newTimesheetTechnician,
      date: formatDateOnly(newTimesheetDate, 'en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      }),
      jobId: newTimesheetJob,
      jobTitle: selectedJob?.title || "",
      clockIn: newTimesheetClockIn,
      clockOut: newTimesheetClockOut,
      hours: hours,
      status: status,
      notes: newTimesheetNotes,
    }

    setTimesheets([...timesheets, newTimesheet])
    
    setNewTimesheetTechnician("")
    setNewTimesheetJob("")
    setNewTimesheetDate("")
    setNewTimesheetClockIn("")
    setNewTimesheetClockOut("")
    setNewTimesheetNotes("")
    setIsAddTimesheetOpen(false)
  }

  const handleEditTimesheet = (id: string) => {
    const timesheet = timesheets.find(t => t.id === id)
    if (!timesheet) return

    setEditingTimesheetId(id)
    setEditTimesheetTechnician(timesheet.technician)
    setEditTimesheetJob(timesheet.jobId)
    setEditTimesheetDate(timesheet.date)
    setEditTimesheetClockIn(timesheet.clockIn)
    setEditTimesheetClockOut(timesheet.clockOut)
    setEditTimesheetStatus(timesheet.status)
    setEditTimesheetNotes(timesheet.notes)
  }

  const handleSaveTimesheet = () => {
    if (!editTimesheetTechnician || !editTimesheetJob || !editTimesheetClockIn) {
      alert("Please fill in all required fields")
      return
    }

    const hours = calculateHours(editTimesheetClockIn, editTimesheetClockOut)
    const selectedJob = jobs.find(j => j.id === editTimesheetJob)

    const updatedTimesheets = timesheets.map(t => 
      t.id === editingTimesheetId 
        ? {
            ...t,
            technician: editTimesheetTechnician,
            jobId: editTimesheetJob,
            jobTitle: selectedJob?.title || t.jobTitle,
            clockIn: editTimesheetClockIn,
            clockOut: editTimesheetClockOut,
            hours: hours,
            status: editTimesheetStatus,
            notes: editTimesheetNotes,
          }
        : t
    )

    setTimesheets(updatedTimesheets)
    
    setEditingTimesheetId(null)
    setEditTimesheetTechnician("")
    setEditTimesheetJob("")
    setEditTimesheetDate("")
    setEditTimesheetClockIn("")
    setEditTimesheetClockOut("")
    setEditTimesheetStatus("")
    setEditTimesheetNotes("")
  }

  const handleSelectAllTimesheets = (checked: boolean) => {
    if (checked) {
      setSelectedTimesheetIds(timesheets.map(t => t.id))
    } else {
      setSelectedTimesheetIds([])
    }
  }

  const handleSelectTimesheet = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedTimesheetIds([...selectedTimesheetIds, id])
    } else {
      setSelectedTimesheetIds(selectedTimesheetIds.filter(i => i !== id))
    }
  }

  const handleDeleteSelectedTimesheets = () => {
    if (selectedTimesheetIds.length === 0) return
    
    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${selectedTimesheetIds.length} timesheet(s)?`
    )
    
    if (confirmDelete) {
      const updatedTimesheets = timesheets.filter(t => !selectedTimesheetIds.includes(t.id))
      setTimesheets(updatedTimesheets)
      setSelectedTimesheetIds([])
    }
  }

  const getTimesheetStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-green-500/10 text-green-500 border-green-500/20"
      case "Pending":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
      case "Approved":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20"
      case "Rejected":
        return "bg-red-500/10 text-red-500 border-red-500/20"
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Assigned":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20"
      case "In Progress":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
      case "Completed":
        return "bg-green-500/10 text-green-500 border-green-500/20"
      case "Overdue":
        return "bg-red-500/10 text-red-500 border-red-500/20"
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20"
    }
  }

  return (
    <div className="min-h-screen bg-background p-6 border-0">
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
                  <MapPin className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-3xl font-bold">Katana Workforce</h1>
              </div>
              
              <p className="text-muted-foreground mt-2">TaskBeacon - Field service management</p>
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
        <div>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Briefcase className="h-5 w-5 text-muted-foreground" />
                  <span className="text-2xl font-bold">24</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium">Total Jobs</p>
                <p className="text-xs text-muted-foreground">All jobs in system</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <span className="text-2xl font-bold">8</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium">Active Technicians</p>
                <p className="text-xs text-muted-foreground">Available field techs</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
                  <span className="text-2xl font-bold">12</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium">Assigned Jobs</p>
                <p className="text-xs text-muted-foreground">Jobs ready to start</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <span className="text-2xl font-bold">8</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium">In Progress</p>
                <p className="text-xs text-muted-foreground">Currently being worked</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                  <span className="text-2xl font-bold">15</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium">Completed This Week</p>
                <p className="text-xs text-muted-foreground">Finished jobs</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <span className="text-2xl font-bold text-red-500">3</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium">Overdue Jobs</p>
                <p className="text-xs text-muted-foreground">Past due date</p>
              </CardContent>
            </Card>
          </div>

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
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Technician</TableHead>
                          <TableHead>Start Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {jobs.map((job) => (
                          <TableRow key={job.id}>
                            <TableCell className="font-medium">{job.id}</TableCell>
                            <TableCell>{job.title}</TableCell>
                            <TableCell>{job.technician}</TableCell>
                            <TableCell>{job.startDate}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={getStatusColor(job.status)}>
                                {job.status}
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
                        <span className="font-bold">15</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Jobs This Month</span>
                        <span className="font-bold">45</span>
                      </div>
                      <div className="pt-2 border-t">
                        <p className="text-sm font-medium mb-2">Top Performers</p>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <div>Mike Davis (8 jobs)</div>
                          <div>Sarah Johnson (6 jobs)</div>
                        </div>
                      </div>
                      <div className="pt-2 border-t">
                        <div className="flex items-center gap-2 text-red-500">
                          <AlertCircle className="h-4 w-4" />
                          <span className="text-sm font-medium">3 jobs need attention</span>
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
                        {recentActivity.map((activity, index) => (
                          <div key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                            <div className="h-2 w-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                            <span>{activity}</span>
                          </div>
                        ))}
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
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
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
                          <TableCell className="font-medium">{job.id}</TableCell>
                          <TableCell>{job.title}</TableCell>
                          <TableCell>{job.technician}</TableCell>
                          <TableCell>{job.startDate}</TableCell>
                          <TableCell>{job.endDate}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getStatusColor(job.status)}>
                              {job.status}
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
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Active Jobs</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {technicians.map((tech, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{tech.name}</TableCell>
                          <TableCell>{tech.phone}</TableCell>
                          <TableCell>{tech.activeJobs}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                              {tech.status}
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
                </CardContent>
              </Card>
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
                        <div className="text-2xl font-bold">3</div>
                        <p className="text-sm text-muted-foreground">Active Clock-ins</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">24.5</div>
                        <p className="text-sm text-muted-foreground">Hours Today</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">156</div>
                        <p className="text-sm text-muted-foreground">Hours This Week</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-yellow-500">2</div>
                        <p className="text-sm text-muted-foreground">Open Entries</p>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="flex items-center justify-center h-32 text-muted-foreground">
                    <div className="text-center">
                      <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Timesheet entries will appear here</p>
                    </div>
                  </div>
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
        <div>
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
                      <Button className="flex-1">Start Job</Button>
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
                    <Input id="profile-name" defaultValue="John Smith" />
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
