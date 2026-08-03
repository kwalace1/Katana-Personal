import { toDateKey, parseDateOnly, formatDateOnly } from '@/lib/due-date-utils'
import { useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { getProjectById, getProjectWithProgress, updateProject, type Task, type Project } from "@/lib/project-data-supabase"
import * as hrApi from "@/lib/hr-api"
import type { Employee } from "@/lib/hr-api"
import {
  ArrowLeft,
  List,
  LayoutGrid,
  Target,
  GitBranch,
  CalendarIcon,
  TrendingUp,
  FolderOpen,
  Share2,
  BarChart3,
  AlertCircle,
  Clock,
  ChevronDown,
  CheckCircle2,
  Circle,
  Loader2,
  Upload,
  Settings,
  Users,
  ListChecks,
  Eye,
  EyeOff,
  GripVertical,
} from "lucide-react"
import { Link } from "react-router-dom"
import { MotionPage } from "@/components/motion-page"
import { KanbanBoard } from "./kanban-board"
import { TableView } from "./table-view"
import { CalendarView } from "./calendar-view"
import { TimelineView } from "./timeline-view"
import { TeamManagement } from "./team-management"
import { FileManagement } from "./file-management"
import { SprintView } from "./sprint-view"
import { PlanView } from "./plan-view"
import { ReportsView } from "./reports-view"
import { ShareView } from "./share-view"
import { AddTaskDialog } from "./add-task-dialog"
import { ImportDataDialog } from "./import-data-dialog"
import { TaskDetailsDialog } from "./task-details-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
  type PmActivityFeedFilter,
  type PmFeedItem,
  PM_ACTIVITY_CATEGORY_LABELS,
  PM_TASK_STATUS_LABELS,
  buildPmActivityFeed,
  getPmActivityCategory,
} from "@/lib/pm-activity"
import type { Activity } from "@/lib/project-data"
import { formatSubtaskCompletionMeta } from "@/lib/project-data"
import { getTaskWithCachedSubtasks } from "@/lib/subtasks-cache"
import { useAuth } from "@/contexts/AuthContext"
import { useLoggedInHrEmployee } from "@/hooks/use-logged-in-hr-employee"
import { canEditProject } from "@/lib/pm-access"
import { PmProjectLinkedRecords } from "./PmProjectLinkedRecords"
import { ModuleDiscussion } from "@/components/comms/ModuleDiscussion"
import {
  ModuleCustomizeControls,
  ModuleCustomizeHint,
} from "@/components/module-layout/ModuleCustomizeBar"
import { ModuleWidgetCanvas } from "@/components/module-layout/ModuleWidgetCanvas"
import { WidgetCatalogDialog } from "@/components/module-layout/WidgetCatalogDialog"
import { useModuleWidgetLayout } from "@/hooks/useModuleWidgetLayout"
import {
  DETAIL_VIEW_META,
  normalizeProjectsDetailLayout,
  reorderDetailViews,
  toggleDetailViewHidden,
  type ProjectDetailViewId,
} from "@/lib/projects/projects-layout"
import {
  PROJECTS_DETAIL_SURFACE,
  PROJECTS_DETAIL_WIDGET_CATALOG,
  PROJECTS_MODULE_ID,
  detailWidgetLayoutToBase,
  normalizeProjectsDetailWidgetLayout,
} from "@/lib/projects/projects-widget-layout"
import { cn } from "@/lib/utils"

interface ProjectDetailProps {
  projectId: string
}

