import { formatDateOnly } from '@/lib/due-date-utils'
import { useState, useEffect, useMemo } from 'react'
import { MotionPage } from '@/components/motion-page'
import { Link } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { LoadingState } from '@/components/ui/loading-state'
import { CheckCircle2, AlertCircle, Plus, Trash2, TrendingUp, Calendar, Users, ArrowLeft, GanttChart, Upload, Eye, EyeOff } from 'lucide-react'
import * as ProjectData from '@/lib/project-data-supabase'
import { getTaskWithCachedSubtasks } from '@/lib/project-data-supabase'
import type { Task, Project } from '@/lib/project-data'
import { canMarkTaskDone } from '@/lib/project-data'
import { AddProjectDialog } from '@/components/projects/add-project-dialog'
import { ImportProjectDialog } from '@/components/projects/import-project-dialog'
import { RecentActivityWidget } from '@/components/projects/widgets'
import { ProjectsPortfolioViews } from '@/components/projects/ProjectsPortfolioViews'
import { useAuth } from '@/contexts/AuthContext'
import { useLoggedInHrEmployee } from '@/hooks/use-logged-in-hr-employee'
import {
  canEditProject,
  filterProjectsByScope,
  getPmScopeLabel,
  loadPmProjectScope,
  savePmProjectScope,
  type PmProjectScope,
} from '@/lib/pm-access'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Building2, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { ModuleHelpButton } from '@/components/tour/module-help-button'
import { useModuleTour } from '@/components/tour/use-module-tour'
import { ModuleCustomizeControls, ModuleCustomizeHint } from '@/components/module-layout/ModuleCustomizeBar'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import { WidgetCatalogDialog } from '@/components/module-layout/WidgetCatalogDialog'
import { useModuleWidgetLayout } from '@/hooks/useModuleWidgetLayout'
import {
  DEFAULT_PORTFOLIO_TAB_ORDER,
  PORTFOLIO_TAB_META,
  normalizeProjectsPortfolioLayout,
  togglePortfolioTabHidden,
  type PortfolioTabId,
} from '@/lib/projects/projects-layout'
import {
  PROJECTS_MODULE_ID,
  PROJECTS_PORTFOLIO_SURFACE,
  PROJECTS_PORTFOLIO_WIDGET_CATALOG,
  normalizeProjectsPortfolioWidgetLayout,
  portfolioWidgetLayoutToBase,
} from '@/lib/projects/projects-widget-layout'

interface WorkItem {
  id: string
  title: string
  time: string
  status: Task['status']
  priority: 'high' | 'medium' | 'low'
  projectId: string
  projectName: string
  taskId: string
  completed: boolean
}

// Generate work items from projects - sort by most recent activity
function generateWorkItemsFromProjects(projectsList: Project[]): WorkItem[] {
  const workItems: WorkItem[] = []
  
  projectsList.forEach(project => {
    project.tasks.forEach(task => {
      // Get relative time from task deadline or status
      let timeDisplay = 'No deadline'
      if (task.deadline) {
        const deadlineDate = new Date(task.deadline)
        const today = new Date()
        const diffTime = deadlineDate.getTime() - today.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        
        if (diffDays < 0) {
          timeDisplay = `${Math.abs(diffDays)} days ago`
        } else if (diffDays === 0) {
          timeDisplay = 'Today'
        } else if (diffDays === 1) {
          timeDisplay = 'Tomorrow'
        } else if (diffDays <= 7) {
          timeDisplay = `In ${diffDays} days`
        } else {
          timeDisplay = task.deadline
        }
      }
      
      workItems.push({
        id: `${project.id}-${task.id}`,
        title: task.title,
        time: timeDisplay,
        status: task.status,
        priority: task.priority,
        projectId: project.id,
        projectName: project.name,
        taskId: task.id,
        completed: task.status === 'done'
      })
    })
  })
  
  return workItems
}

