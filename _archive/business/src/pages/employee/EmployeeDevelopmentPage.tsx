import { formatDateOnly } from '@/lib/due-date-utils'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import {
  BookOpen,
  Award,
  Search,
  Play,
  CheckCircle2,
  Clock,
  TrendingUp,
  Calendar,
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
import { useToast } from "@/hooks/use-toast"

export default function EmployeeDevelopmentPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const { employee, employeeId, loading: portalLoading, error: portalError } = useEmployeePortal()
  const [learningPaths, setLearningPaths] = useState<hrApi.LearningPath[]>([])
  const [catalogCourses, setCatalogCourses] = useState<hrApi.TrainingCourse[]>([])
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const { toast } = useToast()

  const surfaceConfig = getEmployeeSurfaceConfig('development')
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

  const reload = useCallback(async () => {
    if (!employeeId) return
    const [paths, courses] = await Promise.all([
      hrApi.getLearningPathsByEmployeeId(employeeId),
      hrApi.getTrainingCourses(true),
    ])
    setLearningPaths(paths)
    setCatalogCourses(courses)
  }, [employeeId])

  useEffect(() => {
    reload()
  }, [reload])

  const { certifications, skills } = useMemo(
    () => hrApi.deriveEmployeeCredentials(learningPaths, catalogCourses),
    [learningPaths, catalogCourses]
  )

  const myCourses = useMemo(
    () =>
      learningPaths.map((lp) => {
        const catalog = lp.training_course ?? catalogCourses.find((c) => c.id === lp.course_id)
        return {
          id: lp.id,
          title: lp.course || catalog?.title || "Untitled course",
          provider: catalog?.category || "Assigned",
          progress: lp.progress ?? 0,
          status: lp.status === "completed" ? "completed" : "in-progress",
          dueDate: lp.due_date ? formatDateOnly(lp.due_date) : "",
          completedDate:
            lp.status === "completed" && lp.updated_at
              ? new Date(lp.updated_at).toLocaleDateString()
              : undefined,
          notes: lp.notes,
          priority: lp.priority,
          duration: catalog?.duration_hours ? `${catalog.duration_hours}h` : "",
          level: catalog?.level,
        }
      }),
    [learningPaths, catalogCourses]
  )

  const catalog = useMemo(() => {
    const assignedIds = new Set(learningPaths.map((l) => l.course_id).filter(Boolean))
    return catalogCourses
      .filter((c) => !assignedIds.has(c.id))
      .filter((c) => {
        if (!searchQuery.trim()) return true
        const q = searchQuery.toLowerCase()
        return (
          c.title.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q)
        )
      })
      .map((c) => ({
        id: c.id,
        title: c.title,
        provider: c.category,
        rating: 0,
        students: 0,
        duration: c.duration_hours ? `${c.duration_hours} hours` : "—",
        level: c.level,
        category: c.category,
        description: c.description,
        skills: c.skills,
        certifications: c.certifications,
      }))
  }, [catalogCourses, learningPaths, searchQuery])

  const learningHoursThisMonth = useMemo(() => {
    return learningPaths
      .filter((l) => l.status === "completed")
      .reduce((sum, l) => {
        const cat = l.training_course ?? catalogCourses.find((c) => c.id === l.course_id)
        return sum + (cat?.duration_hours ?? 0)
      }, 0)
  }, [learningPaths, catalogCourses])

  const handleContinue = async (courseId: string, currentProgress: number) => {
    setUpdatingId(courseId)
    const next = Math.min(100, currentProgress + 25)
    const updated = await hrApi.updateLearningPath(courseId, { progress: next })
    setUpdatingId(null)
    if (updated) {
      await reload()
      if (next >= 100) {
        toast({
          title: "Course completed",
          description: "New skills and certifications may appear in your profile tabs.",
        })
      }
    } else {
      toast({ title: "Could not update progress", variant: "destructive" })
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
      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Learning & Development</h1>
          <p className="text-muted-foreground">Grow your skills and advance your career</p>
        </div>
        <ModuleCustomizeControls
          customizeMode={isCustomizeMode}
          onEnterCustomize={enterCustomize}
          onDone={() => void saveAndExit()}
          dataTourCustomize="launchpad-development-customize"
        />
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
        renderWidget={(widgetId) => {
          if (widgetId === 'learning_summary') {
            return (
              <div className="h-full grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="h-full overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Courses In Progress</CardTitle>
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {myCourses.filter((c) => c.status === "in-progress").length}
                    </div>
                  </CardContent>
                </Card>
                <Card className="h-full overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Completed</CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{myCourses.filter((c) => c.status === "completed").length}</div>
                  </CardContent>
                </Card>
                <Card className="h-full overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Certifications</CardTitle>
                    <Award className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{certifications.length}</div>
                  </CardContent>
                </Card>
                <Card className="h-full overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Learning Hours</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{learningHoursThisMonth}</div>
                    <p className="text-xs text-muted-foreground mt-1">From completed courses</p>
                  </CardContent>
                </Card>
              </div>
            )
          }

          if (widgetId === 'my_courses') {
            return (
              <Card className="h-full overflow-hidden">
                <CardHeader>
                  <CardTitle>My Courses</CardTitle>
                  <CardDescription>In-progress and assigned courses</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {myCourses.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                      No training assigned yet. When HR assigns a course, it will appear here and on your portal feed.
                    </p>
                  ) : (
                    myCourses.map((course) => (
                      <Card key={course.id}>
                        <CardHeader>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <CardTitle className="flex flex-wrap items-center gap-2">
                                {course.title}
                                <Badge variant={course.status === "completed" ? "default" : "outline"}>
                                  {course.status === "completed" ? "Completed" : "In Progress"}
                                </Badge>
                                {course.priority === "high" && (
                                  <Badge variant="destructive">Required</Badge>
                                )}
                              </CardTitle>
                              <CardDescription>
                                {course.provider}
                                {course.duration ? ` · ${course.duration}` : ""}
                                {course.level ? ` · ${course.level}` : ""}
                              </CardDescription>
                              {course.notes && (
                                <p className="text-sm text-muted-foreground mt-2 italic border-l-2 pl-3">
                                  {course.notes}
                                </p>
                              )}
                            </div>
                            {course.status !== "completed" && (
                              <Button
                                size="sm"
                                disabled={updatingId === course.id}
                                onClick={() => handleContinue(course.id, course.progress)}
                              >
                                {updatingId === course.id ? "Saving…" : "Continue"}
                                <Play className="w-4 h-4 ml-2" />
                              </Button>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          {course.status === "in-progress" && (
                            <>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">Progress</span>
                                <span className="text-sm font-bold">{course.progress}%</span>
                              </div>
                              <Progress value={course.progress} className="h-2 mb-2" />
                              {course.dueDate && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Calendar className="w-3 h-3" />
                                  Due {course.dueDate}
                                </div>
                              )}
                            </>
                          )}
                          {course.status === "completed" && (
                            <div className="flex items-center gap-2 text-sm text-green-600">
                              <CheckCircle2 className="w-4 h-4" />
                              Completed on {course.completedDate}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'course_catalog') {
            return (
              <Card className="h-full overflow-hidden">
                <CardHeader>
                  <CardTitle>Course Catalog</CardTitle>
                  <CardDescription>Browse and search available courses</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search courses..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {catalog.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                      {catalogCourses.length === 0
                        ? "Your organization has not published any courses yet."
                        : "You are enrolled in all available catalog courses, or none match your search."}
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {catalog.map((course) => (
                        <Card key={course.id} className="hover:shadow-lg transition-shadow">
                          <CardHeader>
                            <div className="flex items-start justify-between mb-2">
                              <Badge variant="outline">{course.category}</Badge>
                              <Badge variant="secondary" className="capitalize">
                                {course.level}
                              </Badge>
                            </div>
                            <CardTitle className="text-lg">{course.title}</CardTitle>
                            <CardDescription>{course.provider}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {course.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2">{course.description}</p>
                              )}
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="w-4 h-4" />
                                {course.duration}
                              </div>
                              {(course.skills.length > 0 || course.certifications.length > 0) && (
                                <div className="flex flex-wrap gap-1">
                                  {course.skills.slice(0, 3).map((s) => (
                                    <Badge key={s} variant="secondary" className="text-xs">
                                      {s}
                                    </Badge>
                                  ))}
                                  {course.certifications.slice(0, 2).map((c) => (
                                    <Badge key={c} variant="outline" className="text-xs">
                                      {c}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              <p className="text-xs text-muted-foreground">
                                Ask your manager to assign this course from HR.
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'certifications') {
            return (
              <Card className="h-full overflow-hidden">
                <CardHeader>
                  <CardTitle>Certifications</CardTitle>
                  <CardDescription>Earned certifications from completed courses</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {certifications.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                      Complete assigned courses to earn certifications configured by your organization.
                    </p>
                  ) : (
                    certifications.map((cert, i) => (
                      <Card key={`${cert.name}-${i}`}>
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="flex items-center gap-2">
                                <Award className="w-5 h-5 text-primary" />
                                {cert.name}
                              </CardTitle>
                              <CardDescription>From {cert.source}</CardDescription>
                            </div>
                            <Badge variant="outline" className="border-green-500 text-green-600 bg-green-500/10">
                              Earned
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground">Earned: {cert.earnedDate}</p>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'skills') {
            return (
              <Card className="h-full overflow-hidden">
                <CardHeader>
                  <CardTitle>Skills</CardTitle>
                  <CardDescription>Skill categories and proficiency levels</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {skills.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                      Complete courses to build skills tracked by your organization.
                    </p>
                  ) : (
                    ["Technical", "Soft Skills"].map((category) => {
                      const items = skills.filter((s) => s.category === category)
                      if (items.length === 0) return null
                      return (
                        <div key={category}>
                          <h3 className="font-semibold mb-4">{category} Skills</h3>
                          <div className="space-y-4">
                            {items.map((skill) => (
                              <div key={skill.name}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium">{skill.name}</span>
                                  <span className="text-sm font-bold">{skill.level}%</span>
                                </div>
                                <Progress value={skill.level} className="h-2" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })
                  )}
                </CardContent>
              </Card>
            )
          }

          return null
        }}
      />
    </EmployeePortalPageContent>
  )
}