export function ProjectDetail({ projectId }: ProjectDetailProps) {
  const { profile } = useAuth()
  const { loggedInEmployeeId, loginNames, loginEmails } = useLoggedInHrEmployee()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [hrEmployees, setHrEmployees] = useState<Employee[]>([])
  const [activeView, setActiveView] = useState<ProjectDetailViewId>("board")
  const [addTaskDialogOpen, setAddTaskDialogOpen] = useState(false)
  const [addTaskDefaultStatus, setAddTaskDefaultStatus] = useState<Task["status"]>("todo")
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskDetailsOpen, setTaskDetailsOpen] = useState(false)
  const RECENT_ACTIVITY_INITIAL = 3
  const [activityExpanded, setActivityExpanded] = useState(false)
  const [activityFilter, setActivityFilter] = useState<PmActivityFeedFilter>('all')
  const [importOpen, setImportOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsForm, setSettingsForm] = useState({ name: '', status: '' as Project['status'], deadline: '', description: '' })
  const [draggedViewIndex, setDraggedViewIndex] = useState<number | null>(null)
  const draggedViewIndexRef = useRef<number | null>(null)

  const {
    layout: detailLayout,
    setLayout: setDetailLayout,
    isCustomizeMode,
    enterCustomize,
    saveAndExit,
    onLayoutChange,
    addWidget,
    removeWidget,
    availableWidgets,
    resetToDefault,
  } = useModuleWidgetLayout({
    moduleId: PROJECTS_MODULE_ID,
    surfaceId: PROJECTS_DETAIL_SURFACE,
    catalog: PROJECTS_DETAIL_WIDGET_CATALOG,
    normalize: normalizeProjectsDetailWidgetLayout,
    toBase: detailWidgetLayoutToBase,
    successMessage: 'Project detail layout saved',
  })

  useEffect(() => {
    const preferred = detailLayout.extras.defaultView
    const hidden = new Set(detailLayout.extras.hiddenViewModes)
    if (!hidden.has(preferred)) {
      setActiveView(preferred)
      return
    }
    const fallback =
      detailLayout.extras.viewModeOrder.find((id) => !hidden.has(id)) ?? 'board'
    setActiveView(fallback)
  }, [
    detailLayout.extras.defaultView,
    detailLayout.extras.hiddenViewModes,
    detailLayout.extras.viewModeOrder,
  ])

  const VIEW_ICONS: Record<ProjectDetailViewId, typeof List> = {
    table: List,
    board: LayoutGrid,
    plan: Target,
    timeline: GitBranch,
    calendar: CalendarIcon,
    sprint: TrendingUp,
    team: Users,
    files: FolderOpen,
    share: Share2,
    reports: BarChart3,
  }

  const visibleViewModes = useMemo(() => {
    const hidden = new Set(detailLayout.extras.hiddenViewModes)
    return detailLayout.extras.viewModeOrder.filter(
      (id) => isCustomizeMode || !hidden.has(id)
    )
  }, [
    detailLayout.extras.viewModeOrder,
    detailLayout.extras.hiddenViewModes,
    isCustomizeMode,
  ])

  const activityFilterOptions: { value: PmActivityFeedFilter; label: string }[] = [
    { value: 'all', label: PM_ACTIVITY_CATEGORY_LABELS.all },
    { value: 'tasks', label: PM_ACTIVITY_CATEGORY_LABELS.tasks },
    { value: 'subtasks', label: PM_ACTIVITY_CATEGORY_LABELS.subtasks },
    { value: 'team', label: PM_ACTIVITY_CATEGORY_LABELS.team },
    { value: 'backlog', label: PM_TASK_STATUS_LABELS.backlog },
    { value: 'todo', label: PM_TASK_STATUS_LABELS.todo },
    { value: 'in-progress', label: PM_TASK_STATUS_LABELS['in-progress'] },
    { value: 'review', label: PM_TASK_STATUS_LABELS.review },
    { value: 'blocked', label: PM_TASK_STATUS_LABELS.blocked },
    { value: 'done', label: PM_TASK_STATUS_LABELS.done },
  ]

  const formatActivityTime = (timestamp: string) => {
    const d = new Date(timestamp)
    if (Number.isNaN(d.getTime())) return timestamp
    const diffMs = Date.now() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  const getActivityIcon = (activity: Activity) => {
    const category = getPmActivityCategory(activity.type)
    if (category === 'subtasks') return ListChecks
    if (category === 'team') return Users
    if (activity.type === 'task_completed') return CheckCircle2
    return Clock
  }

  const getActivityCategoryLabel = (activity: Activity) => {
    const category = getPmActivityCategory(activity.type)
    if (category === 'subtasks') return 'Subtask'
    if (category === 'team') return 'Team'
    if (category === 'tasks') return 'Task'
    return 'Update'
  }
  
  console.log("[ProjectDetail] Rendering, dialog open:", addTaskDialogOpen)
  
  // Load project data - wrapped in useCallback to prevent infinite loops
  const loadProject = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    try {
      if (!silent) setLoading(true)
      console.log('[ProjectDetail] Loading project data...', silent ? '(silent)' : '')
      const data = await getProjectById(projectId)
      if (data) {
        const projectWithProgress = await getProjectWithProgress(data)
        console.log('[ProjectDetail] Project loaded with', projectWithProgress.tasks.length, 'tasks')
        setProject(projectWithProgress)
      }
    } catch (err) {
      console.error('Error loading project:', err)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [projectId])

  const openSettings = useCallback(() => {
    if (!project) return
    setSettingsForm({
      name: project.name,
      status: project.status,
      deadline: project.deadline ?? '',
      description: project.description ?? '',
    })
    setSettingsOpen(true)
  }, [project])

  const saveSettings = useCallback(async () => {
    if (!settingsForm.name.trim()) { toast.error('Name cannot be empty'); return }
    const ok = await updateProject(projectId, {
      name: settingsForm.name.trim(),
      status: settingsForm.status,
      deadline: settingsForm.deadline,
      description: settingsForm.description.trim(),
    })
    if (ok) { loadProject(); toast.success('Project updated'); setSettingsOpen(false) }
    else toast.error('Failed to update project')
  }, [settingsForm, projectId, loadProject])

  // Initial load
  useEffect(() => {
    loadProject()
  }, [loadProject])

  // Load HR employees so the project owner picker can choose anyone in the org
  // without first having to add them to the project's team_members.
  useEffect(() => {
    let cancelled = false
    hrApi
      .getAllEmployees()
      .then((rows) => {
        if (!cancelled) setHrEmployees(rows)
      })
      .catch(() => {
        if (!cancelled) setHrEmployees([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Listen for data updates and refresh
  useEffect(() => {
    const handleProjectUpdate = (event: CustomEvent) => {
      if (event.detail.projectId === projectId) {
        console.log('[ProjectDetail] ✨ Project data updated event received, refreshing...')
        // Silent: Kanban/table fire this on every task move — avoid full-page loading spinner
        void loadProject({ silent: true })
      }
    }
    
    window.addEventListener('projectDataUpdated' as any, handleProjectUpdate)
    return () => window.removeEventListener('projectDataUpdated' as any, handleProjectUpdate)
  }, [projectId, loadProject])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">Project Not Found</h2>
          <p className="text-muted-foreground mb-4">The project you're looking for doesn't exist.</p>
          <Link to="/projects">
            <Button>Back to Katana PM</Button>
          </Link>
        </div>
      </div>
    )
  }

  const canEdit = canEditProject(project, {
    employeeId: loggedInEmployeeId,
    loginNames,
    loginEmails,
    orgRole: profile?.role,
  })
  const readOnly = !canEdit

  return (
    <>
    <MotionPage subtle className="min-h-screen bg-background p-6 min-w-0">
      {/* Header */}
      <div className="border-b border-border/40 bg-card/30 backdrop-blur-sm -mx-6 px-6 mb-6">
        <div className="py-6">
          <Link
            to="/projects"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4 text-base"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Katana PM
          </Link>

          {/* Project Hero */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-5xl font-bold text-foreground mb-3">{project.name}</h1>
              <div className="flex items-center gap-3 mb-3">
                <Badge variant="outline" className="border-green-500 text-green-600 bg-green-500/20 dark:text-green-400 text-base px-3 py-1">
                  {project.status}
                </Badge>
                <Badge variant="outline" className="border-primary text-primary bg-primary/20 text-base px-3 py-1">
                  {project.progress}% Complete
                </Badge>
                {project.deadline && (
                  <Badge variant="outline" className="text-base px-3 py-1 gap-1.5">
                    <CalendarIcon className="h-4 w-4" />
                    {formatDateOnly(project.deadline)}
                  </Badge>
                )}
              </div>
              {project.description && (
                <p className="text-sm text-muted-foreground mb-3 max-w-2xl">{project.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                {project.createdBy?.name && (
                  <span>Created by <span className="font-medium text-foreground">{project.createdBy.name}</span></span>
                )}
                {project.owner?.name && (
                  <span>Assigned to <span className="font-medium text-foreground">{project.owner.name}</span></span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <ModuleCustomizeControls
                customizeMode={isCustomizeMode}
                onEnterCustomize={enterCustomize}
                onDone={() => void saveAndExit()}
                dataTourCustomize="project-detail-customize"
              />
              {canEdit ? (
              <Button variant="outline" size="sm" className="gap-2" onClick={openSettings}>
                <Settings className="h-4 w-4" />
                Project Settings
              </Button>
              ) : (
              <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm">
                <Eye className="h-4 w-4" />
                View only
              </Badge>
              )}
            </div>
          </div>

          {readOnly ? (
            <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
              You are viewing this project in read-only mode because you are not on the project team. Ask a project owner or admin to add you if you need to make changes.
            </div>
          ) : null}

          {isCustomizeMode ? (
            <div className="mb-4 space-y-3">
              <ModuleCustomizeHint surfaceLabel="project detail" />
              <div className="flex flex-wrap items-center gap-2">
                <WidgetCatalogDialog available={availableWidgets} onAdd={addWidget} />
                <Button type="button" variant="ghost" size="sm" onClick={resetToDefault}>
                  Reset layout
                </Button>
              </div>
            </div>
          ) : null}

          {/* View Mode Toolbar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 flex-wrap">
            {visibleViewModes.map((modeId, viewIndex) => {
              const Icon = VIEW_ICONS[modeId]
              const isHidden = detailLayout.extras.hiddenViewModes.includes(modeId)
              return (
                <div
                  key={modeId}
                  className={cn(
                    'relative flex items-center',
                    isCustomizeMode && isHidden && 'opacity-60',
                    draggedViewIndex === viewIndex && 'opacity-50'
                  )}
                  draggable={isCustomizeMode}
                  onDragStart={(event) => {
                    if (!isCustomizeMode) return
                    event.dataTransfer.effectAllowed = 'move'
                    event.dataTransfer.setData('text/plain', modeId)
                    draggedViewIndexRef.current = viewIndex
                    setDraggedViewIndex(viewIndex)
                  }}
                  onDragEnter={(event) => {
                    if (!isCustomizeMode) return
                    event.preventDefault()
                    const from = draggedViewIndexRef.current
                    if (from === null || from === viewIndex) return
                    setDetailLayout((prev) => {
                      const next = reorderDetailViews(
                        normalizeProjectsDetailLayout({ extras: prev.extras }),
                        from,
                        viewIndex
                      )
                      return { ...prev, extras: next.extras }
                    })
                    draggedViewIndexRef.current = viewIndex
                    setDraggedViewIndex(viewIndex)
                  }}
                  onDragOver={(event) => {
                    if (!isCustomizeMode) return
                    event.preventDefault()
                  }}
                  onDragEnd={() => {
                    draggedViewIndexRef.current = null
                    setDraggedViewIndex(null)
                  }}
                >
                  {isCustomizeMode ? (
                    <span className="mr-1 text-muted-foreground cursor-grab active:cursor-grabbing">
                      <GripVertical className="h-3.5 w-3.5" />
                    </span>
                  ) : null}
                  <Button
                    variant={activeView === modeId ? "default" : "ghost"}
                    size="sm"
                    onClick={() => {
                      if (isCustomizeMode) {
                        setDetailLayout((prev) => ({
                          ...prev,
                          extras: { ...prev.extras, defaultView: modeId },
                        }))
                        return
                      }
                      setActiveView(modeId)
                    }}
                    className="flex items-center gap-2 whitespace-nowrap"
                  >
                    <Icon className="w-4 h-4" />
                    {DETAIL_VIEW_META[modeId].label}
                    {isCustomizeMode &&
                    detailLayout.extras.defaultView === modeId ? (
                      <Badge variant="secondary" className="text-[10px] ml-1">
                        Default
                      </Badge>
                    ) : null}
                  </Button>
                  {isCustomizeMode ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 ml-0.5"
                      aria-label={isHidden ? `Show ${DETAIL_VIEW_META[modeId].label}` : `Hide ${DETAIL_VIEW_META[modeId].label}`}
                      onClick={() =>
                        setDetailLayout((prev) => {
                          const next = toggleDetailViewHidden(
                            normalizeProjectsDetailLayout({ extras: prev.extras }),
                            modeId
                          )
                          return { ...prev, extras: next.extras }
                        })
                      }
                    >
                      {isHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </Button>
                  ) : null}
                </div>
              )
            })}
            {canEdit ? (
            <Button type="button" variant="outline" size="sm" className="ml-auto shrink-0" onClick={() => setImportOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Import tasks
            </Button>
            ) : null}
          </div>
        </div>
      </div>

      <ModuleWidgetCanvas
        widgets={detailLayout.widgets}
        catalog={PROJECTS_DETAIL_WIDGET_CATALOG}
        customizeMode={isCustomizeMode}
        onLayoutChange={onLayoutChange}
        onRemoveWidget={removeWidget}
        rowHeight={36}
        renderWidget={(widgetId) => {
          let content: ReactNode = null

          if (widgetId === 'stats') {
            if (activeView === 'files' || activeView === 'share' || activeView === 'reports') {
              content = isCustomizeMode ? (
                <p className="text-sm text-muted-foreground py-2">
                  Stats hide automatically on Files, Share, and Reports views.
                </p>
              ) : null
            } else {
              content = (
                <Card className="overflow-hidden border-border bg-card/50">
                  <div className="stat-bar">
                    <div className="stat-bar-item">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <TrendingUp className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="stat-bar-label">Progress</p>
                        <p className="text-2xl font-bold tabular-nums">{project.progress}%</p>
                        <Progress value={project.progress} className="mt-2 h-2" />
                      </div>
                    </div>
                    <div className="stat-bar-item">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <AlertCircle className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="stat-bar-label">Tasks</p>
                        <p className="text-2xl font-bold tabular-nums">{project.completedTasks}/{project.totalTasks}</p>
                        <p className="text-xs text-muted-foreground">{project.tasks.filter((t) => t.status !== "done").length} remaining</p>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            }
          } else if (widgetId === 'linked_records') {
            content = <PmProjectLinkedRecords projectId={projectId} />
          } else if (widgetId === 'discussion') {
            content = (
              <ModuleDiscussion
                contextType="project"
                contextId={projectId}
                title="Project discussion"
                contextLabel={project.name}
                className="mb-0"
              />
            )
          } else if (widgetId === 'main_view') {
            content = (
              <div className="w-full">
                {activeView === "board" && (
                  <KanbanBoard
                    project={project}
                    readOnly={readOnly}
                    onAddTask={readOnly ? undefined : (defaultStatus) => {
                      console.log("[ProjectDetail] Opening dialog from kanban with status:", defaultStatus)
                      setAddTaskDefaultStatus(defaultStatus || "todo")
                      setAddTaskDialogOpen(true)
                    }}
                    onTaskClick={(task) => {
                      console.log("[ProjectDetail] Task clicked:", task.title)
                      setSelectedTask(getTaskWithCachedSubtasks(task.id, task))
                      setTaskDetailsOpen(true)
                    }}
                  />
                )}
                {activeView === "table" && <TableView project={project} readOnly={readOnly} />}
                {activeView === "plan" && <PlanView project={project} onProjectUpdate={() => loadProject()} readOnly={readOnly} />}
                {activeView === "calendar" && <CalendarView project={project} readOnly={readOnly} />}
                {activeView === "timeline" && (
                  <TimelineView
                    project={project}
                    onTaskClick={(task) => {
                      setSelectedTask(getTaskWithCachedSubtasks(task.id, task))
                      setTaskDetailsOpen(true)
                    }}
                  />
                )}
                {activeView === "sprint" && <SprintView project={project} onProjectUpdate={loadProject} readOnly={readOnly} />}
                {activeView === "team" && <TeamManagement project={project} onProjectUpdate={loadProject} readOnly={readOnly} />}
                {activeView === "files" && <FileManagement project={project} onProjectUpdate={loadProject} readOnly={readOnly} />}
                {activeView === "reports" && <ReportsView project={project} />}
                {activeView === "share" && <ShareView project={project} />}
              </div>
            )
          } else if (widgetId === 'recent_activity') {
            content = (
              <Card className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                  <h2 className="text-xl font-semibold text-foreground">Recent Activity</h2>
                  <Select value={activityFilter} onValueChange={(v) => setActivityFilter(v as PmActivityFeedFilter)}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Filter" />
                    </SelectTrigger>
                    <SelectContent>
                      {activityFilterOptions.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  {(() => {
                    const combined = buildPmActivityFeed(project, activityFilter)

                    const visible = activityExpanded ? combined : combined.slice(0, RECENT_ACTIVITY_INITIAL)
                    const hasMore = combined.length > RECENT_ACTIVITY_INITIAL
                    const emptyLabel =
                      activityFilterOptions.find((o) => o.value === activityFilter)?.label ?? activityFilter

                    if (combined.length === 0) {
                      return (
                        <p className="text-sm text-muted-foreground py-4">
                          No activity matching &quot;{emptyLabel}&quot;.
                        </p>
                      )
                    }

                    const taskRow = (task: Task) => (
                      <div
                        key={task.id}
                        className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/20 transition-colors border border-border/40"
                      >
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                          {task.status === 'done' ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                          ) : task.status === 'in-progress' ? (
                            <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <Circle className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{task.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {task.assignee?.name || 'Unassigned'} · Due {task.deadline}
                            {task.status === 'in-progress' ? ' · In progress' : task.status === 'done' ? ' · Complete' : ''}
                          </p>
                        </div>
                        <Badge variant={task.status === 'done' ? 'secondary' : 'outline'} className="shrink-0 capitalize">
                          {task.status.replace('-', ' ')}
                        </Badge>
                      </div>
                    )

                    const renderFeedItem = (item: PmFeedItem) => {
                      if (item.kind === 'activity') {
                        const Icon = getActivityIcon(item.activity)
                        const category = getPmActivityCategory(item.activity.type)
                        const iconClass =
                          category === 'subtasks'
                            ? 'text-violet-600 dark:text-violet-400'
                            : category === 'team'
                              ? 'text-amber-600 dark:text-amber-400'
                              : item.activity.type === 'task_completed'
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-primary'
                        return (
                          <div
                            key={`act-${item.id}`}
                            className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/20 transition-colors border border-border/40"
                          >
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <Icon className={`w-5 h-5 ${iconClass}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm text-foreground">
                                  <span className="font-semibold">{item.activity.user}</span>{' '}
                                  {item.activity.description}
                                </p>
                              </div>
                              <p className="text-xs text-muted-foreground">{formatActivityTime(item.activity.timestamp)}</p>
                            </div>
                            <Badge variant="outline" className="shrink-0 text-xs">
                              {getActivityCategoryLabel(item.activity)}
                            </Badge>
                          </div>
                        )
                      }

                      if (item.kind === 'task') {
                        return <div key={`task-${item.id}`}>{taskRow(item.task)}</div>
                      }

                      if (item.kind === 'subtask') {
                        const completionMeta = formatSubtaskCompletionMeta(item.subtask)
                        return (
                          <div
                            key={`subtask-${item.id}`}
                            className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/20 transition-colors border border-border/40"
                          >
                            <div className="w-10 h-10 rounded-full bg-violet-500/10 flex items-center justify-center shrink-0">
                              <ListChecks className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">{item.subtask.title}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                On {item.task.title}
                                {item.subtask.completed ? ' · Complete' : ' · Open'}
                                {completionMeta ? ` · ${completionMeta}` : ''}
                              </p>
                            </div>
                            <Badge variant={item.subtask.completed ? 'secondary' : 'outline'} className="shrink-0 text-xs">
                              Subtask
                            </Badge>
                          </div>
                        )
                      }

                      return (
                        <div
                          key={`team-${item.id}`}
                          className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/20 transition-colors border border-border/40"
                        >
                          <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                            <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{item.member.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {item.member.role} · {item.member.capacity}% capacity
                            </p>
                          </div>
                          <Badge variant="outline" className="shrink-0 text-xs">
                            Team
                          </Badge>
                        </div>
                      )
                    }

                    return (
                      <>
                        {visible.map((item) => renderFeedItem(item))}
                        {hasMore && (
                          <div className="flex justify-center pt-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setActivityExpanded(!activityExpanded)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              {activityExpanded ? 'Show less' : 'Expand activity'}
                              <ChevronDown className={`h-4 w-4 ml-1.5 transition-transform ${activityExpanded ? 'rotate-180' : ''}`} />
                            </Button>
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>
              </Card>
            )
          }

          return content
        }}
      />
    </MotionPage>

    {canEdit ? (
    <ImportDataDialog
      open={importOpen}
      onOpenChange={setImportOpen}
      projectId={projectId}
      onImported={() => loadProject()}
    />
    ) : null}

    {canEdit ? (
    <AddTaskDialog
      projectId={projectId}
      open={addTaskDialogOpen}
      onOpenChange={setAddTaskDialogOpen}
      defaultStatus={addTaskDefaultStatus}
      onTaskAdded={(task) => {
        setProject((prev) => (prev ? { ...prev, tasks: [...prev.tasks, task] } : null))
      }}
    />
    ) : null}
    
    <TaskDetailsDialog
      projectId={projectId}
      task={selectedTask}
      open={taskDetailsOpen}
      onOpenChange={setTaskDetailsOpen}
      readOnly={readOnly}
      onTaskSaved={(updatedTask: Task) => {
        setProject((prev) =>
          prev
            ? { ...prev, tasks: prev.tasks.map((t) => (t.id === updatedTask.id ? { ...t, ...updatedTask } : t)) }
            : null
        )
        setSelectedTask((prev) => (prev?.id === updatedTask.id ? { ...prev, ...updatedTask } : prev))
      }}
    />

    {/* Project Settings Dialog */}
    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Project Settings</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="settings-name">Project Name</Label>
            <Input
              id="settings-name"
              value={settingsForm.name}
              onChange={(e) => setSettingsForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select
              value={settingsForm.status}
              onValueChange={(v) => setSettingsForm((f) => ({ ...f, status: v as Project['status'] }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="on-hold">On Hold</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Deadline</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start gap-2 font-normal">
                  <CalendarIcon className="h-4 w-4" />
                  {settingsForm.deadline ? formatDateOnly(settingsForm.deadline) : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={settingsForm.deadline ? parseDateOnly(settingsForm.deadline) ?? undefined : undefined}
                  onSelect={(date) => {
                    setSettingsForm((f) => ({ ...f, deadline: date ? toDateKey(date) : '' }))
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid gap-2">
            <Label>Owner</Label>
            <Select
              value={project?.owner?.name || '__unassigned__'}
              onValueChange={async (value) => {
                if (value === '__unassigned__') {
                  const ok = await updateProject(projectId, { owner: { name: '', avatar: '' } })
                  if (ok) { loadProject(); toast.success('Project unassigned') }
                  else toast.error('Failed to update')
                  return
                }
                const hrMatch = hrEmployees.find((e) => e.name === value)
                if (hrMatch) {
                  const ok = await updateProject(projectId, {
                    owner: {
                      name: hrMatch.name,
                      avatar: hrMatch.photo_url || '/placeholder.svg?height=32&width=32',
                      hrEmployeeId: hrMatch.id,
                    },
                  })
                  if (ok) { loadProject(); toast.success(`Assigned to ${hrMatch.name}`) }
                  else toast.error('Failed to update')
                  return
                }
                const member = project?.team.find((m) => m.name === value)
                if (member) {
                  const ok = await updateProject(projectId, { owner: { name: member.name, avatar: member.avatar } })
                  if (ok) { loadProject(); toast.success(`Assigned to ${member.name}`) }
                  else toast.error('Failed to update')
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select owner..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unassigned__">Unassigned</SelectItem>
                {(() => {
                  const seen = new Set<string>()
                  const items: { id: string; name: string; subtitle?: string }[] = []
                  for (const e of hrEmployees) {
                    if (seen.has(e.name)) continue
                    seen.add(e.name)
                    items.push({ id: `hr-${e.id}`, name: e.name, subtitle: e.department })
                  }
                  for (const m of project?.team ?? []) {
                    if (seen.has(m.name)) continue
                    seen.add(m.name)
                    items.push({ id: `tm-${m.id}`, name: m.name })
                  }
                  return items.map((it) => (
                    <SelectItem key={it.id} value={it.name}>
                      {it.subtitle ? `${it.name} — ${it.subtitle}` : it.name}
                    </SelectItem>
                  ))
                })()}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="settings-desc">Description</Label>
            <Textarea
              id="settings-desc"
              value={settingsForm.description}
              onChange={(e) => setSettingsForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Add a project description..."
              className="min-h-[100px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setSettingsOpen(false)}>Cancel</Button>
          <Button onClick={saveSettings}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
  )
}
