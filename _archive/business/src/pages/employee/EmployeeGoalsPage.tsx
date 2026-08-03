import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Target,
  Plus,
  TrendingUp,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Edit,
  Trash2,
  ChevronRight,
} from "lucide-react"
import { useEmployeePortal } from "@/contexts/EmployeePortalContext"
import { EmployeePortalNoAccess } from "@/components/employee/EmployeePortalNoAccess"
import { EmployeePortalPageContent } from "@/components/employee/EmployeePortalPageContent"
import { LoadingState } from "@/components/ui/loading-state"
import {
  ModuleCustomizeControls,
  ModuleCustomizeHint,
} from '@/components/module-layout/ModuleCustomizeBar'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import { WidgetCatalogDialog } from '@/components/module-layout/WidgetCatalogDialog'
import { useModuleWidgetLayout } from '@/hooks/useModuleWidgetLayout'
import {
  EMPLOYEE_MODULE_ID,
  getEmployeeSurfaceConfig,
} from '@/lib/employee/employee-widget-layout'
import * as hrApi from "@/lib/hr-api"
import type { Goal as HRGoal } from "@/lib/hr-api"

type DisplayStatus = "on-track" | "at-risk" | "behind" | "completed"

type DisplayGoal = {
  id: string
  title: string
  description: string
  category: "individual" | "team" | "company"
  progress: number
  dueDate: string
  status: DisplayStatus
  metrics: { name: string; current: number; target: number; unit: string }[]
  lastUpdated: string
}

function mapStatus(s: HRGoal["status"]): DisplayStatus {
  if (s === "Complete") return "completed"
  if (s === "Behind") return "behind"
  if (s === "On Track") return "on-track"
  return "at-risk"
}

function mapCategory(c: string): "individual" | "team" | "company" {
  const lower = (c || "").toLowerCase()
  if (lower === "team") return "team"
  if (lower === "company") return "company"
  return "individual"
}

function getStatusColor(status: DisplayStatus) {
  switch (status) {
    case "on-track": return "border-green-500 text-green-600 bg-green-500/20"
    case "at-risk": return "border-yellow-500 text-yellow-600 bg-yellow-500/20"
    case "behind": return "border-red-500 text-red-600 bg-red-500/20"
    case "completed": return "border-blue-500 text-blue-600 bg-blue-500/20"
  }
}

function getCategoryColor(category: "individual" | "team" | "company") {
  switch (category) {
    case "individual": return "border-purple-500 text-purple-600 bg-purple-500/10"
    case "team": return "border-blue-500 text-blue-600 bg-blue-500/10"
    case "company": return "border-green-500 text-green-600 bg-green-500/10"
  }
}

