import { Link } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { CheckCircle2, GanttChart, Trash2 } from 'lucide-react'
import type { Project } from '@/lib/project-data'
import { canEditProject, getPmScopeLabel, type PmUserContext, type PmProjectScope } from '@/lib/pm-access'
import { formatDateOnly } from '@/lib/due-date-utils'

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

export type PortfolioTab = 'grid' | 'list' | 'timeline'

export interface ProjectsPortfolioViewsProps {
  portfolioTab: PortfolioTab
  onTabChange: (tab: PortfolioTab) => void
  visiblePortfolioTabs: PortfolioTab[]
  projectScope: PmProjectScope
  visibleProjects: Project[]
  ongoingProjects: Project[]
  completedProjects: Project[]
  pmUserContext: PmUserContext
  selectedProjects: string[]
  canBulkDeleteProjects: boolean
  toggleProjectSelection: (projectId: string) => void
  toggleSelectAll: () => void
  deleteSelectedProjects: () => void
}

export function ProjectsPortfolioViews({
  portfolioTab,
  onTabChange,
  visiblePortfolioTabs,
  projectScope,
  visibleProjects,
  ongoingProjects,
  completedProjects,
  pmUserContext,
  selectedProjects,
  canBulkDeleteProjects,
  toggleProjectSelection,
  toggleSelectAll,
  deleteSelectedProjects,
}: ProjectsPortfolioViewsProps) {
  return (
    <Tabs
      value={portfolioTab}
      onValueChange={(v) => {
        if (v === 'grid' || v === 'list' || v === 'timeline') onTabChange(v)
      }}
      className="min-w-0 space-y-4 h-full"
    >
      <TabsList data-tour="projects-tabs">
        {visiblePortfolioTabs.includes('grid') ? (
          <TabsTrigger value="grid" data-tour="projects-board">
            Grid View
          </TabsTrigger>
        ) : null}
        {visiblePortfolioTabs.includes('list') ? (
          <TabsTrigger value="list" data-tour="projects-list-tab">List View</TabsTrigger>
        ) : null}
        {visiblePortfolioTabs.includes('timeline') ? (
          <TabsTrigger value="timeline" data-tour="projects-timeline-tab">Timeline</TabsTrigger>
        ) : null}
      </TabsList>
      <TabsContent value="grid" className="space-y-6" data-tour="projects-grid">
        {visibleProjects.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              {projectScope === 'mine'
                ? 'No projects matched to you yet. Switch to Organization to browse all projects.'
                : 'No projects found.'}
            </CardContent>
          </Card>
        ) : (
          <>
            {ongoingProjects.length > 0 ? (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Active & Planned</h3>
                  <Badge variant="outline" className="text-xs">{ongoingProjects.length}</Badge>
                </div>
                <div className="grid min-w-0 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {ongoingProjects.map((project) => {
                    const readOnly = !canEditProject(project, pmUserContext)
                    return (
                      <Link key={project.id} to={`/projects/${project.id}`}>
                        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                          <CardHeader>
                            <div className="flex items-center justify-between gap-2">
                              <CardTitle className="text-lg">{project.name}</CardTitle>
                              <div className="flex items-center gap-2">
                                {readOnly ? (
                                  <Badge variant="outline" className="text-xs">View only</Badge>
                                ) : null}
                                <Badge
                                  variant={projectStatusBadgeVariant(project.status)}
                                  className={projectStatusBadgeClass(project.status)}
                                >
                                  {formatProjectStatus(project.status)}
                                </Badge>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Progress</span>
                                <span className="font-medium">{project.progress}%</span>
                              </div>
                              <div className="w-full bg-secondary rounded-full h-2">
                                <div
                                  className="bg-primary h-2 rounded-full transition-all"
                                  style={{ width: `${project.progress}%` }}
                                />
                              </div>
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>{project.completedTasks}/{project.totalTasks} tasks</span>
                                <span>{project.team.length} members</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    )
                  })}
                </div>
              </section>
            ) : null}

            {completedProjects.length > 0 ? (
              <section className="space-y-3">
                <div className="flex items-center gap-2 pt-2 border-t border-border">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <h3 className="text-sm font-semibold text-foreground">Completed</h3>
                  <Badge variant="outline" className="text-xs bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30">
                    {completedProjects.length}
                  </Badge>
                </div>
                <div className="grid min-w-0 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {completedProjects.map((project) => {
                    const readOnly = !canEditProject(project, pmUserContext)
                    return (
                      <Link key={project.id} to={`/projects/${project.id}`}>
                        <Card className="hover:shadow-lg transition-shadow cursor-pointer border-green-500/20 bg-green-500/[0.03]">
                          <CardHeader>
                            <div className="flex items-center justify-between gap-2">
                              <CardTitle className="text-lg">{project.name}</CardTitle>
                              <div className="flex items-center gap-2">
                                {readOnly ? (
                                  <Badge variant="outline" className="text-xs">View only</Badge>
                                ) : null}
                                <Badge
                                  variant={projectStatusBadgeVariant(project.status)}
                                  className={projectStatusBadgeClass(project.status)}
                                >
                                  {formatProjectStatus(project.status)}
                                </Badge>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Progress</span>
                                <span className="font-medium text-green-600 dark:text-green-400">{project.progress}%</span>
                              </div>
                              <div className="w-full bg-secondary rounded-full h-2">
                                <div
                                  className="bg-green-500 h-2 rounded-full transition-all"
                                  style={{ width: `${project.progress}%` }}
                                />
                              </div>
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>{project.completedTasks}/{project.totalTasks} tasks</span>
                                <span>{project.team.length} members</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    )
                  })}
                </div>
              </section>
            ) : null}
          </>
        )}
      </TabsContent>
      <TabsContent value="list" className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <CardTitle>{getPmScopeLabel(projectScope)}</CardTitle>
                {selectedProjects.length > 0 && (
                  <Badge variant="secondary">
                    {selectedProjects.length} selected
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {canBulkDeleteProjects && selectedProjects.length > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={deleteSelectedProjects}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete {selectedProjects.length === 1 ? 'Project' : `${selectedProjects.length} Projects`}
                  </Button>
                )}
                {canBulkDeleteProjects ? (
                <div className="flex items-center gap-2 border rounded-md px-3 py-2">
                  <Checkbox
                    checked={selectedProjects.length === visibleProjects.length && visibleProjects.length > 0}
                    onCheckedChange={toggleSelectAll}
                    id="select-all"
                  />
                  <label htmlFor="select-all" className="text-sm cursor-pointer">
                    Select All
                  </label>
                </div>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {visibleProjects.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  {projectScope === 'mine'
                    ? 'No projects matched to you yet. Switch to Organization to browse all projects.'
                    : 'No projects found.'}
                </p>
              ) : null}

              {ongoingProjects.length > 0 ? (
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">Active & Planned</h3>
                    <Badge variant="outline" className="text-xs">{ongoingProjects.length}</Badge>
                  </div>
                  <div className="space-y-3">
                    {ongoingProjects.map((project) => {
                      const readOnly = !canEditProject(project, pmUserContext)
                      return (
                        <div
                          key={project.id}
                          className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent transition-colors"
                        >
                          {canBulkDeleteProjects ? (
                            <Checkbox
                              checked={selectedProjects.includes(project.id)}
                              onCheckedChange={() => toggleProjectSelection(project.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : null}
                          <Link to={`/projects/${project.id}`} className="flex-1 flex items-center justify-between cursor-pointer">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <h3 className="font-semibold">{project.name}</h3>
                                {readOnly ? (
                                  <Badge variant="outline" className="text-xs">View only</Badge>
                                ) : null}
                                <Badge
                                  variant={projectStatusBadgeVariant(project.status)}
                                  className={`text-xs ${projectStatusBadgeClass(project.status)}`}
                                >
                                  {formatProjectStatus(project.status)}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                <span>Due {project.deadline}</span>
                                <span>{project.completedTasks}/{project.totalTasks} tasks</span>
                                <span>{project.team.length} members</span>
                                {project.owner?.name && (
                                  <span>Assigned to <span className="font-medium text-foreground">{project.owner.name}</span></span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <div className="text-2xl font-bold">{project.progress}%</div>
                                <div className="text-xs text-muted-foreground">Complete</div>
                              </div>
                            </div>
                          </Link>
                        </div>
                      )
                    })}
                  </div>
                </section>
              ) : null}

              {completedProjects.length > 0 ? (
                <section className="space-y-3">
                  <div className="flex items-center gap-2 pt-4 border-t border-border">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <h3 className="text-sm font-semibold text-foreground">Completed</h3>
                    <Badge variant="outline" className="text-xs bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30">
                      {completedProjects.length}
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {completedProjects.map((project) => {
                      const readOnly = !canEditProject(project, pmUserContext)
                      return (
                        <div
                          key={project.id}
                          className="flex items-center gap-4 p-4 border border-green-500/20 rounded-lg bg-green-500/[0.03] hover:bg-green-500/[0.06] transition-colors"
                        >
                          {canBulkDeleteProjects ? (
                            <Checkbox
                              checked={selectedProjects.includes(project.id)}
                              onCheckedChange={() => toggleProjectSelection(project.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : null}
                          <Link to={`/projects/${project.id}`} className="flex-1 flex items-center justify-between cursor-pointer">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <h3 className="font-semibold">{project.name}</h3>
                                {readOnly ? (
                                  <Badge variant="outline" className="text-xs">View only</Badge>
                                ) : null}
                                <Badge
                                  variant={projectStatusBadgeVariant(project.status)}
                                  className={`text-xs ${projectStatusBadgeClass(project.status)}`}
                                >
                                  {formatProjectStatus(project.status)}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                <span>Due {project.deadline}</span>
                                <span>{project.completedTasks}/{project.totalTasks} tasks</span>
                                <span>{project.team.length} members</span>
                                {project.owner?.name && (
                                  <span>Assigned to <span className="font-medium text-foreground">{project.owner.name}</span></span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{project.progress}%</div>
                                <div className="text-xs text-muted-foreground">Complete</div>
                              </div>
                            </div>
                          </Link>
                        </div>
                      )
                    })}
                  </div>
                </section>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="timeline" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GanttChart className="h-5 w-5" />
              Project Timeline
            </CardTitle>
            <p className="text-sm text-muted-foreground">Overview of all projects and their deadlines</p>
          </CardHeader>
          <CardContent className="space-y-8">
            {(() => {
              const today = new Date()
              const sortByDeadline = (a: Project, b: Project) =>
                new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
              const ongoingWithDates = ongoingProjects.filter((p) => p.deadline).sort(sortByDeadline)
              const completedWithDates = completedProjects.filter((p) => p.deadline).sort(sortByDeadline)

              type TimelineEntry =
                | { kind: 'header'; label: string; completed?: boolean }
                | { kind: 'project'; project: Project }

              const entries: TimelineEntry[] = []
              if (ongoingWithDates.length > 0) {
                entries.push({ kind: 'header', label: 'Active & Planned' })
                ongoingWithDates.forEach((p) => entries.push({ kind: 'project', project: p }))
              }
              if (completedWithDates.length > 0) {
                entries.push({ kind: 'header', label: 'Completed', completed: true })
                completedWithDates.forEach((p) => entries.push({ kind: 'project', project: p }))
              }

              const projectsWithDates = [...ongoingWithDates, ...completedWithDates]
              if (projectsWithDates.length === 0) {
                return <p className="text-center text-muted-foreground py-8">No projects with deadlines to display.</p>
              }

              const allDates: number[] = [today.getTime()]
              projectsWithDates.forEach((p) => {
                allDates.push(new Date(p.deadline).getTime())
                if (p.createdAt) allDates.push(new Date(p.createdAt).getTime())
              })
              const earliest = new Date(Math.min(...allDates))
              const latest = new Date(Math.max(...allDates))
              const rangeStart = new Date(earliest.getFullYear(), earliest.getMonth(), 1)
              const rangeEnd = new Date(latest.getFullYear(), latest.getMonth() + 1, 0)
              const range = rangeEnd.getTime() - rangeStart.getTime()
              const pct = (t: number) => Math.max(0, Math.min(100, ((t - rangeStart.getTime()) / range) * 100))

              const weeks: { label: string; offset: number }[] = []
              const wk = new Date(rangeStart)
              wk.setDate(wk.getDate() - wk.getDay())
              while (wk <= rangeEnd) {
                const off = pct(wk.getTime())
                if (off > 0 && off < 100) weeks.push({ label: `${wk.getMonth() + 1}/${wk.getDate()}`, offset: off })
                wk.setDate(wk.getDate() + 7)
              }

              const months: { label: string; offset: number }[] = []
              const mc = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1)
              while (mc <= rangeEnd) {
                months.push({ label: mc.toLocaleString('en-US', { month: 'long', year: 'numeric' }), offset: pct(mc.getTime()) })
                mc.setMonth(mc.getMonth() + 1)
              }

              const rowH = 36
              const headerH = 32
              const gap = 4

              let projectRowIndex = 0
              const entryLayouts = entries.map((entry) => {
                if (entry.kind === 'header') {
                  return { entry, top: 0, height: headerH, projectRowIndex: -1 }
                }
                const layout = { entry, top: 0, height: rowH, projectRowIndex }
                projectRowIndex += 1
                return layout
              })

              let y = 0
              entryLayouts.forEach((layout) => {
                layout.top = y
                y += layout.height + gap
              })
              const chartH = Math.max(0, y - gap)

              return (
                <div>
                  <div className="flex border-b border-border">
                    <div className="w-[180px] shrink-0 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Project</div>
                    <div className="flex-1 relative py-2 pb-5 overflow-visible">
                      {months.map((m, i) => (
                        <span key={i} className="absolute text-xs font-semibold text-muted-foreground" style={{ left: `${m.offset}%`, top: '0.5rem' }}>{m.label}</span>
                      ))}
                      <span className="absolute left-1/2 -translate-x-1/2 text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded whitespace-nowrap z-30" style={{ left: `${pct(today.getTime())}%`, bottom: '0.25rem' }}>Today</span>
                    </div>
                    <div className="w-[88px] shrink-0 px-2 py-2 text-xs font-semibold text-muted-foreground text-right uppercase tracking-wider">Due</div>
                  </div>

                  <div className="flex">
                    <div className="w-[180px] shrink-0 relative" style={{ height: chartH }}>
                      {entryLayouts.map((layout, idx) => {
                        if (layout.entry.kind === 'header') {
                          return (
                            <div
                              key={`header-${layout.entry.label}`}
                              className={`flex items-center gap-2 px-3 text-xs font-semibold uppercase tracking-wide ${
                                layout.entry.completed
                                  ? 'text-green-700 dark:text-green-400'
                                  : 'text-muted-foreground'
                              } ${idx > 0 ? 'border-t border-border/60' : ''}`}
                              style={{ position: 'absolute', top: layout.top, height: layout.height, left: 0, right: 0 }}
                            >
                              {layout.entry.completed ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                              {layout.entry.label}
                            </div>
                          )
                        }
                        const project = layout.entry.project
                        return (
                          <Link key={project.id} to={`/projects/${project.id}`} className="block absolute left-0 right-0" style={{ top: layout.top, height: layout.height }}>
                            <div
                              className={`flex items-center h-full px-3 text-sm font-medium truncate hover:text-primary transition-colors ${
                                project.status === 'completed' ? 'text-green-700 dark:text-green-400' : ''
                              }`}
                              title={project.name}
                            >
                              {project.name}
                            </div>
                          </Link>
                        )
                      })}
                    </div>

                    <div className="flex-1 relative" style={{ height: chartH }}>
                      {weeks.map((w, i) => (
                        <div key={i} className="absolute top-0 bottom-0 border-l border-border/15" style={{ left: `${w.offset}%` }} />
                      ))}
                      {months.map((m, i) => i > 0 && (
                        <div key={i} className="absolute top-0 bottom-0 border-l border-border/40" style={{ left: `${m.offset}%` }} />
                      ))}
                      <div className="absolute top-0 bottom-0 z-10 pointer-events-none" style={{ left: `${pct(today.getTime())}%` }}>
                        <div className="absolute inset-y-0 -ml-px w-0.5 bg-primary" />
                      </div>

                      {entryLayouts.map((layout) => {
                        if (layout.entry.kind !== 'project') return null
                        const project = layout.entry.project
                        const deadlineTime = new Date(project.deadline).getTime()
                        const projStartTime = project.createdAt
                          ? new Date(project.createdAt).getTime()
                          : deadlineTime - 30 * 86400000
                        const left = pct(projStartTime)
                        const right = pct(deadlineTime)
                        const width = Math.max(4, right - left)
                        const progress = project.totalTasks > 0
                          ? Math.round((project.completedTasks / project.totalTasks) * 100)
                          : project.progress
                        const isPast = deadlineTime < today.getTime()
                        const top = layout.top + (layout.height - 24) / 2

                        const tasks = project.tasks || []
                        const doneTasks = tasks.filter((t) => t.status === 'done').length
                        const inProgressTasks = tasks.filter((t) => t.status === 'in-progress').length
                        const reviewTasks = tasks.filter((t) => t.status === 'review').length
                        const todoTasks = tasks.filter((t) => t.status === 'todo' || t.status === 'backlog').length
                        const daysLeft = Math.ceil((deadlineTime - today.getTime()) / 86400000)

                        return (
                          <Link key={project.id} to={`/projects/${project.id}`} className="group/bar">
                            <div
                              className="absolute h-6 rounded-md overflow-visible cursor-pointer transition-all group-hover/bar:shadow-lg group-hover/bar:brightness-110 z-20"
                              style={{ left: `${left}%`, width: `${width}%`, top, minWidth: 48 }}
                            >
                              <div className="absolute inset-0 rounded-md overflow-hidden">
                                <div className={`absolute inset-0 ${
                                  project.status === 'completed' ? 'bg-green-600/70' : isPast ? 'bg-red-500/70' : 'bg-blue-600/50'
                                }`} />
                                <div className={`absolute inset-y-0 left-0 ${
                                  project.status === 'completed' ? 'bg-green-500' : isPast ? 'bg-red-400' : 'bg-blue-500'
                                }`} style={{ width: `${progress}%` }} />
                                <div className="relative z-10 flex items-center h-full px-2 gap-1.5">
                                  <span className="text-[11px] text-white font-bold drop-shadow">{progress}%</span>
                                  <span className="text-[10px] text-white/70 ml-auto whitespace-nowrap">{project.completedTasks}/{project.totalTasks}</span>
                                </div>
                              </div>
                              <div className="hidden group-hover/bar:block absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 pointer-events-none">
                                <div className="bg-zinc-900 text-white border border-zinc-700 rounded-lg shadow-xl px-4 py-3 w-[260px]">
                                  <p className="text-sm font-semibold truncate mb-1 text-white">{project.name}</p>
                                  <div className="text-xs text-zinc-400 space-y-1">
                                    <div className="flex justify-between">
                                      <span>Status</span>
                                      <span className="font-medium text-zinc-200">{formatProjectStatus(project.status)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Created</span>
                                      <span className="font-medium text-zinc-200">{project.createdAt ? new Date(project.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Deadline</span>
                                      <span className="font-medium text-zinc-200">{formatDateOnly(project.deadline, 'en-US', { month: 'short', day: 'numeric' })}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Time remaining</span>
                                      <span className={`font-medium ${project.status === 'completed' ? 'text-green-400' : isPast ? 'text-red-400' : daysLeft <= 7 ? 'text-yellow-400' : 'text-zinc-200'}`}>
                                        {project.status === 'completed' ? 'Completed' : isPast ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                                      </span>
                                    </div>
                                    <div className="border-t border-zinc-700 pt-1.5 mt-1.5">
                                      <div className="flex justify-between mb-1">
                                        <span>Progress</span>
                                        <span className="font-medium text-zinc-200">{progress}%</span>
                                      </div>
                                      <div className="flex gap-3 text-[11px]">
                                        {doneTasks > 0 && <span className="text-green-400">{doneTasks} done</span>}
                                        {inProgressTasks > 0 && <span className="text-blue-400">{inProgressTasks} active</span>}
                                        {reviewTasks > 0 && <span className="text-purple-400">{reviewTasks} review</span>}
                                        {todoTasks > 0 && <span className="text-zinc-500">{todoTasks} pending</span>}
                                      </div>
                                    </div>
                                    {project.owner && (
                                      <div className="flex justify-between border-t border-zinc-700 pt-1.5 mt-1.5">
                                        <span>Owner</span>
                                        <span className="font-medium text-zinc-200">{project.owner.name}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </Link>
                        )
                      })}
                    </div>

                    <div className="w-[88px] shrink-0 relative" style={{ height: chartH }}>
                      {entryLayouts.map((layout) => {
                        if (layout.entry.kind !== 'project') return null
                        const project = layout.entry.project
                        return (
                          <div
                            key={project.id}
                            className={`absolute left-0 right-0 flex items-center justify-end px-2 text-xs tabular-nums ${
                              project.status === 'completed' ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'
                            }`}
                            style={{ top: layout.top, height: layout.height }}
                          >
                            {formatDateOnly(project.deadline, 'en-US', { month: 'short', day: 'numeric' })}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })()}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
