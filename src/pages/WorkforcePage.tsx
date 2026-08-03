import { getTodayDateKey } from '@/lib/due-date-utils'
import { useState, useEffect, useRef, useCallback, useMemo, type ChangeEvent } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { MotionPage } from '@/components/motion-page'
import { ModuleHelpButton } from '@/components/tour/module-help-button'
import { useModuleTour } from '@/components/tour/use-module-tour'
import { CustomerAccountPicker } from '@/components/customers/CustomerAccountPicker'
import type { Client } from '@/lib/customer-success-api'
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
  Loader2,
  ClipboardList,
  List,
  LayoutGrid,
  ArrowLeft,
} from "lucide-react"
import { useWfmTerminology } from '@/hooks/useWfmTerminology'
import { useWfmCurrentUser } from '@/hooks/use-wfm-current-user'
import { useModuleAccess } from '@/contexts/ModuleAccessContext'
import { WfmTodayTab } from '@/components/workforce/WfmTodayTab'
import { WfmWorkProfileSettings } from '@/components/workforce/WfmWorkProfileSettings'
import { WfmWorkBoard } from '@/components/workforce/WfmWorkBoard'
import { WfmTeamTab } from '@/components/workforce/WfmTeamTab'
import { WfmTimeTab } from '@/components/workforce/WfmTimeTab'
import { WfmMyWorkPanel } from '@/components/workforce/WfmMyWorkPanel'
import {
  ModuleCustomizeControls,
  ModuleCustomizeHint,
} from '@/components/module-layout/ModuleCustomizeBar'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import { WidgetCatalogDialog } from '@/components/module-layout/WidgetCatalogDialog'
import { useModuleWidgetLayout } from '@/hooks/useModuleWidgetLayout'
import {
  WORKFORCE_MODULE_ID,
  getWorkforceTabSurfaceConfig,
  type WorkforceTabLayoutProps,
} from '@/lib/workforce/workforce-widget-layout'
import {
  parseWorkforceSearchParams,
  workforceTabPath,
  isWorkforceTab,
  isWorkforceWorkSubTab,
} from '@/lib/wfm-deep-links'
import { getWfmStatusColor, statusToApi, type WfmLegacyJob, type WfmDisplayStatus } from '@/lib/wfm-job-utils'
import {
  getJobs,
  getTechnicians,
  getTimesheets,
  getSchedules,
  bulkCreateTechnicians,
  createJob,
  updateJob,
  deleteJob,
  createTechnician,
  deleteTechnician,
  createSchedule,
  createTimesheet,
  updateTimesheet,
  deleteTimesheet,
  approveTimesheet,
  rejectTimesheet,
  syncTeamFromHrEmployees,
  type Job,
  type Technician,
  type Timesheet,
  type Schedule,
  type WfmHrSyncResult,
} from "@/lib/wfm-api"
import { isSupabaseConfigured } from "@/lib/supabase"
import { checkoutJobPartsOnCompletion } from '@/lib/wfm-integrations'

/** Parse a YYYY-MM-DD string as a local date (avoids UTC-offset off-by-one). */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatDateLocal(dateStr: string, opts: Intl.DateTimeFormatOptions): string {
  return parseLocalDate(dateStr).toLocaleDateString('en-US', opts)
}