function ActiveGoalCard({
  goal,
  onEdit,
  onDelete,
  compact = false,
}: {
  goal: DisplayGoal
  onEdit: (goal: DisplayGoal) => void
  onDelete: (goalId: string) => void
  compact?: boolean
}) {
  if (compact) {
    return (
      <Card className="hover:border-primary/40 transition-all">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <CardTitle>{goal.title}</CardTitle>
                <Badge variant="outline" className={getStatusColor(goal.status)}>
                  {goal.status}
                </Badge>
              </div>
              <CardDescription>{goal.description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-sm font-bold">{goal.progress}%</span>
          </div>
          <Progress value={goal.progress} className="h-2" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="hover:border-primary/40 transition-all">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle>{goal.title}</CardTitle>
              <Badge variant="outline" className={getCategoryColor(goal.category)}>
                {goal.category}
              </Badge>
              <Badge variant="outline" className={getStatusColor(goal.status)}>
                {goal.status}
              </Badge>
            </div>
            <CardDescription>{goal.description}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => onEdit(goal)}>
              <Edit className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(goal.id)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Progress</span>
            <span className="text-sm font-bold">{goal.progress}%</span>
          </div>
          <Progress value={goal.progress} className="h-2" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goal.metrics.map((metric, index) => (
            <div key={index} className="p-3 rounded-lg bg-muted/30">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">{metric.name}</span>
                <span className="text-xs font-medium">
                  {metric.current}/{metric.target} {metric.unit}
                </span>
              </div>
              <Progress value={(metric.current / metric.target) * 100} className="h-1" />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Due {goal.dueDate}
            </span>
            <span>Last updated {goal.lastUpdated}</span>
          </div>
          <Button variant="ghost" size="sm" className="h-7">
            View Details
            <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function EmployeeGoalsPage() {
  const { employee, employeeId, loading: portalLoading, error: portalError } = useEmployeePortal()
  const [goalsRaw, setGoalsRaw] = useState<HRGoal[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editGoal, setEditGoal] = useState<{ id: string; progress: number; status: string } | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [newGoal, setNewGoal] = useState({
    title: "",
    description: "",
    category: "individual" as "individual" | "team" | "company",
    dueDate: "",
  })

  const surfaceConfig = getEmployeeSurfaceConfig('goals')
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
    moduleId: EMPLOYEE_MODULE_ID,
    surfaceId: surfaceConfig.id,
    catalog: surfaceConfig.catalog,
    normalize: surfaceConfig.normalize,
    toBase: surfaceConfig.toBase,
    successMessage: `${surfaceConfig.label} layout saved`,
  })

  useEffect(() => {
    if (!employeeId) return
    hrApi.getGoalsByEmployeeId(employeeId).then(setGoalsRaw)
  }, [employeeId])

  const goals = useMemo(
    () =>
      goalsRaw.map((g) => ({
        id: g.id,
        title: g.goal || "Untitled goal",
        description: g.description || "",
        category: mapCategory(g.category),
        progress: g.progress ?? 0,
        dueDate: g.due_date,
        status: mapStatus(g.status),
        metrics: [{ name: "Progress", current: g.progress ?? 0, target: 100, unit: "%" }],
        lastUpdated: g.updated_at ? new Date(g.updated_at).toLocaleDateString() : "",
      })),
    [goalsRaw]
  )

  const activeGoals = goals.filter((g) => g.status !== "completed")
  const completedGoals = goals.filter((g) => g.status === "completed")

  const goalsByCategory = {
    individual: goals.filter(g => g.category === "individual" && g.status !== "completed"),
    team: goals.filter(g => g.category === "team" && g.status !== "completed"),
    company: goals.filter(g => g.category === "company" && g.status !== "completed"),
  }

  const overallProgress = goals.length > 0 ? Math.round(goals.reduce((acc, goal) => acc + goal.progress, 0) / goals.length) : 0

  const handleAddGoal = async () => {
    if (!employeeId || !newGoal.title || !newGoal.dueDate) return
    const created = await hrApi.createGoal({
      employee_id: employeeId,
      goal: newGoal.title,
      description: newGoal.description || null,
      category: newGoal.category,
      progress: 0,
      status: "On Track",
      due_date: newGoal.dueDate,
      created_date: new Date().toISOString().slice(0, 10),
    })
    if (created) {
      setGoalsRaw((prev) => [created, ...prev])
      setIsDialogOpen(false)
      setNewGoal({ title: "", description: "", category: "individual", dueDate: "" })
    }
  }

  const handleEditGoal = (goal: DisplayGoal) => {
    setEditGoal({ id: goal.id, progress: goal.progress, status: goal.status === "completed" ? "Complete" : goal.status === "behind" ? "Behind" : goal.status === "at-risk" ? "Cancelled" : "On Track" })
    setIsEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editGoal) return
    const updated = await hrApi.updateGoal(editGoal.id, {
      progress: editGoal.progress,
      status: editGoal.status as "On Track" | "Behind" | "Complete" | "Cancelled",
      updated_at: new Date().toISOString(),
    })
    if (updated) {
      setGoalsRaw((prev) => prev.map((g) => (g.id === updated.id ? updated : g)))
    }
    setIsEditDialogOpen(false)
    setEditGoal(null)
  }

  const handleDeleteGoal = async (goalId: string) => {
    if (!window.confirm("Are you sure you want to delete this goal?")) return
    const ok = await hrApi.deleteGoal(goalId)
    if (ok) {
      setGoalsRaw((prev) => prev.filter((g) => g.id !== goalId))
    }
  }

  if (portalLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8">
        <LoadingState message="Loading…" />
      </div>
    )
  }
  if (!employee) {
    return <EmployeePortalNoAccess error={portalError ?? undefined} />
  }

  return (
    <EmployeePortalPageContent>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">My Goals</h1>
          <p className="text-muted-foreground">Track and manage your objectives</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ModuleCustomizeControls
            customizeMode={isCustomizeMode}
            onEnterCustomize={enterCustomize}
            onDone={() => void saveAndExit()}
            dataTourCustomize="launchpad-goals-customize"
          />
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Goal
          </Button>
        </div>
      </div>

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

      <ModuleWidgetCanvas
        widgets={layout.widgets}
        catalog={surfaceConfig.catalog}
        customizeMode={isCustomizeMode}
        onLayoutChange={onLayoutChange}
        onRemoveWidget={removeWidget}
        rowHeight={36}
        renderWidget={(widgetId) => {
          if (widgetId === 'goals_summary') {
            return (
              <div className="h-full overflow-hidden grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Overall Progress</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{overallProgress}%</div>
                    <Progress value={overallProgress} className="mt-2 h-2" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Goals</CardTitle>
                    <Target className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{activeGoals.length}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {completedGoals.length} completed
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">On Track</CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600">
                      {goals.filter(g => g.status === "on-track").length}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Goals progressing well
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">At Risk</CardTitle>
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-yellow-600">
                      {goals.filter(g => g.status === "at-risk").length}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Need attention
                    </p>
                  </CardContent>
                </Card>
              </div>
            )
          }

          if (widgetId === 'active_goals') {
            return (
              <Card className="h-full overflow-hidden flex flex-col">
                <CardHeader className="pb-2 shrink-0">
                  <CardTitle>Active Goals</CardTitle>
                  <CardDescription>Goals in progress</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden flex flex-col min-h-0">
                  <Tabs defaultValue="all" className="flex flex-col h-full min-h-0">
                    <TabsList className="shrink-0 mb-4">
                      <TabsTrigger value="all">All Goals ({activeGoals.length})</TabsTrigger>
                      <TabsTrigger value="individual">Individual ({goalsByCategory.individual.length})</TabsTrigger>
                      <TabsTrigger value="team">Team ({goalsByCategory.team.length})</TabsTrigger>
                      <TabsTrigger value="company">Company ({goalsByCategory.company.length})</TabsTrigger>
                    </TabsList>

                    <TabsContent value="all" className="flex-1 overflow-auto space-y-4 mt-0">
                      {activeGoals.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-8 text-center">
                          No active goals yet. Create a new goal to get started.
                        </p>
                      ) : (
                        activeGoals.map((goal) => (
                          <ActiveGoalCard
                            key={goal.id}
                            goal={goal}
                            onEdit={handleEditGoal}
                            onDelete={handleDeleteGoal}
                          />
                        ))
                      )}
                    </TabsContent>

                    <TabsContent value="individual" className="flex-1 overflow-auto space-y-4 mt-0">
                      {goalsByCategory.individual.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-8 text-center">
                          No individual goals yet.
                        </p>
                      ) : (
                        goalsByCategory.individual.map((goal) => (
                          <ActiveGoalCard
                            key={goal.id}
                            goal={goal}
                            onEdit={handleEditGoal}
                            onDelete={handleDeleteGoal}
                            compact
                          />
                        ))
                      )}
                    </TabsContent>

                    <TabsContent value="team" className="flex-1 overflow-auto space-y-4 mt-0">
                      {goalsByCategory.team.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-8 text-center">
                          No team goals yet.
                        </p>
                      ) : (
                        goalsByCategory.team.map((goal) => (
                          <ActiveGoalCard
                            key={goal.id}
                            goal={goal}
                            onEdit={handleEditGoal}
                            onDelete={handleDeleteGoal}
                            compact
                          />
                        ))
                      )}
                    </TabsContent>

                    <TabsContent value="company" className="flex-1 overflow-auto space-y-4 mt-0">
                      {goalsByCategory.company.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-8 text-center">
                          No company goals yet.
                        </p>
                      ) : (
                        goalsByCategory.company.map((goal) => (
                          <ActiveGoalCard
                            key={goal.id}
                            goal={goal}
                            onEdit={handleEditGoal}
                            onDelete={handleDeleteGoal}
                            compact
                          />
                        ))
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'completed_goals') {
            return (
              <Card className="h-full overflow-hidden flex flex-col">
                <CardHeader className="pb-2 shrink-0">
                  <CardTitle>Completed Goals</CardTitle>
                  <CardDescription>{completedGoals.length} finished</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto space-y-4">
                  {completedGoals.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                      No completed goals yet.
                    </p>
                  ) : (
                    completedGoals.map((goal) => (
                      <Card key={goal.id} className="opacity-75">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <CardTitle className="line-through">{goal.title}</CardTitle>
                                <Badge variant="outline" className={getCategoryColor(goal.category)}>
                                  {goal.category}
                                </Badge>
                                <Badge variant="outline" className={getStatusColor(goal.status)}>
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Completed
                                </Badge>
                              </div>
                              <CardDescription>{goal.description}</CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <Progress value={100} className="h-2" />
                          <p className="text-xs text-muted-foreground mt-2">Completed on {goal.lastUpdated}</p>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </CardContent>
              </Card>
            )
          }

          return null
        }}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Goal</DialogTitle>
            <DialogDescription>
              Set a new objective to track your progress
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="goal-title">Goal Title *</Label>
              <Input
                id="goal-title"
                placeholder="e.g., Learn TypeScript"
                value={newGoal.title}
                onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="goal-description">Description</Label>
              <Textarea
                id="goal-description"
                placeholder="What do you want to achieve?"
                value={newGoal.description}
                onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="goal-category">Category</Label>
                <Select
                  value={newGoal.category}
                  onValueChange={(value: "individual" | "team" | "company") => setNewGoal({ ...newGoal, category: value })}
                >
                  <SelectTrigger id="goal-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="team">Team</SelectItem>
                    <SelectItem value="company">Company</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="goal-due">Due Date *</Label>
                <Input
                  id="goal-due"
                  type="date"
                  value={newGoal.dueDate}
                  onChange={(e) => setNewGoal({ ...newGoal, dueDate: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddGoal}
              disabled={!newGoal.title || !newGoal.dueDate}
            >
              Create Goal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Update Goal Progress</DialogTitle>
            <DialogDescription>Adjust the progress and status of this goal.</DialogDescription>
          </DialogHeader>
          {editGoal && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Progress ({editGoal.progress}%)</Label>
                <Input
                  type="range"
                  min={0}
                  max={100}
                  value={editGoal.progress}
                  onChange={(e) => setEditGoal({ ...editGoal, progress: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editGoal.status} onValueChange={(v) => setEditGoal({ ...editGoal, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="On Track">On Track</SelectItem>
                    <SelectItem value="Behind">Behind</SelectItem>
                    <SelectItem value="Complete">Complete</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EmployeePortalPageContent>
  )
}