function formatProjectStatus(status: Project['status']): string {
  if (status === 'on-hold') return 'On Hold'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function projectStatusBadgeVariant(status: Project['status']): 'default' | 'secondary' | 'outline' {
  if (status === 'active') return 'default'
  if (status === 'completed') return 'secondary'
  return 'outline'
}

function projectStatusBadgeClass(status: Project['status']): string {
  if (status === 'completed') return 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30'
  if (status === 'on-hold') return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
  return ''
}

function partitionProjectsByStatus(projects: Project[]) {
  const ongoing = projects.filter((p) => p.status !== 'completed')
  const completed = projects.filter((p) => p.status === 'completed')
  return { ongoing, completed }
}

export default function ProjectsPage() {
  useModuleTour('projects')
  const { user, profile } = useAuth()
  const { loggedInEmployeeId, loginNames, loginEmails } = useLoggedInHrEmployee()
  const [projects, setProjects] = useState<Project[]>([])
  const [projectScope, setProjectScope] = useState<PmProjectScope>(() => loadPmProjectScope())
  const [workItems, setWorkItems] = useState<WorkItem[]>([])
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addProjectDialogOpen, setAddProjectDialogOpen] = useState(false)
  const [importProjectOpen, setImportProjectOpen] = useState(false)
  const [portfolioTab, setPortfolioTab] = useState<PortfolioTabId>('grid')

  const {
    layout: portfolioLayout,
    setLayout: setPortfolioLayout,
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
    surfaceId: PROJECTS_PORTFOLIO_SURFACE,
    catalog: PROJECTS_PORTFOLIO_WIDGET_CATALOG,
    normalize: normalizeProjectsPortfolioWidgetLayout,
    toBase: portfolioWidgetLayoutToBase,
    successMessage: 'Projects layout saved',
  })

  useEffect(() => {
    const preferred = portfolioLayout.extras.defaultPortfolioTab
    const hidden = new Set(portfolioLayout.extras.hiddenPortfolioTabs)
    if (!hidden.has(preferred)) {
      setPortfolioTab(preferred)
      return
    }
    const fallback =
      DEFAULT_PORTFOLIO_TAB_ORDER.find((id) => !hidden.has(id)) ?? 'grid'
    setPortfolioTab(fallback)
  }, [portfolioLayout.extras.defaultPortfolioTab, portfolioLayout.extras.hiddenPortfolioTabs])

  const visiblePortfolioTabs = useMemo(() => {
    const hidden = new Set(portfolioLayout.extras.hiddenPortfolioTabs)
    return DEFAULT_PORTFOLIO_TAB_ORDER.filter(
      (id) => isCustomizeMode || !hidden.has(id)
    )
  }, [portfolioLayout.extras.hiddenPortfolioTabs, isCustomizeMode])

  const pmUserContext = useMemo(
    () => ({
      employeeId: loggedInEmployeeId,
      loginNames,
      loginEmails,
      orgRole: profile?.role,
    }),
    [loggedInEmployeeId, loginNames, loginEmails, profile?.role]
  )

  const visibleProjects = useMemo(
    () => filterProjectsByScope(projects, projectScope, pmUserContext),
    [projects, projectScope, pmUserContext]
  )

  const portfolioWorkItems = useMemo(
    () => workItems.filter((item) => visibleProjects.some((p) => p.id === item.projectId)),
    [workItems, visibleProjects]
  )

  const { ongoing: ongoingProjects, completed: completedProjects } = useMemo(
    () => partitionProjectsByStatus(visibleProjects),
    [visibleProjects]
  )

  const canManageProjects = profile?.role !== 'viewer'
  const canBulkDeleteProjects = profile?.role === 'owner' || profile?.role === 'admin'

  const handleScopeChange = (scope: PmProjectScope) => {
    setProjectScope(scope)
    savePmProjectScope(scope)
    setSelectedProjects([])
  }

  // Load projects from Supabase
  const loadProjects = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await ProjectData.getAllProjects()
      setProjects(data)
      setWorkItems(generateWorkItemsFromProjects(data))
    } catch (err) {
      console.error('Error loading projects:', err)
      setError('Failed to load projects')
      toast.error('Failed to load projects')
    } finally {
      setLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    loadProjects()
  }, [])

  // Listen for project data updates
  useEffect(() => {
    const handleProjectUpdate = () => {
      loadProjects()
    }

    window.addEventListener('projectDataUpdated', handleProjectUpdate)
    return () => window.removeEventListener('projectDataUpdated', handleProjectUpdate)
  }, [])

  const refreshProjects = () => {
    loadProjects()
  }

  const toggleProjectSelection = (projectId: string) => {
    setSelectedProjects(prev =>
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    )
  }

  const toggleSelectAll = () => {
    setSelectedProjects(prev =>
      prev.length === visibleProjects.length
        ? []
        : visibleProjects.map(p => p.id)
    )
  }

  const deleteSelectedProjects = async () => {
    const count = selectedProjects.length
    if (window.confirm(`Are you sure you want to delete ${count} project(s)?`)) {
      try {
        for (const projectId of selectedProjects) {
          await ProjectData.deleteProject(projectId)
        }

        setSelectedProjects([])
        await loadProjects()
        toast.success(count === 1 ? 'Project deleted' : `${count} projects deleted`)
      } catch (err) {
        console.error('Error deleting projects:', err)
        setError('Failed to delete projects')
        toast.error('Failed to delete projects')
      }
    }
  }

  const metrics = useMemo(() => {
    // Calculate upcoming deadlines (next 7 days)
    const today = new Date()
    const nextWeek = new Date(today)
    nextWeek.setDate(today.getDate() + 7)
    
    const upcomingDeadlines = ongoingProjects.reduce((count, project) => {
      const projectDeadline = project.deadline ? new Date(project.deadline) : null
      if (projectDeadline && projectDeadline >= today && projectDeadline <= nextWeek) {
        count++
      }
      return count
    }, 0)
    
    return {
      totalProjects: visibleProjects.length,
      activeProjects: ongoingProjects.filter(p => p.status === 'active').length,
      completedProjects: completedProjects.length,
      completedTasks: visibleProjects.reduce((acc, p) => acc + p.completedTasks, 0),
      totalTasks: visibleProjects.reduce((acc, p) => acc + p.totalTasks, 0),
      teamMembers: new Set(visibleProjects.flatMap(p => p.team.map(t => t.id))).size,
      upcomingDeadlines,
    }
  }, [visibleProjects, ongoingProjects, completedProjects])

  const toggleItemComplete = async (projectId: string, taskId: string) => {
    const project = projects.find(p => p.id === projectId)
    if (!project) return
    
    const task = project.tasks.find(t => t.id === taskId)
    if (!task) return
    
    const newStatus: Task['status'] = task.status === 'done' ? 'todo' : 'done'
    const taskWithCache = getTaskWithCachedSubtasks(taskId, task)
    if (newStatus === 'done' && !canMarkTaskDone(taskWithCache)) {
      toast.error('Complete all subtasks before marking this task as done.')
      return
    }
    try {
      await ProjectData.updateTaskStatus(projectId, taskId, newStatus, taskWithCache)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update task')
    }
  }

  const handleAddProject = async (projectData: {
    name: string
    status: "active" | "completed" | "on-hold"
    deadline: string
    owner?: { name: string; avatar: string; hrEmployeeId?: string | null }
  }) => {
    try {
      if (!ProjectData.isUsingSupabase()) {
        toast.error('Failed to create project', {
          description: 'Database is not configured.',
        })
        return
      }

      const createdBy = profile?.full_name || user?.email
        ? {
            name: profile?.full_name || user?.email || 'Me',
            avatar: profile?.avatar_url || '',
            hrEmployeeId: loggedInEmployeeId,
          }
        : undefined
      const owner =
        projectData.owner ??
        (createdBy ? { ...createdBy } : undefined)
      await ProjectData.createProject({
        ...projectData,
        createdBy,
        owner,
      })
      await loadProjects()
      toast.success('Project created', { description: `"${projectData.name}" was added.` })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[ProjectsPage] Error adding project:', err)
      toast.error('Failed to create project', { description: message })
    }
  }

  if (loading) {
    return (
      <MotionPage className="min-w-0 flex-1 space-y-4 p-4 pt-6 md:p-6 my-16">
        <div
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          data-tour="projects-header"
        >
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Link to="/hub" className="hover:text-foreground transition-colors flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" />
                Hub
              </Link>
              <span>/</span>
              <span className="text-foreground">Katana PM</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight">Katana PM</h2>
            <p className="text-sm text-muted-foreground">Loading projects…</p>
          </div>
          <ModuleHelpButton moduleId="projects" />
        </div>
        <LoadingState fullPage={false} message="Loading projects…" />
      </MotionPage>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 my-16">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-4" />
          <p className="text-destructive font-semibold">{error}</p>
          <Button onClick={loadProjects} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <MotionPage className="min-w-0 flex-1 space-y-4 p-4 pt-6 md:p-6 my-16">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" data-tour="projects-header">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link to="/hub" className="hover:text-foreground transition-colors flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" />
              Hub
            </Link>
            <span>/</span>
            <span className="text-foreground">Katana PM</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Katana PM</h2>
          <p className="text-sm text-muted-foreground">
            {projectScope === 'mine'
              ? 'Projects you are on, assigned to, or own'
              : 'Full organizational project portfolio'}
          </p>
          <div className="mt-3" data-tour="projects-scope">
            <ToggleGroup
              type="single"
              value={projectScope}
              onValueChange={(value) => {
                if (value === 'mine' || value === 'organization') handleScopeChange(value)
              }}
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="mine" aria-label="My projects" className="gap-2 px-3">
                <UserRound className="h-4 w-4" />
                My Projects
              </ToggleGroupItem>
              <ToggleGroupItem value="organization" aria-label="Organization projects" className="gap-2 px-3">
                <Building2 className="h-4 w-4" />
                Organization
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ModuleHelpButton moduleId="projects" />
          <ModuleCustomizeControls
            customizeMode={isCustomizeMode}
            onEnterCustomize={enterCustomize}
            onDone={() => void saveAndExit()}
            dataTourCustomize="projects-customize"
          />
          {canManageProjects ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setImportProjectOpen(true)} data-tour="projects-import">
                <Upload className="h-4 w-4 mr-2" />
                Import project
              </Button>
              <Button size="sm" onClick={() => setAddProjectDialogOpen(true)} data-tour="projects-add">
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {isCustomizeMode ? (
        <div className="space-y-3">
          <ModuleCustomizeHint surfaceLabel="Projects home" />
          <div className="flex flex-wrap items-center gap-2">
            <WidgetCatalogDialog available={availableWidgets} onAdd={addWidget} />
            <Button type="button" variant="ghost" size="sm" onClick={resetToDefault}>
              Reset layout
            </Button>
            {isCustomizeMode ? (
              <div className="flex flex-wrap items-center gap-2 ml-auto">
                <span className="text-xs text-muted-foreground">Default tab:</span>
                <ToggleGroup
                  type="single"
                  size="sm"
                  variant="outline"
                  value={portfolioLayout.extras.defaultPortfolioTab}
                  onValueChange={(value) => {
                    if (value !== 'grid' && value !== 'list' && value !== 'timeline') return
                    if (portfolioLayout.extras.hiddenPortfolioTabs.includes(value)) return
                    setPortfolioLayout((prev) => ({
                      ...prev,
                      extras: { ...prev.extras, defaultPortfolioTab: value },
                    }))
                  }}
                >
                  {DEFAULT_PORTFOLIO_TAB_ORDER.filter(
                    (id) => !portfolioLayout.extras.hiddenPortfolioTabs.includes(id)
                  ).map((tabId) => (
                    <ToggleGroupItem key={tabId} value={tabId} className="px-2 text-xs">
                      {PORTFOLIO_TAB_META[tabId].label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                {DEFAULT_PORTFOLIO_TAB_ORDER.map((tabId) => {
                  const hidden = portfolioLayout.extras.hiddenPortfolioTabs.includes(tabId)
                  return (
                    <Button
                      key={tabId}
                      type="button"
                      size="sm"
                      variant={hidden ? 'ghost' : 'secondary'}
                      className="gap-1.5"
                      onClick={() =>
                        setPortfolioLayout((prev) => {
                          const next = togglePortfolioTabHidden(
                            normalizeProjectsPortfolioLayout({ extras: prev.extras }),
                            tabId
                          )
                          return { ...prev, extras: next.extras }
                        })
                      }
                    >
                      {hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      {PORTFOLIO_TAB_META[tabId].label}
                    </Button>
                  )
                })}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <ModuleWidgetCanvas
        widgets={portfolioLayout.widgets}
        catalog={PROJECTS_PORTFOLIO_WIDGET_CATALOG}
        customizeMode={isCustomizeMode}
        onLayoutChange={onLayoutChange}
        onRemoveWidget={removeWidget}
        rowHeight={36}
        renderWidget={(widgetId) => {
          if (widgetId === 'stats') {
            return (
              <Card className="h-full overflow-hidden border-border bg-card/50" data-tour="projects-stats">
                <div className="stat-bar h-full">
                  <div className="stat-bar-item">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <TrendingUp className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="stat-bar-label">Total Projects</p>
                      <p className="text-2xl font-bold tabular-nums">{metrics.totalProjects}</p>
                      <p className="text-xs text-muted-foreground">{getPmScopeLabel(projectScope)} · {metrics.activeProjects} active{metrics.completedProjects > 0 ? ` · ${metrics.completedProjects} completed` : ''}</p>
                    </div>
                  </div>
                  <div className="stat-bar-item">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="stat-bar-label">Upcoming Deadlines</p>
                      <p className="text-2xl font-bold tabular-nums">{metrics.upcomingDeadlines}</p>
                      <p className="text-xs text-muted-foreground">Next 7 days</p>
                    </div>
                  </div>
                  <div className="stat-bar-item">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Users className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="stat-bar-label">Team Members</p>
                      <p className="text-2xl font-bold tabular-nums">{metrics.teamMembers}</p>
                      <p className="text-xs text-muted-foreground">Across all projects</p>
                    </div>
                  </div>
                </div>
              </Card>
            )
          }

          if (widgetId === 'metric_total_projects') {
            return (
              <Card className="h-full p-4 flex flex-col justify-center">
                <p className="text-xs text-muted-foreground">Total Projects</p>
                <p className="text-3xl font-bold tabular-nums mt-1">{metrics.totalProjects}</p>
              </Card>
            )
          }
          if (widgetId === 'metric_upcoming_deadlines') {
            return (
              <Card className="h-full p-4 flex flex-col justify-center">
                <p className="text-xs text-muted-foreground">Upcoming Deadlines</p>
                <p className="text-3xl font-bold tabular-nums mt-1">{metrics.upcomingDeadlines}</p>
                <p className="text-xs text-muted-foreground mt-1">Next 7 days</p>
              </Card>
            )
          }
          if (widgetId === 'metric_team_members') {
            return (
              <Card className="h-full p-4 flex flex-col justify-center">
                <p className="text-xs text-muted-foreground">Team Members</p>
                <p className="text-3xl font-bold tabular-nums mt-1">{metrics.teamMembers}</p>
              </Card>
            )
          }
          if (widgetId === 'metric_active_projects') {
            return (
              <Card className="h-full p-4 flex flex-col justify-center">
                <p className="text-xs text-muted-foreground">Active Projects</p>
                <p className="text-3xl font-bold tabular-nums mt-1">{metrics.activeProjects}</p>
              </Card>
            )
          }

          if (widgetId === 'portfolio_views') {
            return (
              <div className="h-full overflow-auto p-1">
                <ProjectsPortfolioViews
                  portfolioTab={portfolioTab}
                  onTabChange={setPortfolioTab}
                  visiblePortfolioTabs={visiblePortfolioTabs}
                  projectScope={projectScope}
                  visibleProjects={visibleProjects}
                  ongoingProjects={ongoingProjects}
                  completedProjects={completedProjects}
                  pmUserContext={pmUserContext}
                  selectedProjects={selectedProjects}
                  canBulkDeleteProjects={canBulkDeleteProjects}
                  toggleProjectSelection={toggleProjectSelection}
                  toggleSelectAll={toggleSelectAll}
                  deleteSelectedProjects={() => void deleteSelectedProjects()}
                />
              </div>
            )
          }

          if (widgetId === 'work_items') {
            const openItems = portfolioWorkItems.filter((item) => !item.completed).slice(0, 12)
            return (
              <Card className="h-full overflow-auto" data-tour="projects-work-items">
                <CardHeader>
                  <CardTitle className="text-lg">Work items</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Open tasks across {getPmScopeLabel(projectScope).toLowerCase()}
                  </p>
                </CardHeader>
                <CardContent>
                  {openItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No open work items in this scope.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {openItems.map((item) => {
                        const itemProject = visibleProjects.find((p) => p.id === item.projectId)
                        const canToggle = itemProject
                          ? canEditProject(itemProject, pmUserContext)
                          : false
                        return (
                          <div
                            key={item.id}
                            className="flex items-start gap-3 rounded-lg border border-border/60 p-3"
                          >
                            <Checkbox
                              checked={item.completed}
                              disabled={!canToggle}
                              onCheckedChange={() =>
                                void toggleItemComplete(item.projectId, item.taskId)
                              }
                              className="mt-0.5"
                            />
                            <div className="min-w-0 flex-1">
                              <Link
                                to={`/projects/${item.projectId}`}
                                className="text-sm font-medium text-foreground hover:underline"
                              >
                                {item.title}
                              </Link>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {item.projectName} · {item.time}
                              </p>
                            </div>
                            <Badge variant="outline">{item.priority}</Badge>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'recent_activity') {
            return (
              <div className="h-full overflow-auto">
                <RecentActivityWidget
                  activities={portfolioWorkItems.map((item) => ({
                    id: item.id,
                    title: item.title,
                    projectName: item.projectName,
                    projectId: item.projectId,
                    status: item.status,
                    time: item.time,
                    color:
                      item.priority === 'high'
                        ? 'bg-red-500'
                        : item.priority === 'medium'
                          ? 'bg-yellow-500'
                          : 'bg-green-500',
                  }))}
                  maxVisible={3}
                />
              </div>
            )
          }

          return null
        }}
      />

      <AddProjectDialog
        open={addProjectDialogOpen}
        onOpenChange={setAddProjectDialogOpen}
        onAddProject={handleAddProject}
      />

      <ImportProjectDialog
        open={importProjectOpen}
        onOpenChange={setImportProjectOpen}
        createdBy={
          profile?.full_name || user?.email
            ? { name: profile?.full_name || user?.email || 'Me', avatar: profile?.avatar_url || '' }
            : undefined
        }
        onImported={() => void loadProjects()}
      />
    </MotionPage>
  )
}