export default function WorkforcePage() {
  useModuleTour('workforce')
  const { terms, saveProfile } = useWfmTerminology()
  const { hasWfmManagerAccess } = useModuleAccess()
  const {
    technician: myTechnician,
    displayName: currentUserDisplayName,
    employee: myEmployee,
    employeeId: myEmployeeId,
    email: myEmail,
    loading: currentUserLoading,
  } = useWfmCurrentUser()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activePortal, setActivePortal] = useState<"admin" | "technician">("admin")
  const [activeTab, setActiveTab] = useState("today")
  const [workSubTab, setWorkSubTab] = useState("list")
  const surfaceConfig = getWorkforceTabSurfaceConfig(activeTab, workSubTab)
  const {
    layout,
    isCustomizeMode,
    enterCustomize,
    saveAndExit,
    onLayoutChange,
    addWidget,
    removeWidget,
    availableWidgets,
    resetToDefault,
  } = useModuleWidgetLayout({
    moduleId: WORKFORCE_MODULE_ID,
    surfaceId: surfaceConfig.id,
    catalog: surfaceConfig.catalog,
    normalize: surfaceConfig.normalize,
    toBase: surfaceConfig.toBase,
    successMessage: `${surfaceConfig.label} layout saved`,
  })
  const tabLayout: WorkforceTabLayoutProps = {
    widgets: layout.widgets,
    catalog: surfaceConfig.catalog,
    customizeMode: isCustomizeMode,
    onLayoutChange,
    onRemoveWidget: removeWidget,
  }
  const [loading, setLoading] = useState(true)
  const [syncingFromHr, setSyncingFromHr] = useState(false)
  const [hrSyncResult, setHrSyncResult] = useState<WfmHrSyncResult | null>(null)
  
  // State management for calendar and jobs
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [viewingCalendarJob, setViewingCalendarJob] = useState<any>(null)
  const [editingCalendarJob, setEditingCalendarJob] = useState<any>(null)
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([])
  const [editingJob, setEditingJob] = useState<string | null>(null)
  const [viewingJobLocation, setViewingJobLocation] = useState<string | null>(null)
  
  // New calendar interaction state
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false)
  const [quickCreateDate, setQuickCreateDate] = useState<Date | null>(null)
  const [draggedJob, setDraggedJob] = useState<any>(null)
  const [dragOverDate, setDragOverDate] = useState<Date | null>(null)
  
  // Edit form state for jobs (technician by id so save persists correctly)
  const [editJobTitle, setEditJobTitle] = useState("")
  const [editJobTechnician, setEditJobTechnician] = useState("")
  const [editJobTechnicianId, setEditJobTechnicianId] = useState<string | null>(null)
  const [editJobStartDate, setEditJobStartDate] = useState("")
  const [editJobEndDate, setEditJobEndDate] = useState("")
  const [editJobStatus, setEditJobStatus] = useState("")
  const [editJobLocation, setEditJobLocation] = useState("")
  const [editJobNotes, setEditJobNotes] = useState("")
  const [editJobDbId, setEditJobDbId] = useState<string | null>(null)
  const [editJobClientId, setEditJobClientId] = useState<string | null>(null)
  const [editJobInvoiceId, setEditJobInvoiceId] = useState<string | null>(null)
  const [editJobProjectId, setEditJobProjectId] = useState<string | null>(null)
  const [editJobTaskId, setEditJobTaskId] = useState<string | null>(null)

  // Create job form state
  const [isCreateJobOpen, setIsCreateJobOpen] = useState(false)
  const [newJobTitle, setNewJobTitle] = useState("")
  const [newJobDescription, setNewJobDescription] = useState("")
  const [newJobAddress, setNewJobAddress] = useState("")
  const [newJobTechnician, setNewJobTechnician] = useState("")
  const [newJobStartDate, setNewJobStartDate] = useState("")
  const [newJobEndDate, setNewJobEndDate] = useState("")
  const [newJobStatus, setNewJobStatus] = useState("Assigned")
  const [newJobClientId, setNewJobClientId] = useState("")
  const [newJobClient, setNewJobClient] = useState<Client | null>(null)

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

  const [isImportOpen, setIsImportOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<
    Array<{ name: string; email: string; phone: string; role: string }>
  >([])
  const [importResult, setImportResult] = useState<{ created: number; errors: string[] } | null>(null)
  const [importing, setImporting] = useState(false)

  // Timesheet state
  interface TimesheetEntry {
    id: string
    technician: string
    date: string
    /** YYYY-MM-DD in local time, for date inputs when editing */
    dateIso: string
    jobId: string
    jobTitle: string
    clockIn: string
    clockOut: string
    hours: number
    status: string
    notes: string
  }

  const [timesheets, setTimesheets] = useState<TimesheetEntry[]>([])

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
  const [approvingTimesheetId, setApprovingTimesheetId] = useState<string | null>(null)

  // Database data
  const [dbJobs, setDbJobs] = useState<Job[]>([])
  const [dbTechnicians, setDbTechnicians] = useState<Technician[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])

  // Legacy sample data structure for compatibility with existing code
  const [jobs, setJobs] = useState<any[]>([])
  const [technicians, setTechnicians] = useState<any[]>([])

  useEffect(() => {
    if (!hasWfmManagerAccess) {
      setActivePortal('technician')
    }
  }, [hasWfmManagerAccess])

  // Calculate metrics from fetched data
  const totalJobs = dbJobs.length
  const activeTechnicians = dbTechnicians.filter(t => t.status === 'active' && t.is_active).length
  const assignedJobs = dbJobs.filter(j => j.status === 'assigned').length
  const inProgressJobs = dbJobs.filter(j => j.status === 'in-progress').length
  
  // Calculate completed this week
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  const completedThisWeek = dbJobs.filter(j => {
    if (j.status !== 'completed') return false
    const completedDate = j.updated_at ? new Date(j.updated_at) : null
    return completedDate && completedDate >= startOfWeek
  }).length

  // Calculate overdue jobs (end_date in the past and status not completed)
  const overdueJobs = dbJobs.filter(j => {
    if (j.status === 'completed' || j.status === 'cancelled') return false
    if (!j.end_date) return false
    const endDate = parseLocalDate(j.end_date)
    return endDate < new Date()
  }).length

  // Jobs this week (start_date in current week)
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(endOfWeek.getDate() + 6)
  endOfWeek.setHours(23, 59, 59, 999)
  const jobsThisWeek = dbJobs.filter(j => {
    if (!j.start_date) return false
    const d = parseLocalDate(j.start_date)
    return d >= startOfWeek && d <= endOfWeek
  }).length

  // Jobs this month (start_date in current month)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  const jobsThisMonth = dbJobs.filter(j => {
    if (!j.start_date) return false
    const d = parseLocalDate(j.start_date)
    return d >= startOfMonth && d <= endOfMonth
  }).length

  // Top performers by completed jobs (technician name + count)
  const completedByTechnician = dbJobs
    .filter(j => j.status === 'completed' && j.technician_id)
    .reduce<Record<string, number>>((acc, j) => {
      const tid = j.technician_id!
      acc[tid] = (acc[tid] || 0) + 1
      return acc
    }, {})
  const topPerformers = Object.entries(completedByTechnician)
    .map(([techId, count]) => ({
      name: dbTechnicians.find(t => t.id === techId)?.name ?? 'Unknown',
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 2)

  // Jobs needing attention (overdue + on-hold)
  const jobsNeedingAttentionList = dbJobs.filter(j => {
    if (j.status === 'completed' || j.status === 'cancelled') return false
    if (j.status === 'on-hold') return true
    if (j.end_date && parseLocalDate(j.end_date) < new Date()) return true
    return false
  })
  const jobsNeedingAttention = jobsNeedingAttentionList.length

  const todayDateKey = getTodayDateKey()
  const unassignedJobsCount = dbJobs.filter(
    (j) => !j.technician_id && j.status !== 'completed' && j.status !== 'cancelled',
  ).length
  const dueTodayCount = dbJobs.filter(
    (j) => j.start_date === todayDateKey && j.status !== 'completed' && j.status !== 'cancelled',
  ).length

  const toTodayJobCard = (job: (typeof jobs)[number]) => ({
    id: job.id,
    title: job.title,
    status: job.status,
    assignee: job.technician ?? 'Unassigned',
    dateLabel: job.startDate || job.endDate || '—',
  })

  const needsAttentionCards = jobsNeedingAttentionList.map((j) => {
    const legacy = jobs.find((x) => (x as { dbId?: string }).dbId === j.id || x.id === j.job_number)
    return legacy
      ? toTodayJobCard(legacy)
      : {
          id: j.id,
          title: j.title,
          status: j.status,
          assignee: dbTechnicians.find((t) => t.id === j.technician_id)?.name ?? 'Unassigned',
          dateLabel: j.start_date ? formatDateLocal(j.start_date, { month: 'short', day: 'numeric' }) : '—',
        }
  })

  const unassignedJobCards = jobs
    .filter((j) => j.technician === 'Unassigned' && j.status !== 'Completed' && j.status !== 'Cancelled')
    .map(toTodayJobCard)

  const teamCapacity = technicians
    .filter((t) => t.status === 'Active')
    .map((t) => ({ name: t.name, activeCount: (t as { activeJobs?: number }).activeJobs ?? 0 }))
    .sort((a, b) => b.activeCount - a.activeCount)

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    const { tab, workSubTab: sub } = parseWorkforceSearchParams(searchParams.toString())
    if (tab && isWorkforceTab(tab)) setActiveTab(tab)
    if (sub && isWorkforceWorkSubTab(sub)) setWorkSubTab(sub)
  }, [searchParams])

  useEffect(() => {
    const { jobId } = parseWorkforceSearchParams(searchParams.toString())
    if (!jobId || jobs.length === 0) return
    const match = jobs.find(
      (j) => j.id === jobId || (j as { dbId?: string }).dbId === jobId,
    )
    if (match) openEditJob(match)
  }, [searchParams, jobs])

  const updateWorkforceUrl = useCallback(
    (tab: string, sub?: string) => {
      if (isWorkforceTab(tab)) {
        setSearchParams(
          workforceTabPath(tab, sub && isWorkforceWorkSubTab(sub) ? sub : undefined),
          { replace: true },
        )
      }
    },
    [setSearchParams],
  )

  const handleAdminTabChange = (tab: string) => {
    setActiveTab(tab)
    updateWorkforceUrl(tab, tab === 'work' ? workSubTab : undefined)
  }

  const handleWorkSubTabChange = (sub: string) => {
    setWorkSubTab(sub)
    updateWorkforceUrl('work', sub)
  }

  const formatTimeForTimesheetInput = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  const mapApiTimesheetToEntry = (ts: Timesheet): TimesheetEntry => {
    const clockInDate = new Date(ts.clock_in)
    const dateStr = clockInDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const y = clockInDate.getFullYear()
    const m = String(clockInDate.getMonth() + 1).padStart(2, '0')
    const d = String(clockInDate.getDate()).padStart(2, '0')
    const dateIso = `${y}-${m}-${d}`
    const statusDisplay = !ts.clock_out
      ? 'Clocked In'
      : ts.status === 'approved'
      ? 'Approved'
      : ts.status === 'rejected'
      ? 'Rejected'
      : 'Pending Approval'
    return {
      id: ts.id,
      technician: ts.technician?.name ?? '—',
      date: dateStr,
      dateIso,
      jobId: ts.job?.job_number ?? ts.job_id ?? '—',
      jobTitle: ts.job?.title ?? '—',
      clockIn: formatTimeForTimesheetInput(ts.clock_in),
      clockOut: ts.clock_out ? formatTimeForTimesheetInput(ts.clock_out) : '',
      hours: ts.total_hours ?? 0,
      status: statusDisplay,
      notes: ts.notes ?? '',
    }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const [jobsData, techniciansData, timesheetsData, schedulesData] = await Promise.all([
        getJobs(),
        getTechnicians(),
        getTimesheets(),
        getSchedules(),
      ])
      setDbJobs(jobsData)
      setDbTechnicians(techniciansData)
      setSchedules(schedulesData)
      setTimesheets(timesheetsData.map(mapApiTimesheetToEntry))
      
      // Convert database format to legacy format for compatibility
      const convertedJobs = jobsData.map(job => {
        const { technician: techObj, ...jobWithoutTech } = job
        // Resolve technician name from relation or by technician_id so assignment always shows
        const technicianName = techObj?.name ?? (job.technician_id ? (techniciansData.find(t => t.id === job.technician_id)?.name ?? 'Unassigned') : 'Unassigned')
        const hasTechnician = !!job.technician_id
        const displayStatus = job.status === 'in-progress' ? 'In Progress' :
                  job.status === 'assigned' ? (hasTechnician ? 'Assigned' : 'Unassigned') :
                  job.status === 'completed' ? 'Completed' :
                  job.status === 'on-hold' ? 'On Hold' :
                  job.status === 'cancelled' ? 'Cancelled' : job.status
        return {
          ...jobWithoutTech,
          id: job.job_number || job.id,
          dbId: job.id, // Keep DB uuid for API updates
          title: job.title,
          technician: technicianName,
          startDate: job.start_date ? formatDateLocal(job.start_date, { month: 'short', day: 'numeric', year: 'numeric' }) : '',
          endDate: job.end_date ? formatDateLocal(job.end_date, { month: 'short', day: 'numeric', year: 'numeric' }) : '',
          status: displayStatus,
        }
      })
      
      const convertedTechnicians = techniciansData.map(tech => ({
        ...tech,
        name: tech.name,
        phone: tech.phone || '',
        email: tech.email || '',
        employee_id: tech.employee_id ?? null,
        activeJobs: jobsData.filter(j => j.technician_id === tech.id && (j.status === 'assigned' || j.status === 'in-progress')).length,
        status: tech.status === 'active' ? 'Active' : tech.status === 'inactive' ? 'Inactive' : 'On Leave',
      }))
      
      setJobs(convertedJobs)
      setTechnicians(convertedTechnicians)
    } catch (error) {
      console.error('Error fetching WFM data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Recent activity from actual jobs (sorted by updated_at, most recent first)
  const recentActivity = [...dbJobs]
    .filter(j => j.updated_at)
    .sort((a, b) => new Date(b.updated_at!).getTime() - new Date(a.updated_at!).getTime())
    .slice(0, 8)
    .map(j => {
      const jobLabel = j.job_number || j.id
      const techName = (j as { technician?: { name?: string } }).technician?.name ?? dbTechnicians.find(t => t.id === j.technician_id)?.name ?? 'Unassigned'
      if (j.status === 'completed') return `Job ${jobLabel} completed by ${techName}`
      if (j.status === 'in-progress') return `${techName} started job ${jobLabel}`
      if (j.status === 'assigned') return `Job ${jobLabel} assigned to ${techName}`
      if (j.status === 'on-hold') return `Job ${jobLabel} put on hold`
      if (j.status === 'cancelled') return `Job ${jobLabel} cancelled`
      return `Job ${jobLabel} updated`
    })

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

  const dateStrFor = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  const getJobsForDate = (date: Date) => {
    const dateStr = dateStrFor(date)
    const starting = jobs.filter(job => job.startDate === dateStr)
    const due = jobs.filter(job => job.endDate === dateStr && job.startDate !== dateStr)
    const startIds = new Set(starting.map(j => j.id))
    const dueOnly = due.filter(j => !startIds.has(j.id))
    return { starting, due: dueOnly, all: [...starting, ...dueOnly] }
  }

  const getJobsForDateLegacy = (date: Date) => getJobsForDate(date).all

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }

  const goToToday = () => {
    setCurrentMonth(new Date())
  }

  // Quick create job on calendar cell click
  const handleCellClick = (date: Date) => {
    setQuickCreateDate(date)
    setIsQuickCreateOpen(true)
  }

  const handleQuickCreateJob = async () => {
    try {
      if (!newJobTitle || !quickCreateDate) {
        alert("Please fill in the job title")
        return
      }

      if (isSupabaseConfigured) {
        const dateStr = quickCreateDate.toISOString().slice(0, 10)
        const technicianId = newJobTechnician && newJobTechnician !== 'Unassigned'
          ? (technicians.find(t => t.name === newJobTechnician) as { id?: string } | undefined)?.id ?? null
          : null
        const created = await createJob({
          title: newJobTitle,
          description: null,
          client_id: newJobClientId || null,
          customer_name: newJobClient?.name ?? null,
          customer_phone: newJobClient?.phone ?? null,
          customer_email: newJobClient?.email ?? null,
          location: null,
          location_address: null,
          status: statusToApi(newJobStatus),
          priority: 'medium',
          technician_id: technicianId,
          start_date: dateStr,
          end_date: dateStr,
          start_time: null,
          end_time: null,
          estimated_hours: null,
          actual_hours: null,
          notes: null,
          completion_notes: null,
          is_active: true,
          project_id: null,
          task_id: null,
          invoice_id: null,
        })
        if (created) {
          await fetchData()
          setNewJobTitle("")
          setNewJobTechnician("")
          setNewJobStatus("Assigned")
          setIsQuickCreateOpen(false)
          setQuickCreateDate(null)
        }
        return
      }

      const newId = getNextJobNumber(jobs)
      const formattedDate = quickCreateDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      const newJob = {
        id: newId,
        title: newJobTitle,
        technician: newJobTechnician || "Unassigned",
        startDate: formattedDate,
        endDate: formattedDate,
        status: newJobStatus,
      }
      setJobs([...jobs, newJob])
      setNewJobTitle("")
      setNewJobTechnician("")
      setNewJobStatus("Assigned")
      setIsQuickCreateOpen(false)
      setQuickCreateDate(null)
    } catch (error: unknown) {
      console.error('Error creating job:', error)
      const message = error && typeof error === 'object' && 'message' in error ? String((error as { message: string }).message) : 'Unknown error'
      alert(`Failed to create job. ${message}`)
    }
  }

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, job: any) => {
    setDraggedJob(job)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, date: Date) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverDate(date)
  }

  const handleDragLeave = () => {
    setDragOverDate(null)
  }

  const handleDrop = (e: React.DragEvent, date: Date) => {
    e.preventDefault()
    
    if (!draggedJob) return

    const formattedDate = date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    })

    const updatedJobs = jobs.map(job => {
      if (job.id === draggedJob.id) {
        return {
          ...job,
          startDate: formattedDate,
          endDate: formattedDate,
        }
      }
      return job
    })

    setJobs(updatedJobs)
    setDraggedJob(null)
    setDragOverDate(null)
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

  const handleDeleteSelected = async () => {
    if (selectedJobIds.length === 0) return
    
    if (!confirm(`Are you sure you want to delete ${selectedJobIds.length} job(s)?`)) return

    if (isSupabaseConfigured) {
      const jobsToDelete = jobs.filter((j) => selectedJobIds.includes(j.id))
      const dbIds = jobsToDelete
        .map((j) => (j as { dbId?: string }).dbId)
        .filter((id): id is string => !!id)
      const results = await Promise.all(dbIds.map((id) => deleteJob(id)))
      const failed = results.filter((ok) => !ok).length
      if (failed > 0) {
        alert(`Failed to delete ${failed} job(s). Please try again.`)
        return
      }
      setSelectedJobIds([])
      await fetchData()
    } else {
      const updatedJobs = jobs.filter((j) => !selectedJobIds.includes(j.id))
      setJobs(updatedJobs)
      setDbJobs(updatedJobs as Job[])
      setSelectedJobIds([])
    }
  }

  // Job management handlers
  const handleSaveCalendarJob = async () => {
    if (!editingCalendarJob) return

    const jobWithDbId = editingCalendarJob as { dbId?: string }
    if (isSupabaseConfigured && jobWithDbId.dbId) {
      try {
        const startDate = new Date(editJobStartDate).toISOString().slice(0, 10)
        const endDate = new Date(editJobEndDate).toISOString().slice(0, 10)
        await updateJob(jobWithDbId.dbId, {
          title: editJobTitle,
          technician_id: editJobTechnicianId ?? null,
          start_date: startDate,
          end_date: endDate,
          status: statusToApi(editJobStatus),
          location_address: editJobLocation?.trim() || null,
        })
        await fetchData()
      } catch (e) {
        console.error('Failed to save calendar job', e)
        alert('Failed to save changes. Please try again.')
        return
      }
    } else {
      const updatedJobs = jobs.map(job => {
        if (job.id === editingCalendarJob.id) {
          return {
            ...job,
            title: editJobTitle,
            technician: editJobTechnician,
            startDate: editJobStartDate,
            endDate: editJobEndDate,
            status: editJobStatus,
            location_address: editJobLocation?.trim() || ((job as { location_address?: string | null }).location_address ?? null),
          }
        }
        return job
      })
      setJobs(updatedJobs)
    }

    setEditingCalendarJob(null)
    setEditJobTitle("")
    setEditJobTechnician("")
    setEditJobTechnicianId(null)
    setEditJobStartDate("")
    setEditJobEndDate("")
    setEditJobStatus("")
    setEditJobLocation("")
    setEditJobNotes("")
  }

  const getNextJobNumber = (currentJobs: { id: string }[]) => {
    const numericIds = currentJobs.map(j => {
      const s = String(j.id).replace(/^#/, '')
      const n = parseInt(s, 10)
      return isNaN(n) ? 0 : n
    })
    const maxId = numericIds.length === 0 ? 0 : Math.max(0, ...numericIds)
    return `#${maxId + 1}`
  }

  const getStatusColor = getWfmStatusColor

  const handleSyncFromHr = async () => {
    setSyncingFromHr(true)
    try {
      const result = await syncTeamFromHrEmployees()
      setHrSyncResult(result)
      await fetchData()
    } catch (e) {
      console.error('HR sync failed:', e)
      alert(e instanceof Error ? e.message : 'Failed to sync from HR')
    } finally {
      setSyncingFromHr(false)
    }
  }

  const handleKanbanStatusChange = async (job: WfmLegacyJob, newStatus: WfmDisplayStatus) => {
    const row = jobs.find((j) => j.id === job.id)
    if (!row?.dbId || !isSupabaseConfigured) return
    let technicianId = row.technician_id ?? getTechnicianIdByName(row.technician)
    if (newStatus === 'Unassigned') technicianId = null
    const apiStatus = statusToApi(newStatus === 'Unassigned' ? 'Unassigned' : newStatus)
    try {
      await updateJob(row.dbId, {
        status: apiStatus,
        technician_id: technicianId,
      })
      if (apiStatus === 'completed') {
        const checkout = await checkoutJobPartsOnCompletion(row.dbId)
        if (checkout.checkedOut > 0 || checkout.errors.length > 0) {
          const msg =
            checkout.errors.length > 0
              ? `Parts: ${checkout.checkedOut} checked out. Issues: ${checkout.errors.join('; ')}`
              : `${checkout.checkedOut} part line(s) checked out from inventory`
          console.info(msg)
        }
      }
      await fetchData()
    } catch (e) {
      console.error('Kanban status update failed:', e)
    }
  }

  const handleEditJobTechnicianChange = (name: string) => {
    setEditJobTechnician(name)
    setEditJobTechnicianId(name === 'Unassigned' ? null : getTechnicianIdByName(name) ?? null)
  }

  // Resolve technician id from name (trim + case-insensitive); prefer dbTechnicians (source of truth)
  const getTechnicianIdByName = (name: string): string | null => {
    if (!name || name.trim() === '' || name === 'Unassigned') return null
    const n = name.trim().toLowerCase()
    const t =
      dbTechnicians.find(t => t.name?.trim().toLowerCase() === n) ??
      technicians.find((t: { name?: string }) => t.name?.trim().toLowerCase() === n)
    return (t as { id?: string } | undefined)?.id ?? null
  }

  const handleCreateJobDialogOpenChange = (open: boolean) => {
    setIsCreateJobOpen(open)
    if (open) {
      setNewJobTitle("")
      setNewJobDescription("")
      setNewJobAddress("")
      setNewJobTechnician("")
      setNewJobStartDate("")
      setNewJobEndDate("")
      setNewJobStatus("Assigned")
    }
  }

  const handleCreateJob = async () => {
    if (!newJobTitle || !newJobStartDate || !newJobEndDate) {
      alert("Please fill in all required fields (Title, Start Date, End Date)")
      return
    }

    if (isSupabaseConfigured) {
      try {
        const technicianId = getTechnicianIdByName(newJobTechnician)
        const startDate = new Date(newJobStartDate).toISOString().slice(0, 10)
        const endDate = new Date(newJobEndDate).toISOString().slice(0, 10)
        const created = await createJob({
          title: newJobTitle,
          description: newJobDescription || null,
          client_id: newJobClientId || null,
          customer_name: newJobClient?.name ?? null,
          customer_phone: newJobClient?.phone ?? null,
          customer_email: newJobClient?.email ?? null,
          location: null,
          location_address: newJobAddress?.trim() || null,
          status: statusToApi(newJobStatus),
          priority: 'medium',
          technician_id: technicianId,
          start_date: startDate,
          end_date: endDate,
          start_time: null,
          end_time: null,
          estimated_hours: null,
          actual_hours: null,
          notes: null,
          completion_notes: null,
          is_active: true,
          project_id: null,
          task_id: null,
          invoice_id: null,
        })
        if (created) {
          try {
            await createSchedule({
              technician_id: technicianId || '',
              job_id: created.id,
              schedule_date: startDate,
              start_time: null,
              end_time: null,
              status: 'scheduled',
              notes: null,
            })
          } catch (schedErr) {
            console.warn('Schedule creation failed (non-blocking):', schedErr)
          }
          await fetchData()
          setNewJobTitle("")
          setNewJobDescription("")
          setNewJobTechnician("")
          setNewJobStartDate("")
          setNewJobEndDate("")
          setNewJobStatus("Assigned")
          setIsCreateJobOpen(false)
        }
      } catch (e: unknown) {
        console.error('Error creating job:', e)
        const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Unknown error'
        alert(`Failed to create job. ${msg}`)
      }
      return
    }

    const newId = getNextJobNumber(jobs)
    const formattedStartDate = formatDateLocal(newJobStartDate, { month: 'short', day: 'numeric', year: 'numeric' })
    const formattedEndDate = formatDateLocal(newJobEndDate, { month: 'short', day: 'numeric', year: 'numeric' })
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
    setNewJobAddress("")
    setNewJobTechnician("")
    setNewJobStartDate("")
    setNewJobEndDate("")
    setNewJobStatus("Assigned")
    setIsCreateJobOpen(false)
  }

  const openEditJob = (job: {
    id: string
    title: string
    technician: string
    startDate: string
    endDate: string
    status: string
    technician_id?: string | null
    location_address?: string | null
    dbId?: string
    client_id?: string | null
    invoice_id?: string | null
    project_id?: string | null
    task_id?: string | null
  }) => {
    setEditingJob(job.id)
    setEditJobTitle(job.title)
    setEditJobTechnician(job.technician || 'Unassigned')
    setEditJobTechnicianId(job.technician_id ?? null)
    setEditJobStartDate(job.startDate)
    setEditJobEndDate(job.endDate)
    setEditJobStatus(job.status)
    setEditJobLocation(job.location_address ?? '')
    setEditJobDbId(job.dbId ?? null)
    setEditJobClientId(job.client_id ?? null)
    setEditJobInvoiceId(job.invoice_id ?? null)
    setEditJobProjectId(job.project_id ?? null)
    setEditJobTaskId(job.task_id ?? null)
  }

  const handleSaveJobEdit = async () => {
    if (!editingJob || !editJobTitle || !editJobStartDate || !editJobEndDate) {
      alert("Please fill in all required fields")
      return
    }
    const job = jobs.find((j: { id: string; dbId?: string }) => j.id === editingJob)
    if (!job) return
    const technicianId = getTechnicianIdByName(editJobTechnician)
    const apiStatus = statusToApi(editJobStatus)
    const startDate = new Date(editJobStartDate).toISOString().slice(0, 10)
    const endDate = new Date(editJobEndDate).toISOString().slice(0, 10)
    if (job.dbId && isSupabaseConfigured) {
      try {
        await updateJob(job.dbId, {
          title: editJobTitle,
          technician_id: technicianId ?? null,
          start_date: startDate,
          end_date: endDate,
          status: apiStatus,
          location_address: editJobLocation?.trim() || null,
        })
        if (apiStatus === 'completed') {
          await checkoutJobPartsOnCompletion(job.dbId)
        }
        await fetchData()
      } catch (e: unknown) {
        console.error('Error updating job:', e)
        const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Unknown error'
        alert(`Failed to save job. ${msg}`)
        return
      }
    } else {
      const technicianName = editJobTechnicianId ? (technicians.find((t: { id?: string }) => t.id === editJobTechnicianId)?.name ?? 'Unassigned') : 'Unassigned'
      setJobs(jobs.map((j: { id: string }) =>
        j.id === editingJob
          ? { ...j, title: editJobTitle, technician: technicianName, startDate: editJobStartDate, endDate: editJobEndDate, status: editJobStatus }
          : j
      ))
    }
    setEditingJob(null)
    setEditJobTitle("")
    setEditJobTechnician("")
    setEditJobTechnicianId(null)
    setEditJobStartDate("")
    setEditJobEndDate("")
    setEditJobStatus("")
    setEditJobDbId(null)
    setEditJobClientId(null)
    setEditJobInvoiceId(null)
    setEditJobProjectId(null)
    setEditJobTaskId(null)
  }

  // Technician management handlers
  const handleAddTechnician = async () => {
    if (!newTechName || !newTechPhone) {
      alert("Please fill in all required fields (Name and Phone)")
      return
    }

    if (isSupabaseConfigured) {
      try {
        const created = await createTechnician({
          name: newTechName.trim(),
          email: newTechEmail?.trim() || null,
          phone: newTechPhone.trim(),
          role: 'technician',
          status: 'active',
          skills: null,
          hourly_rate: null,
          avatar_url: null,
          notes: null,
          is_active: true,
        })
        if (created) {
          await fetchData()
          setNewTechName("")
          setNewTechPhone("")
          setNewTechEmail("")
          setIsAddTechnicianOpen(false)
        }
      } catch (e: unknown) {
        console.error('Error creating technician:', e)
        const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Unknown error'
        alert(`Failed to add technician. ${msg}`)
      }
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

  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return []
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim())
    const nameIdx = headers.findIndex(h => h.includes('name'))
    const emailIdx = headers.findIndex(h => h.includes('email'))
    const phoneIdx = headers.findIndex(h => h.includes('phone'))
    const roleIdx = headers.findIndex(h => h.includes('role'))

    return lines
      .slice(1)
      .filter(l => l.trim())
      .map(line => {
        const cols = line.split(',').map(c => c.trim())
        return {
          name: nameIdx >= 0 ? cols[nameIdx] || '' : '',
          email: emailIdx >= 0 ? cols[emailIdx] || '' : '',
          phone: phoneIdx >= 0 ? cols[phoneIdx] || '' : '',
          role: roleIdx >= 0 ? cols[roleIdx] || 'technician' : 'technician',
        }
      })
      .filter(row => row.name)
  }

  const handleImportFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportFile(file)
    setImportResult(null)
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      setImportPreview(parseCSV(text))
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (importPreview.length === 0) return
    setImporting(true)
    try {
      const techs = importPreview.map(row => ({
        name: row.name,
        email: row.email || null,
        phone: row.phone || null,
        role: (row.role as 'technician' | 'lead' | 'supervisor') || 'technician',
        status: 'active' as const,
        skills: null,
        hourly_rate: null,
        avatar_url: null,
        notes: null,
        is_active: true,
      }))
      const result = await bulkCreateTechnicians(techs)
      setImportResult(result)
      if (result.created > 0) await fetchData()
    } catch (error) {
      console.error('Import error:', error)
    } finally {
      setImporting(false)
    }
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

  const handleDeleteSelectedTechnicians = async () => {
    if (selectedTechnicianIndices.length === 0) return
    
    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${selectedTechnicianIndices.length} technician(s)?`
    )
    
    if (!confirmDelete) return

    if (isSupabaseConfigured) {
      const idsToDelete = selectedTechnicianIndices
        .map((index) => technicians[index]?.id)
        .filter((id): id is string => !!id)
      const results = await Promise.all(idsToDelete.map((id) => deleteTechnician(id)))
      const failed = results.filter((ok) => !ok).length
      if (failed > 0) {
        alert(`Failed to delete ${failed} technician(s). Please try again.`)
        return
      }
      setSelectedTechnicianIndices([])
      await fetchData()
    } else {
      const updatedTechnicians = technicians.filter((_, index) => !selectedTechnicianIndices.includes(index))
      setTechnicians(updatedTechnicians)
      setDbTechnicians(updatedTechnicians)
      setSelectedTechnicianIndices([])
    }
  }

  // Timesheet management handlers
  const calculateHours = (clockIn: string, clockOut: string) => {
    if (!clockIn || !clockOut) return 0

    const parseHm = (s: string): number => {
      const t = s.trim()
      // 24-hour "HH:mm" from time inputs
      if (/^\d{1,2}:\d{2}$/.test(t)) {
        const [hStr, mStr] = t.split(':')
        const h = Number(hStr)
        const m = Number(mStr)
        return h * 60 + m
      }
      // Legacy "h:mm AM|PM"
      const [timePart, period] = t.split(/\s+/)
      if (!timePart || !period) return NaN
      let [hour, minute] = timePart.split(':').map(Number)
      const p = period.toUpperCase()
      if (p === 'PM' && hour !== 12) hour += 12
      if (p === 'AM' && hour === 12) hour = 0
      return hour * 60 + minute
    }

    const inMinutes = parseHm(clockIn)
    const outMinutes = parseHm(clockOut)
    if (!Number.isFinite(inMinutes) || !Number.isFinite(outMinutes)) return 0

    return Number(((outMinutes - inMinutes) / 60).toFixed(1))
  }

  const mapEditTimesheetStatusToApi = (s: string): 'pending' | 'approved' | 'rejected' | undefined => {
    if (s === 'Approved') return 'approved'
    if (s === 'Rejected') return 'rejected'
    if (s === 'Pending Approval' || s === 'Clocked In' || s === 'Clocked Out') return 'pending'
    return undefined
  }

  const handleAddTimesheet = async () => {
    if (!newTimesheetTechnician || !newTimesheetJob || !newTimesheetDate || !newTimesheetClockIn) {
      alert("Please fill in all required fields")
      return
    }

    if (!isSupabaseConfigured) {
      alert('Supabase is not configured; timesheets cannot be saved.')
      return
    }

    const techId =
      technicians.find((t: { name?: string }) => t.name === newTimesheetTechnician)?.id ??
      dbTechnicians.find((t) => t.name === newTimesheetTechnician)?.id
    if (!techId) {
      alert("Technician not found")
      return
    }

    const selectedJob = jobs.find((j: { title?: string }) => j.title === newTimesheetJob) as { dbId?: string; title?: string } | undefined
    const jobUuid = selectedJob?.dbId
    if (!jobUuid) {
      alert("Job not found")
      return
    }

    try {
      const clockInDate = new Date(`${newTimesheetDate}T${newTimesheetClockIn}`)
      const clockOutDate = newTimesheetClockOut ? new Date(`${newTimesheetDate}T${newTimesheetClockOut}`) : null

      const created = await createTimesheet({
        technician_id: techId,
        job_id: jobUuid,
        clock_in: clockInDate.toISOString(),
        clock_out: clockOutDate ? clockOutDate.toISOString() : null,
        break_duration: 0,
        notes: newTimesheetNotes.trim() ? newTimesheetNotes : null,
        status: 'pending',
        approved_by: null,
        approved_at: null,
      })

      if (!created) {
        alert('Failed to create timesheet. Please try again.')
        return
      }

      const refreshed = await getTimesheets()
      setTimesheets(refreshed.map(mapApiTimesheetToEntry))

      setNewTimesheetTechnician("")
      setNewTimesheetJob("")
      setNewTimesheetDate("")
      setNewTimesheetClockIn("")
      setNewTimesheetClockOut("")
      setNewTimesheetNotes("")
      setIsAddTimesheetOpen(false)
    } catch (error) {
      console.error('Error creating timesheet:', error)
      alert('Failed to create timesheet. Please try again.')
    }
  }

  const handleEditTimesheet = (id: string) => {
    const timesheet = timesheets.find(t => t.id === id)
    if (!timesheet) return

    setEditingTimesheetId(id)
    setEditTimesheetTechnician(timesheet.technician)
    setEditTimesheetJob(timesheet.jobTitle)
    setEditTimesheetDate(timesheet.dateIso)
    setEditTimesheetClockIn(timesheet.clockIn)
    setEditTimesheetClockOut(timesheet.clockOut)
    setEditTimesheetStatus(timesheet.status)
    setEditTimesheetNotes(timesheet.notes)
  }

  const handleSaveTimesheet = async () => {
    if (!editTimesheetTechnician || !editTimesheetJob || !editTimesheetClockIn || !editingTimesheetId) {
      alert("Please fill in all required fields")
      return
    }

    if (!isSupabaseConfigured) {
      alert('Supabase is not configured; timesheets cannot be updated.')
      return
    }

    const baseDate =
      editTimesheetDate && /^\d{4}-\d{2}-\d{2}$/.test(editTimesheetDate)
        ? editTimesheetDate
        : timesheets.find((t) => t.id === editingTimesheetId)?.dateIso ??
          new Date().toISOString().slice(0, 10)

    try {
      const updates: Partial<Timesheet> = {}
      updates.clock_in = new Date(`${baseDate}T${editTimesheetClockIn}`).toISOString()
      if (editTimesheetClockOut) {
        updates.clock_out = new Date(`${baseDate}T${editTimesheetClockOut}`).toISOString()
      }
      const apiStatus = mapEditTimesheetStatusToApi(editTimesheetStatus)
      if (apiStatus !== undefined) {
        updates.status = apiStatus
      }
      updates.notes = editTimesheetNotes.trim() === '' ? null : editTimesheetNotes

      const updatedRow = await updateTimesheet(editingTimesheetId, updates)
      if (!updatedRow) {
        alert('Failed to update timesheet. Please try again.')
        return
      }

      const refreshed = await getTimesheets()
      setTimesheets(refreshed.map(mapApiTimesheetToEntry))

      setEditingTimesheetId(null)
      setEditTimesheetTechnician("")
      setEditTimesheetJob("")
      setEditTimesheetDate("")
      setEditTimesheetClockIn("")
      setEditTimesheetClockOut("")
      setEditTimesheetStatus("")
      setEditTimesheetNotes("")
    } catch (error) {
      console.error('Error updating timesheet:', error)
      alert('Failed to update timesheet. Please try again.')
    }
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

  const handleApproveTimesheet = async (timesheetId: string) => {
    if (!isSupabaseConfigured) {
      alert('Supabase is not configured; timesheets cannot be updated.')
      return
    }
    const approverId = myEmployeeId ?? myTechnician?.id
    if (!approverId) {
      alert('Unable to identify approver. Please try again.')
      return
    }
    setApprovingTimesheetId(timesheetId)
    try {
      const result = await approveTimesheet(timesheetId, approverId)
      if (result) {
        await fetchData()
      } else {
        alert('Failed to approve timesheet. Please try again.')
      }
    } catch (error) {
      console.error('Error approving timesheet:', error)
      alert('Failed to approve timesheet. Please try again.')
    } finally {
      setApprovingTimesheetId(null)
    }
  }

  const handleRejectTimesheet = async (timesheetId: string) => {
    if (!isSupabaseConfigured) {
      alert('Supabase is not configured; timesheets cannot be updated.')
      return
    }
    const approverId = myEmployeeId ?? myTechnician?.id
    if (!approverId) {
      alert('Unable to identify approver. Please try again.')
      return
    }
    setApprovingTimesheetId(timesheetId)
    try {
      const result = await rejectTimesheet(timesheetId, approverId)
      if (result) {
        await fetchData()
      } else {
        alert('Failed to reject timesheet. Please try again.')
      }
    } catch (error) {
      console.error('Error rejecting timesheet:', error)
      alert('Failed to reject timesheet. Please try again.')
    } finally {
      setApprovingTimesheetId(null)
    }
  }

  const handleDeleteSelectedTimesheets = async () => {
    if (selectedTimesheetIds.length === 0) return

    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${selectedTimesheetIds.length} timesheet(s)?`
    )
    if (!confirmDelete) return

    if (isSupabaseConfigured) {
      try {
        const results = await Promise.all(selectedTimesheetIds.map((id) => deleteTimesheet(id)))
        const failed = results.filter((ok) => !ok).length
        if (failed > 0) {
          alert(`Failed to delete ${failed} timesheet(s). Please try again.`)
          return
        }
        setSelectedTimesheetIds([])
        const refreshed = await getTimesheets()
        setTimesheets(refreshed.map(mapApiTimesheetToEntry))
      } catch (e) {
        console.error('Error deleting timesheets:', e)
        alert('Failed to delete timesheets. Please try again.')
      }
      return
    }

    const updatedTimesheets = timesheets.filter((t) => !selectedTimesheetIds.includes(t.id))
    setTimesheets(updatedTimesheets)
    setSelectedTimesheetIds([])
  }

  const getTimesheetStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-green-500/10 text-green-500 border-green-500/20"
      case "Clocked In":
        return "bg-green-500/10 text-green-500 border-green-500/20"
      case "Clocked Out":
        return "bg-slate-500/10 text-slate-600 border-slate-500/20"
      case "Pending":
      case "Pending Approval":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
      case "Approved":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20"
      case "Rejected":
        return "bg-red-500/10 text-red-500 border-red-500/20"
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20"
    }
  }

  // Export functionality
  const exportJobsToCSV = () => {
    try {
      const headers = ['Job ID', 'Title', 'Technician', 'Start Date', 'End Date', 'Status']
      const csvData = [
        headers.join(','),
        ...jobs.map(job => [
          job.id,
          `"${job.title}"`,
          `"${job.technician}"`,
          job.startDate,
          job.endDate,
          job.status
        ].join(','))
      ].join('\n')

      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `jobs_export_${getTodayDateKey()}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Error exporting jobs:', error)
      alert('Failed to export jobs. Please try again.')
    }
  }

  const exportTimesheetsToCSV = () => {
    try {
      const headers = ['Timesheet ID', 'Date', 'Technician', 'Job ID', 'Job Title', 'Clock In', 'Clock Out', 'Hours', 'Status', 'Notes']
      const csvData = [
        headers.join(','),
        ...timesheets.map(timesheet => [
          timesheet.id,
          timesheet.date,
          `"${timesheet.technician}"`,
          timesheet.jobId,
          `"${timesheet.jobTitle}"`,
          timesheet.clockIn,
          timesheet.clockOut || '',
          timesheet.hours.toString(),
          timesheet.status,
          `"${timesheet.notes}"`
        ].join(','))
      ].join('\n')

      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `timesheets_export_${getTodayDateKey()}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Error exporting timesheets:', error)
      alert('Failed to export timesheets. Please try again.')
    }
  }

  const exportPerformanceToPDF = () => {
    try {
      // Create a simple HTML report that can be printed as PDF
      const completionRate = ((jobs.filter(j => j.status === 'Completed').length / jobs.length) * 100).toFixed(1)
      const totalHours = timesheets.reduce((sum, t) => sum + calculateHours(t.clockIn, t.clockOut), 0).toFixed(1)
      const avgHoursPerJob = (parseFloat(totalHours) / jobs.length).toFixed(1)
      const activeTechnicians = technicians.filter(t => t.status === 'Active').length

      const reportContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Workforce Performance Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .header { text-align: center; margin-bottom: 30px; }
            .metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
            .metric-card { border: 1px solid #ddd; padding: 20px; border-radius: 8px; }
            .metric-value { font-size: 2em; font-weight: bold; color: #2563eb; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; }
            .footer { margin-top: 30px; text-align: center; font-size: 0.9em; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Workforce Performance Report</h1>
            <p>Generated on ${new Date().toLocaleDateString()}</p>
          </div>
          
          <div class="metrics">
            <div class="metric-card">
              <div class="metric-value">${completionRate}%</div>
              <div>Completion Rate</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${totalHours}h</div>
              <div>Total Hours Logged</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${avgHoursPerJob}h</div>
              <div>Avg Hours per Job</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${activeTechnicians}</div>
              <div>Active Technicians</div>
            </div>
          </div>

          <h2>Technician Performance</h2>
          <table>
            <thead>
              <tr>
                <th>Technician</th>
                <th>Jobs Completed</th>
                <th>Total Hours</th>
                <th>Avg Hours/Job</th>
                <th>Performance %</th>
              </tr>
            </thead>
            <tbody>
              ${technicians.map(tech => {
                const techJobs = jobs.filter(j => j.technician === tech.name);
                const completedJobs = techJobs.filter(j => j.status === 'Completed').length;
                const techTimesheets = timesheets.filter(t => t.technician === tech.name);
                const techTotalHours = techTimesheets.reduce((sum, t) => sum + calculateHours(t.clockIn, t.clockOut), 0);
                const techAvgHours = completedJobs > 0 ? techTotalHours / completedJobs : 0;
                const performance = completedJobs > 0 ? (completedJobs / techJobs.length) * 100 : 0;
                
                return `
                  <tr>
                    <td>${tech.name}</td>
                    <td>${completedJobs}/${techJobs.length}</td>
                    <td>${techTotalHours.toFixed(1)}h</td>
                    <td>${techAvgHours.toFixed(1)}h</td>
                    <td>${performance.toFixed(0)}%</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="footer">
            <p>Katana Workforce</p>
          </div>
        </body>
        </html>
      `

      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(reportContent)
        printWindow.document.close()
        printWindow.focus()
        setTimeout(() => {
          printWindow.print()
        }, 250)
      }
    } catch (error) {
      console.error('Error generating performance report:', error)
      alert('Failed to generate performance report. Please try again.')
    }
  }

  return (
    <MotionPage subtle className="min-h-screen min-w-0 bg-background p-6 border-0">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 -mx-6 px-6 mb-6" data-tour="wfm-header">
        <div className="py-6">
          <div className="fluid-page-header">
            <div>
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                <Link to="/hub" className="hover:text-foreground transition-colors flex items-center gap-1">
                  <ArrowLeft className="h-3 w-3" />
                  Hub
                </Link>
                <ChevronRight className="h-4 w-4" />
                <span className="text-foreground">Katana Workforce</span>
              </div>
              
              {/* Title with Icon */}
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2.5 rounded-lg">
                  <ClipboardList className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-3xl font-bold">Katana Workforce</h1>
                <ModuleHelpButton moduleId="workforce" />
              </div>
              
              <p className="text-muted-foreground mt-2">
                {activePortal === 'technician'
                  ? `My work — ${currentUserDisplayName}`
                  : terms.moduleSubtitle}
              </p>
            </div>
            <div className="flex flex-wrap gap-3" data-tour="wfm-portal-toggle">
              {hasWfmManagerAccess && activePortal === 'admin' && (
                <ModuleCustomizeControls
                  customizeMode={isCustomizeMode}
                  onEnterCustomize={enterCustomize}
                  onDone={() => void saveAndExit()}
                  dataTourCustomize="wfm-customize"
                />
              )}
              {hasWfmManagerAccess && (
                <WfmWorkProfileSettings profile={terms.profile} onSave={saveProfile} />
              )}
              {hasWfmManagerAccess && (
                <Button
                  variant={activePortal === "admin" ? "default" : "outline"}
                  onClick={() => setActivePortal("admin")}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  {terms.managerPortal}
                </Button>
              )}
              <Button
                variant={activePortal === "technician" ? "default" : "outline"}
                onClick={() => setActivePortal("technician")}
              >
                <Users className="h-4 w-4 mr-2" />
                {terms.workerPortal}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Portal */}
      {activePortal === "admin" && (
        <div>
          {/* Stats – one rectangular bar */}
          <Card className="overflow-hidden border-border bg-card/50 mb-6" data-tour="wfm-stats-bar">
            <div className="stat-bar">
              <div className="stat-bar-item">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Briefcase className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="stat-bar-label">Total {terms.workItemPlural}</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {loading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : totalJobs}
                  </p>
                </div>
              </div>
              <div className="stat-bar-item">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Users className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="stat-bar-label">Active {terms.teamMemberPlural}</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {loading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : activeTechnicians}
                  </p>
                </div>
              </div>
              <div className="stat-bar-item">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="stat-bar-label">Assigned {terms.workItemPlural}</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {loading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : assignedJobs}
                  </p>
                </div>
              </div>
              <div className="stat-bar-item">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="stat-bar-label">In Progress</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {loading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : inProgressJobs}
                  </p>
                </div>
              </div>
              <div className="stat-bar-item">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="stat-bar-label">Completed This Week</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {loading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : completedThisWeek}
                  </p>
                </div>
              </div>
              <div className="stat-bar-item">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                </div>
                <div className="min-w-0">
                  <p className="stat-bar-label">Overdue {terms.workItemPlural}</p>
                  <p className="text-2xl font-bold tabular-nums text-red-500">
                    {loading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : overdueJobs}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Main Content */}
          <Tabs value={activeTab} onValueChange={handleAdminTabChange} className="space-y-6">
            <div className="space-y-2">
            <TabsList data-tour="wfm-tabs">
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="work" data-tour="wfm-jobs">{terms.workItemPlural}</TabsTrigger>
              <TabsTrigger value="team" data-tour="wfm-technicians-tab">{terms.teamMemberPlural}</TabsTrigger>
              <TabsTrigger value="time" data-tour="wfm-timesheet">Time</TabsTrigger>
            </TabsList>
            <p className="text-sm text-muted-foreground">
              {activeTab === 'today' && 'Your operational command center — see what needs attention right now.'}
              {activeTab === 'work' && `Manage ${terms.workItemPlural.toLowerCase()}, schedules, and reports in one place.`}
              {activeTab === 'team' && `Your roster of ${terms.teamMemberPlural.toLowerCase()} — sync from HR to stay aligned.`}
              {activeTab === 'time' && 'Review logged hours and approve timesheets for payroll.'}
            </p>
            </div>

            <TabsContent value="today" className="space-y-6">
              {isCustomizeMode ? (
                <div className="space-y-3">
                  <ModuleCustomizeHint surfaceLabel={surfaceConfig.label} />
                  <div className="flex flex-wrap items-center gap-2">
                    <WidgetCatalogDialog available={availableWidgets} onAdd={addWidget} />
                    <Button type="button" variant="ghost" size="sm" onClick={resetToDefault}>
                      Reset layout
                    </Button>
                  </div>
                </div>
              ) : null}
              <WfmTodayTab
                terms={terms}
                loading={loading}
                dueTodayCount={dueTodayCount}
                unassignedCount={unassignedJobsCount}
                overdueCount={overdueJobs}
                inProgressCount={inProgressJobs}
                activeTeamCount={activeTechnicians}
                needsAttentionJobs={needsAttentionCards}
                unassignedJobs={unassignedJobCards}
                teamCapacity={teamCapacity}
                recentActivity={recentActivity}
                onCreateWork={() => {
                  handleAdminTabChange('work')
                  handleWorkSubTabChange('list')
                  setIsCreateJobOpen(true)
                }}
                onGoToWork={() => {
                  handleAdminTabChange('work')
                  handleWorkSubTabChange('list')
                }}
                onGoToTeam={() => handleAdminTabChange('team')}
                statusColor={getStatusColor}
                layout={tabLayout}
              />
            </TabsContent>

            <TabsContent value="work" className="space-y-4">
              <Tabs value={workSubTab} onValueChange={handleWorkSubTabChange}>
                <TabsList className="mb-2">
                  <TabsTrigger value="list">
                    <List className="h-4 w-4 mr-2" />
                    List
                  </TabsTrigger>
                  <TabsTrigger value="board" data-tour="wfm-board-tab">
                    <LayoutGrid className="h-4 w-4 mr-2" />
                    Board
                  </TabsTrigger>
                  <TabsTrigger value="schedule" data-tour="wfm-calendar">
                    <Calendar className="h-4 w-4 mr-2" />
                    {terms.scheduleLabel}
                  </TabsTrigger>
                  <TabsTrigger value="reports" data-tour="wfm-reports-tab">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Reports
                  </TabsTrigger>
                </TabsList>

                {isCustomizeMode ? (
                  <div className="space-y-3 mb-2">
                    <ModuleCustomizeHint surfaceLabel={surfaceConfig.label} />
                    <div className="flex flex-wrap items-center gap-2">
                      <WidgetCatalogDialog available={availableWidgets} onAdd={addWidget} />
                      <Button type="button" variant="ghost" size="sm" onClick={resetToDefault}>
                        Reset layout
                      </Button>
                    </div>
                  </div>
                ) : null}

            <TabsContent value="list" className="mt-0">
              <WfmWorkBoard
                terms={terms}
                viewMode="list"
                jobs={jobs}
                technicians={technicians}
                selectedJobIds={selectedJobIds}
                isCreateJobOpen={isCreateJobOpen}
                newJobTitle={newJobTitle}
                newJobDescription={newJobDescription}
                newJobAddress={newJobAddress}
                newJobTechnician={newJobTechnician}
                newJobStartDate={newJobStartDate}
                newJobEndDate={newJobEndDate}
                newJobStatus={newJobStatus}
                newJobClientId={newJobClientId}
                editingJob={editingJob}
                editJobTitle={editJobTitle}
                editJobTechnician={editJobTechnician}
                editJobStartDate={editJobStartDate}
                editJobEndDate={editJobEndDate}
                editJobStatus={editJobStatus}
                editJobLocation={editJobLocation}
                editJobDbId={editJobDbId}
                editJobClientId={editJobClientId}
                editJobInvoiceId={editJobInvoiceId}
                editJobProjectId={editJobProjectId}
                editJobTaskId={editJobTaskId}
                onIntegrationsUpdated={() => void fetchData()}
                onSelectAll={handleSelectAll}
                onSelectJob={handleSelectJob}
                onDeleteSelected={handleDeleteSelected}
                onOpenJob={openEditJob}
                onViewLocation={setViewingJobLocation}
                onCreateDialogOpenChange={handleCreateJobDialogOpenChange}
                onCreateJob={handleCreateJob}
                onSaveJobEdit={handleSaveJobEdit}
                onEditDialogOpenChange={(open) => {
                  if (!open) {
                    setEditingJob(null)
                    setEditJobDbId(null)
                  }
                }}
                onKanbanStatusChange={handleKanbanStatusChange}
                setNewJobTitle={setNewJobTitle}
                setNewJobDescription={setNewJobDescription}
                setNewJobAddress={setNewJobAddress}
                setNewJobTechnician={setNewJobTechnician}
                setNewJobStartDate={setNewJobStartDate}
                setNewJobEndDate={setNewJobEndDate}
                setNewJobStatus={setNewJobStatus}
                setNewJobClientId={(id, client) => {
                  setNewJobClientId(id)
                  setNewJobClient(client)
                }}
                setEditJobTitle={setEditJobTitle}
                setEditJobTechnician={handleEditJobTechnicianChange}
                setEditJobStartDate={setEditJobStartDate}
                setEditJobEndDate={setEditJobEndDate}
                setEditJobStatus={setEditJobStatus}
                setEditJobLocation={setEditJobLocation}
                emphasizeLocation={terms.emphasizeLocation}
                layout={tabLayout}
              />
            </TabsContent>

            <TabsContent value="board" className="mt-0">
              <WfmWorkBoard
                terms={terms}
                viewMode="board"
                jobs={jobs}
                technicians={technicians}
                selectedJobIds={selectedJobIds}
                isCreateJobOpen={isCreateJobOpen}
                newJobTitle={newJobTitle}
                newJobDescription={newJobDescription}
                newJobAddress={newJobAddress}
                newJobTechnician={newJobTechnician}
                newJobStartDate={newJobStartDate}
                newJobEndDate={newJobEndDate}
                newJobStatus={newJobStatus}
                newJobClientId={newJobClientId}
                editingJob={editingJob}
                editJobTitle={editJobTitle}
                editJobTechnician={editJobTechnician}
                editJobStartDate={editJobStartDate}
                editJobEndDate={editJobEndDate}
                editJobStatus={editJobStatus}
                editJobLocation={editJobLocation}
                editJobDbId={editJobDbId}
                editJobClientId={editJobClientId}
                editJobInvoiceId={editJobInvoiceId}
                editJobProjectId={editJobProjectId}
                editJobTaskId={editJobTaskId}
                onIntegrationsUpdated={() => void fetchData()}
                onSelectAll={handleSelectAll}
                onSelectJob={handleSelectJob}
                onDeleteSelected={handleDeleteSelected}
                onOpenJob={openEditJob}
                onViewLocation={setViewingJobLocation}
                onCreateDialogOpenChange={handleCreateJobDialogOpenChange}
                onCreateJob={handleCreateJob}
                onSaveJobEdit={handleSaveJobEdit}
                onEditDialogOpenChange={(open) => {
                  if (!open) {
                    setEditingJob(null)
                    setEditJobDbId(null)
                  }
                }}
                onKanbanStatusChange={handleKanbanStatusChange}
                setNewJobTitle={setNewJobTitle}
                setNewJobDescription={setNewJobDescription}
                setNewJobAddress={setNewJobAddress}
                setNewJobTechnician={setNewJobTechnician}
                setNewJobStartDate={setNewJobStartDate}
                setNewJobEndDate={setNewJobEndDate}
                setNewJobStatus={setNewJobStatus}
                setNewJobClientId={(id, client) => {
                  setNewJobClientId(id)
                  setNewJobClient(client)
                }}
                setEditJobTitle={setEditJobTitle}
                setEditJobTechnician={handleEditJobTechnicianChange}
                setEditJobStartDate={setEditJobStartDate}
                setEditJobEndDate={setEditJobEndDate}
                setEditJobStatus={setEditJobStatus}
                setEditJobLocation={setEditJobLocation}
                emphasizeLocation={terms.emphasizeLocation}
                layout={tabLayout}
              />
            </TabsContent>
            <TabsContent value="schedule" className="mt-0">
              <ModuleWidgetCanvas
                widgets={tabLayout.widgets}
                catalog={tabLayout.catalog}
                customizeMode={tabLayout.customizeMode}
                onLayoutChange={tabLayout.onLayoutChange}
                onRemoveWidget={tabLayout.onRemoveWidget}
                rowHeight={36}
                renderWidget={(widgetId) => {
                  if (widgetId !== 'schedule') return null
                  return (
              <Card className="h-full overflow-auto">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Schedule Calendar</CardTitle>
                      <CardDescription>View and manage job schedules</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={previousMonth}>
                        ← Previous
                      </Button>
                      <Button variant="outline" size="sm" onClick={goToToday}>
                        Today
                      </Button>
                      <Button variant="outline" size="sm" onClick={nextMonth}>
                        Next →
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Calendar Header */}
                  <div className="mb-6">
                    <h3 className="text-2xl font-bold text-center">
                      {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </h3>
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-2">
                    {/* Day Headers */}
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <div key={day} className="text-center font-semibold text-sm text-muted-foreground py-2">
                        {day}
                      </div>
                    ))}

                    {/* Calendar Days */}
                    {(() => {
                      const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth)
                      const days = []
                      
                      // Empty cells for days before month starts
                      for (let i = 0; i < startingDayOfWeek; i++) {
                        days.push(
                          <div key={`empty-${i}`} className="min-h-32 p-2 border rounded-lg bg-muted/20" />
                        )
                      }
                      
                      // Days of the month
                      for (let day = 1; day <= daysInMonth; day++) {
                        const date = new Date(year, month, day)
                        const { starting, due, all: dayJobs } = getJobsForDate(date)
                        const isToday = new Date().toDateString() === date.toDateString()
                        const isDragOver = dragOverDate?.toDateString() === date.toDateString()
                        const maxShow = 5
                        const startingShow = starting.slice(0, 3)
                        const dueShow = due.slice(0, 3)
                        const totalShown = Math.min(dayJobs.length, maxShow)

                        days.push(
                          <div
                            key={day}
                            className={`min-h-32 p-2 border rounded-lg hover:bg-accent transition-colors cursor-pointer ${
                              isToday ? 'border-primary bg-primary/5' : ''
                            } ${
                              isDragOver ? 'bg-blue-100 border-blue-300 border-2' : ''
                            }`}
                            onClick={() => handleCellClick(date)}
                            onDragOver={(e) => handleDragOver(e, date)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, date)}
                          >
                            <div className={`text-sm font-semibold mb-1 ${isToday ? 'text-primary' : ''}`}>
                              {day}
                            </div>
                            <div className="space-y-1">
                              {startingShow.map((job) => (
                                <div
                                  key={`s-${job.id}`}
                                  className={`text-xs p-1 rounded truncate font-medium cursor-move hover:opacity-80 transition-opacity ${
                                    job.status === 'In Progress' ? 'bg-yellow-400 text-yellow-900' :
                                    job.status === 'Completed' ? 'bg-green-400 text-green-900' :
                                    job.status === 'Overdue' ? 'bg-red-400 text-red-900' :
                                    job.status === 'Unassigned' ? 'bg-amber-400 text-amber-900' :
                                    'bg-blue-400 text-blue-900'
                                  } ${draggedJob?.id === job.id ? 'opacity-50' : ''}`}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, job)}
                                  onClick={(e) => { e.stopPropagation(); setViewingCalendarJob(job) }}
                                >
                                  <span className="text-[10px] opacity-90 mr-0.5">Start</span> {job.title}
                                </div>
                              ))}
                              {dueShow.map((job) => (
                                <div
                                  key={`d-${job.id}`}
                                  className={`text-xs p-1 rounded truncate font-medium cursor-move hover:opacity-80 transition-opacity border-l-2 border-amber-500 ${
                                    job.status === 'Completed' ? 'bg-green-300 text-green-900' :
                                    job.status === 'Overdue' ? 'bg-red-400 text-red-900' :
                                    'bg-amber-100 text-amber-900'
                                  } ${draggedJob?.id === job.id ? 'opacity-50' : ''}`}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, job)}
                                  onClick={(e) => { e.stopPropagation(); setViewingCalendarJob(job) }}
                                >
                                  <span className="text-[10px] opacity-90 mr-0.5">Due</span> {job.title}
                                </div>
                              ))}
                              {dayJobs.length > maxShow && (
                                <div
                                  className="text-xs text-muted-foreground cursor-pointer hover:text-foreground"
                                  onClick={(e) => { e.stopPropagation(); setSelectedDate(date) }}
                                >
                                  +{dayJobs.length - maxShow} more
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      }
                      
                      return days
                    })()}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground border-t pt-3">
                    <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded bg-blue-400" /> Start = job starts this day</span>
                    <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded bg-amber-400 border-l-2 border-amber-600" /> Due = job due this day</span>
                  </div>
                </CardContent>
              </Card>
                  )
                }}
              />

              {/* Job Detail Dialog */}
              <Dialog open={!!viewingCalendarJob} onOpenChange={() => setViewingCalendarJob(null)}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{viewingCalendarJob?.title}</DialogTitle>
                    <DialogDescription>Job Details</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground">Job ID</Label>
                        <p className="font-medium">{viewingCalendarJob?.id}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Status</Label>
                        <div className="mt-1">
                          <Badge variant="outline" className={getStatusColor(viewingCalendarJob?.status || '')}>
                            {viewingCalendarJob?.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-muted-foreground">Assigned Technician</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <p className="font-medium">{viewingCalendarJob?.technician}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground">Start Date</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <p className="font-medium">{viewingCalendarJob?.startDate}</p>
                        </div>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">End Date</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <p className="font-medium">{viewingCalendarJob?.endDate}</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label className="text-muted-foreground">Location</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <p className="font-medium">123 Main St, City, State 12345</p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button 
                        className="flex-1"
                        onClick={() => {
                          const job = viewingCalendarJob
                          setEditingCalendarJob(job)
                          setEditJobTitle(job.title)
                          setEditJobTechnician(job.technician || 'Unassigned')
                          setEditJobTechnicianId((job as { technician_id?: string | null }).technician_id ?? null)
                          setEditJobStartDate(job.startDate)
                          setEditJobEndDate(job.endDate)
                          setEditJobStatus(job.status)
                          setEditJobLocation((job as { location_address?: string | null; location?: string }).location_address ?? (job as { location?: string }).location ?? '')
                          setEditJobNotes("")
                          setViewingCalendarJob(null)
                        }}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Job
                      </Button>
                      <Button 
                        variant="destructive" 
                        onClick={async () => {
                          if (!window.confirm(`Are you sure you want to delete "${viewingCalendarJob?.title}"?`)) return
                          const dbId = (viewingCalendarJob as { dbId?: string } | null)?.dbId
                          if (isSupabaseConfigured && dbId) {
                            const ok = await deleteJob(dbId)
                            if (ok) {
                              setViewingCalendarJob(null)
                              await fetchData()
                            } else {
                              alert('Failed to delete job. Please try again.')
                            }
                          } else {
                            const updatedJobs = jobs.filter((j) => j.id !== viewingCalendarJob?.id)
                            setJobs(updatedJobs)
                            setDbJobs(updatedJobs as Job[])
                            setViewingCalendarJob(null)
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                      <Button variant="outline" onClick={() => setViewingCalendarJob(null)}>
                        Close
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Edit Job Dialog */}
              <Dialog open={!!editingCalendarJob} onOpenChange={() => setEditingCalendarJob(null)}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Job - {editingCalendarJob?.id}</DialogTitle>
                    <DialogDescription>Update job details</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="edit-cal-job-title">Job Title</Label>
                      <Input 
                        id="edit-cal-job-title" 
                        value={editJobTitle}
                        onChange={(e) => setEditJobTitle(e.target.value)}
                        placeholder="Enter job title" 
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-cal-job-technician">Assigned Technician</Label>
                      <Select
                        value={editJobTechnician || 'Unassigned'}
                        onValueChange={(v) => {
                          setEditJobTechnician(v)
                          setEditJobTechnicianId(v === 'Unassigned' ? null : getTechnicianIdByName(v) ?? null)
                        }}
                      >
                        <SelectTrigger id="edit-cal-job-technician">
                          <SelectValue placeholder="Select technician" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Unassigned">Unassigned</SelectItem>
                          {technicians.map((tech) => (
                            <SelectItem key={(tech as { id?: string }).id ?? tech.name} value={tech.name}>
                              {tech.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="edit-cal-start-date">Start Date</Label>
                        <Input 
                          id="edit-cal-start-date" 
                          value={editJobStartDate}
                          onChange={(e) => setEditJobStartDate(e.target.value)}
                          placeholder="Enter start date"
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-cal-end-date">End Date</Label>
                        <Input 
                          id="edit-cal-end-date" 
                          value={editJobEndDate}
                          onChange={(e) => setEditJobEndDate(e.target.value)}
                          placeholder="Enter end date"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="edit-cal-job-status">Status</Label>
                      <Select value={editJobStatus} onValueChange={setEditJobStatus}>
                        <SelectTrigger id="edit-cal-job-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Assigned">Assigned</SelectItem>
                          <SelectItem value="In Progress">In Progress</SelectItem>
                          <SelectItem value="Completed">Completed</SelectItem>
                          <SelectItem value="Overdue">Overdue</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="edit-cal-job-location">Address (optional)</Label>
                      <Input 
                        id="edit-cal-job-location" 
                        value={editJobLocation}
                        onChange={(e) => setEditJobLocation(e.target.value)}
                        placeholder="Street, city, state, zip" 
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-cal-job-notes">Notes</Label>
                      <Textarea 
                        id="edit-cal-job-notes" 
                        value={editJobNotes}
                        onChange={(e) => setEditJobNotes(e.target.value)}
                        placeholder="Add any additional notes"
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-2 pt-4">
                      <Button className="flex-1" onClick={handleSaveCalendarJob}>
                        Save Changes
                      </Button>
                      <Button variant="outline" onClick={() => setEditingCalendarJob(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* All Jobs for Date Dialog */}
              <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      Jobs for {selectedDate?.toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        month: 'long', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </DialogTitle>
                    <DialogDescription>All scheduled jobs for this date</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {selectedDate && getJobsForDate(selectedDate).all.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        No jobs scheduled for this date
                      </p>
                    ) : (
                      selectedDate && (() => {
                        const { starting, due, all } = getJobsForDate(selectedDate)
                        return all.map((job) => {
                          const isStart = starting.some(j => j.id === job.id)
                          const isDue = due.some(j => j.id === job.id)
                          const sameDay = job.startDate === job.endDate
                          const label = isStart && (isDue || sameDay) ? 'Starts & Due' : isStart ? 'Starts' : 'Due'
                          return (
                            <Card
                              key={job.id}
                              className="cursor-pointer hover:shadow-md transition-shadow"
                              onClick={() => {
                                setSelectedDate(null)
                                setViewingCalendarJob(job)
                              }}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h4 className="font-semibold">{job.title}</h4>
                                      <Badge variant="secondary" className="text-[10px]">{label}</Badge>
                                    </div>
                                    <div className="space-y-1 text-sm text-muted-foreground">
                                      <div className="flex items-center gap-2">
                                        <Users className="h-3 w-3" />
                                        <span>{job.technician}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Briefcase className="h-3 w-3" />
                                        <span>{job.id}</span>
                                        {job.startDate && job.endDate && (
                                          <span> · {job.startDate} → {job.endDate}</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <Badge variant="outline" className={getStatusColor(job.status)}>
                                    {job.status}
                                  </Badge>
                                </div>
                              </CardContent>
                            </Card>
                          )
                        })
                      })()
                    )}
                  </div>
                  <div className="flex justify-end pt-4">
                    <Button variant="outline" onClick={() => setSelectedDate(null)}>
                      Close
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Quick Create Job Dialog */}
              {isQuickCreateOpen && (
                <Dialog open={true} onOpenChange={() => {
                  setIsQuickCreateOpen(false)
                  setQuickCreateDate(null)
                  setNewJobTitle("")
                  setNewJobTechnician("")
                  setNewJobStatus("Assigned")
                }}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Quick Create Job</DialogTitle>
                      <DialogDescription>
                        Create a new job for {quickCreateDate?.toLocaleDateString('en-US', { 
                          weekday: 'long', 
                          month: 'long', 
                          day: 'numeric', 
                          year: 'numeric' 
                        }) || 'selected date'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="quick-job-title">Job Title *</Label>
                        <Input 
                          id="quick-job-title" 
                          placeholder="Enter job title"
                          value={newJobTitle}
                          onChange={(e) => setNewJobTitle(e.target.value)}
                          autoFocus
                        />
                      </div>
                      <CustomerAccountPicker
                        value={newJobClientId}
                        onChange={(id, client) => {
                          setNewJobClientId(id)
                          setNewJobClient(client)
                        }}
                        label="Link customer (optional)"
                      />
                      <div>
                        <Label htmlFor="quick-job-technician">Assign Technician</Label>
                        <Select value={newJobTechnician} onValueChange={setNewJobTechnician}>
                          <SelectTrigger id="quick-job-technician">
                            <SelectValue placeholder="Select technician" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Unassigned">Unassigned</SelectItem>
                            {technicians.map((tech) => (
                              <SelectItem key={tech.name} value={tech.name}>
                                {tech.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="quick-job-status">Status</Label>
                        <Select value={newJobStatus} onValueChange={setNewJobStatus}>
                          <SelectTrigger id="quick-job-status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Unassigned">Unassigned</SelectItem>
                            <SelectItem value="Assigned">Assigned</SelectItem>
                            <SelectItem value="In Progress">In Progress</SelectItem>
                            <SelectItem value="Completed">Completed</SelectItem>
                            <SelectItem value="Overdue">Overdue</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2 pt-4">
                        <Button className="flex-1" onClick={handleQuickCreateJob}>
                          Create Job
                        </Button>
                        <Button variant="outline" onClick={() => {
                          setIsQuickCreateOpen(false)
                          setQuickCreateDate(null)
                          setNewJobTitle("")
                          setNewJobTechnician("")
                          setNewJobStatus("Assigned")
                        }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </TabsContent>
            <TabsContent value="reports" className="mt-0">
              <ModuleWidgetCanvas
                widgets={tabLayout.widgets}
                catalog={tabLayout.catalog}
                customizeMode={tabLayout.customizeMode}
                onLayoutChange={tabLayout.onLayoutChange}
                onRemoveWidget={tabLayout.onRemoveWidget}
                rowHeight={36}
                renderWidget={(widgetId) => {
                  if (widgetId !== 'reports') return null
                  return (
                <Card className="h-full overflow-auto">
                  <CardHeader>
                  <CardTitle>Reports & Analytics</CardTitle>
                  <CardDescription>View performance metrics and export data</CardDescription>
                  </CardHeader>
                <CardContent className="pt-0">
                  <Tabs defaultValue="performance" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto flex-wrap gap-1 bg-muted/50 p-1 mb-6">
                      <TabsTrigger value="performance" className="text-sm">
                        Performance Overview
                      </TabsTrigger>
                      <TabsTrigger value="technicians" className="text-sm">
                        Technician Performance
                      </TabsTrigger>
                      <TabsTrigger value="job-status" className="text-sm">
                        Job Status Breakdown
                      </TabsTrigger>
                      <TabsTrigger value="timesheet-status" className="text-sm">
                        Timesheet Status
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="performance" className="mt-0 min-h-[200px]">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="rounded-lg border bg-muted/30 p-4">
                          <div className="text-2xl font-bold text-green-500">
                                {jobs.length > 0 ? ((jobs.filter(j => j.status === 'Completed').length / jobs.length) * 100).toFixed(1) : "0"}%
                          </div>
                          <p className="text-sm text-muted-foreground">Completion Rate</p>
                            </div>
                            <div className="rounded-lg border bg-muted/30 p-4">
                          <div className="text-2xl font-bold">
                            {timesheets.reduce((sum, t) => sum + calculateHours(t.clockIn, t.clockOut), 0).toFixed(1)}h
                          </div>
                          <p className="text-sm text-muted-foreground">Total Hours Logged</p>
                            </div>
                            <div className="rounded-lg border bg-muted/30 p-4">
                          <div className="text-2xl font-bold">
                                {jobs.length > 0 ? (timesheets.reduce((sum, t) => sum + calculateHours(t.clockIn, t.clockOut), 0) / jobs.length).toFixed(1) : "0"}h
                          </div>
                          <p className="text-sm text-muted-foreground">Avg Hours per Job</p>
                            </div>
                            <div className="rounded-lg border bg-muted/30 p-4">
                          <div className="text-2xl font-bold text-blue-500">
                            {technicians.filter(t => t.status === 'Active').length}
                          </div>
                          <p className="text-sm text-muted-foreground">Active Technicians</p>
                    </div>
                          </div>
                        </TabsContent>
                        <TabsContent value="technicians" className="mt-0">
                          <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Technician</TableHead>
                          <TableHead>Jobs Completed</TableHead>
                          <TableHead>Total Hours</TableHead>
                          <TableHead>Avg Hours/Job</TableHead>
                          <TableHead>Performance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {technicians.map((tech, index) => {
                          const techJobs = jobs.filter(j => j.technician === tech.name);
                          const completedJobs = techJobs.filter(j => j.status === 'Completed').length;
                          const techTimesheets = timesheets.filter(t => t.technician === tech.name);
                          const totalHours = techTimesheets.reduce((sum, t) => sum + calculateHours(t.clockIn, t.clockOut), 0);
                          const avgHours = completedJobs > 0 ? totalHours / completedJobs : 0;
                                  const performance = techJobs.length > 0 ? (completedJobs / techJobs.length) * 100 : 0;

                          return (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{tech.name}</TableCell>
                              <TableCell>{completedJobs}/{techJobs.length}</TableCell>
                              <TableCell>{totalHours.toFixed(1)}h</TableCell>
                              <TableCell>{avgHours.toFixed(1)}h</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                          <div className="flex-1 bg-secondary h-2 rounded-full overflow-hidden min-w-[60px]">
                                    <div 
                                              className="h-full bg-green-500 rounded-full transition-all"
                                              style={{ width: `${Math.min(100, performance)}%` }}
                                    />
                                  </div>
                                          <span className="text-sm font-medium whitespace-nowrap">{performance.toFixed(0)}%</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                          </div>
                        </TabsContent>
                    <TabsContent value="job-status" className="mt-0 min-h-[200px]">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                            <div className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/30 transition-colors">
                              <span className="text-sm font-medium">Assigned</span>
                              <Badge className="bg-slate-500/10 text-slate-600 border-slate-500/20">
                                {jobs.filter(j => j.status === 'Assigned').length}
                          </Badge>
                        </div>
                            <div className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/30 transition-colors">
                              <span className="text-sm font-medium">In Progress</span>
                          <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                            {jobs.filter(j => j.status === 'In Progress').length}
                          </Badge>
                        </div>
                            <div className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/30 transition-colors">
                              <span className="text-sm font-medium">Completed</span>
                          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                            {jobs.filter(j => j.status === 'Completed').length}
                          </Badge>
                        </div>
                            <div className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/30 transition-colors">
                              <span className="text-sm font-medium">On Hold</span>
                              <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20">
                                {jobs.filter(j => j.status === 'On Hold').length}
                              </Badge>
                      </div>
                            <div className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/30 transition-colors">
                              <span className="text-sm font-medium">Cancelled</span>
                              <Badge className="bg-gray-500/10 text-gray-500 border-gray-500/20">
                                {jobs.filter(j => j.status === 'Cancelled').length}
                          </Badge>
                        </div>
                      </div>
                        </TabsContent>
                    <TabsContent value="timesheet-status" className="mt-0 min-h-[200px]">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                            <div className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/30 transition-colors">
                              <span className="text-sm font-medium">Clocked In</span>
                        <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                          {timesheets.filter(t => t.status === 'Clocked In').length}
                        </Badge>
                      </div>
                            <div className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/30 transition-colors">
                              <span className="text-sm font-medium">Clocked Out</span>
                        <Badge className="bg-gray-500/10 text-gray-500 border-gray-500/20">
                          {timesheets.filter(t => t.status === 'Clocked Out').length}
                        </Badge>
                      </div>
                            <div className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/30 transition-colors">
                              <span className="text-sm font-medium">Pending Approval</span>
                        <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                          {timesheets.filter(t => t.status === 'Pending Approval').length}
                        </Badge>
                      </div>
                            <div className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/30 transition-colors">
                              <span className="text-sm font-medium">Approved</span>
                        <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                          {timesheets.filter(t => t.status === 'Approved').length}
                        </Badge>
                      </div>
                </div>
                        </TabsContent>
                  </Tabs>
                  <div className="border-t pt-4 mt-6">
                    <p className="text-sm font-medium text-muted-foreground mb-3">Export</p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={exportJobsToCSV}>
                        <FileText className="h-4 w-4 mr-2" />
                        Jobs (CSV)
                      </Button>
                      <Button variant="outline" size="sm" onClick={exportTimesheetsToCSV}>
                        <FileText className="h-4 w-4 mr-2" />
                        Timesheets (CSV)
                      </Button>
                      <Button variant="outline" size="sm" onClick={exportPerformanceToPDF}>
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Performance (PDF)
                      </Button>
                    </div>
                    </div>
                  </CardContent>
                </Card>
                  )
                }}
              />
            </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="team">
              {isCustomizeMode ? (
                <div className="space-y-3 mb-4">
                  <ModuleCustomizeHint surfaceLabel={surfaceConfig.label} />
                  <div className="flex flex-wrap items-center gap-2">
                    <WidgetCatalogDialog available={availableWidgets} onAdd={addWidget} />
                    <Button type="button" variant="ghost" size="sm" onClick={resetToDefault}>
                      Reset layout
                    </Button>
                  </div>
                </div>
              ) : null}
              <WfmTeamTab
                terms={terms}
                technicians={technicians}
                selectedIndices={selectedTechnicianIndices}
                isAddOpen={isAddTechnicianOpen}
                isImportOpen={isImportOpen}
                newTechName={newTechName}
                newTechPhone={newTechPhone}
                newTechEmail={newTechEmail}
                importFile={importFile}
                importPreview={importPreview}
                importResult={importResult}
                importing={importing}
                syncing={syncingFromHr}
                hrSyncResult={hrSyncResult}
                onSelectAll={handleSelectAllTechnicians}
                onSelect={handleSelectTechnician}
                onDeleteSelected={handleDeleteSelectedTechnicians}
                onEdit={handleEditTechnician}
                onAddOpenChange={setIsAddTechnicianOpen}
                onImportOpenChange={setIsImportOpen}
                onAdd={handleAddTechnician}
                onImport={handleImport}
                onSyncFromHr={handleSyncFromHr}
                onPhoneChange={handlePhoneChange}
                onImportFile={handleImportFile}
                setNewTechName={setNewTechName}
                setNewTechEmail={setNewTechEmail}
                layout={tabLayout}
              />
              <Dialog open={editingTechnicianIndex !== null} onOpenChange={(open) => !open && setEditingTechnicianIndex(null)}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit {terms.teamMember}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="edit-tech-name">Full Name *</Label>
                      <Input id="edit-tech-name" value={editTechName} onChange={(e) => setEditTechName(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="edit-tech-phone">Phone</Label>
                      <Input id="edit-tech-phone" value={editTechPhone} onChange={(e) => setEditTechPhone(e.target.value)} maxLength={14} />
                    </div>
                    <div>
                      <Label htmlFor="edit-tech-email">Email</Label>
                      <Input id="edit-tech-email" type="email" value={editTechEmail} onChange={(e) => setEditTechEmail(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="edit-tech-status">Status</Label>
                      <Select value={editTechStatus} onValueChange={setEditTechStatus}>
                        <SelectTrigger id="edit-tech-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Inactive">Inactive</SelectItem>
                          <SelectItem value="On Leave">On Leave</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button className="w-full" onClick={handleSaveTechnician}>Save Changes</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </TabsContent>
            <TabsContent value="time">
              {isCustomizeMode ? (
                <div className="space-y-3 mb-4">
                  <ModuleCustomizeHint surfaceLabel={surfaceConfig.label} />
                  <div className="flex flex-wrap items-center gap-2">
                    <WidgetCatalogDialog available={availableWidgets} onAdd={addWidget} />
                    <Button type="button" variant="ghost" size="sm" onClick={resetToDefault}>
                      Reset layout
                    </Button>
                  </div>
                </div>
              ) : null}
              <WfmTimeTab
                terms={terms}
                timesheets={timesheets}
                technicians={technicians}
                jobs={jobs}
                selectedIds={selectedTimesheetIds}
                isAddOpen={isAddTimesheetOpen}
                editingId={editingTimesheetId}
                approvingId={approvingTimesheetId}
                newTechnician={newTimesheetTechnician}
                newJob={newTimesheetJob}
                newDate={newTimesheetDate}
                newClockIn={newTimesheetClockIn}
                newClockOut={newTimesheetClockOut}
                newNotes={newTimesheetNotes}
                editTechnician={editTimesheetTechnician}
                editJob={editTimesheetJob}
                editDate={editTimesheetDate}
                editClockIn={editTimesheetClockIn}
                editClockOut={editTimesheetClockOut}
                editStatus={editTimesheetStatus}
                editNotes={editTimesheetNotes}
                onSelectAll={handleSelectAllTimesheets}
                onSelect={handleSelectTimesheet}
                onDeleteSelected={handleDeleteSelectedTimesheets}
                onAddOpenChange={setIsAddTimesheetOpen}
                onAdd={handleAddTimesheet}
                onEdit={handleEditTimesheet}
                onSaveEdit={handleSaveTimesheet}
                onEditOpenChange={(open) => !open && setEditingTimesheetId(null)}
                onApprove={handleApproveTimesheet}
                onReject={handleRejectTimesheet}
                setNewTechnician={setNewTimesheetTechnician}
                setNewJob={setNewTimesheetJob}
                setNewDate={setNewTimesheetDate}
                setNewClockIn={setNewTimesheetClockIn}
                setNewClockOut={setNewTimesheetClockOut}
                setNewNotes={setNewTimesheetNotes}
                setEditDate={setEditTimesheetDate}
                setEditClockIn={setEditTimesheetClockIn}
                setEditClockOut={setEditTimesheetClockOut}
                setEditStatus={setEditTimesheetStatus}
                setEditNotes={setEditTimesheetNotes}
                layout={tabLayout}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Worker portal — unified My Work experience */}
      {activePortal === "technician" && (
        <div data-tour="wfm-worker-portal">
          {currentUserLoading ? (
            <Card className="mb-8">
              <CardContent className="py-12 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : (
            <WfmMyWorkPanel
              terms={terms}
              employeeId={myEmployeeId ?? ''}
              employeeEmail={myEmail}
              employeeName={currentUserDisplayName}
              initialTechnician={myTechnician}
              showManagerLink={hasWfmManagerAccess}
            />
          )}
        </div>
      )}

    </MotionPage>
  )
}
