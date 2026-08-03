import { formatDateOnly } from '@/lib/due-date-utils'
import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Star,
  TrendingUp,
  Download,
  Calendar,
  Target,
  ThumbsUp,
  MessageSquare,
  Award,
  TrendingDown,
  Minus,
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
import type { PerformanceReview } from "@/lib/hr-api"

function overallRating(r: PerformanceReview): number {
  return (r.collaboration + r.accountability + r.trustworthy + r.leadership) / 4
}

function parseList(s: string | null | undefined): string[] {
  if (!s || !s.trim()) return []
  return s.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean)
}

export default function EmployeePerformancePage() {
  const { employee, employeeId, loading: portalLoading, error: portalError } = useEmployeePortal()
  const [reviews, setReviews] = useState<PerformanceReview[]>([])

  const surfaceConfig = getEmployeeSurfaceConfig('performance')
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
    hrApi.getPerformanceReviewsByEmployeeId(employeeId).then(setReviews)
  }, [employeeId])

  const currentScore = useMemo(() => (reviews.length > 0 ? overallRating(reviews[0]) : null), [reviews])
  const previousScore = useMemo(() => (reviews.length > 1 ? overallRating(reviews[1]) : null), [reviews])
  const trend = currentScore != null && previousScore != null ? currentScore - previousScore : 0

  const performanceHistory = useMemo(
    () =>
      reviews.slice(0, 6).map((r) => ({
        quarter: formatDateOnly(r.review_date, "en-US", { month: "short", year: "numeric" }),
        score: overallRating(r),
      })),
    [reviews]
  )

  const competencies = useMemo(() => {
    if (reviews.length === 0) return []
    const r = reviews[0]
    return [
      { name: "Collaboration", score: r.collaboration, category: "Core" as const },
      { name: "Accountability", score: r.accountability, category: "Core" as const },
      { name: "Trustworthy", score: r.trustworthy, category: "Core" as const },
      { name: "Leadership", score: r.leadership, category: "Soft Skills" as const },
    ]
  }, [reviews])

  const [recognitions, setRecognitions] = useState<hrApi.Recognition[]>([])
  useEffect(() => {
    if (!employeeId) return
    hrApi.getRecognitionsByEmployeeId(employeeId).then(setRecognitions)
  }, [employeeId])

  const peerFeedback = useMemo(
    () =>
      recognitions.slice(0, 10).map((rec) => ({
        from: rec.from_name,
        date: rec.recognition_date ? formatDateOnly(rec.recognition_date) : "",
        comment: rec.message,
      })),
    [recognitions]
  )

  const achievements = useMemo(() => {
    const list: { title: string; icon: typeof Award; date: string; description: string }[] = []
    if (reviews.length > 0) {
      const d = new Date(reviews[0].review_date)
      list.push({
        title: "Latest review",
        icon: Star,
        date: d.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        description: `Overall ${overallRating(reviews[0]).toFixed(1)}/5.0`,
      })
    }
    if (recognitions.length > 0) {
      list.push({
        title: "Recognition",
        icon: Award,
        date: recognitions.length + " received",
        description: "Peer and manager recognition",
      })
    }
    return list
  }, [reviews, recognitions])

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
          <h1 className="text-3xl font-bold text-foreground mb-2">My Performance</h1>
          <p className="text-muted-foreground">Track your performance reviews and growth</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ModuleCustomizeControls
            customizeMode={isCustomizeMode}
            onEnterCustomize={enterCustomize}
            onDone={() => void saveAndExit()}
            dataTourCustomize="launchpad-performance-customize"
          />
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export Report
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
          if (widgetId === 'perf_summary') {
            return (
              <div className="h-full overflow-hidden grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Current Score</CardTitle>
                    <Star className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{currentScore != null ? `${currentScore}/5.0` : "—"}</div>
                    <div className="flex items-center gap-1 mt-1 text-xs">
                      {trend > 0 ? (
                        <>
                          <TrendingUp className="w-3 h-3 text-green-500" />
                          <span className="text-green-500">+{trend.toFixed(1)} from last review</span>
                        </>
                      ) : trend < 0 ? (
                        <>
                          <TrendingDown className="w-3 h-3 text-red-500" />
                          <span className="text-red-500">{trend.toFixed(1)} from last review</span>
                        </>
                      ) : (
                        <>
                          <Minus className="w-3 h-3 text-muted-foreground" />
                          <span className="text-muted-foreground">No change</span>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Reviews</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{reviews.length}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {reviews.length > 0 ? `Last: ${formatDateOnly(reviews[0].review_date)}` : "No reviews yet"}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Peer Feedback</CardTitle>
                    <ThumbsUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{peerFeedback.length}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Received this quarter
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Achievements</CardTitle>
                    <Award className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{achievements.length}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      This year
                    </p>
                  </CardContent>
                </Card>
              </div>
            )
          }

          if (widgetId === 'performance_trend') {
            return (
              <Card className="h-full overflow-hidden">
                <CardHeader>
                  <CardTitle>Performance Trend</CardTitle>
                  <CardDescription>Your performance scores over time</CardDescription>
                </CardHeader>
                <CardContent className="overflow-auto">
                  <div className="space-y-4">
                    {performanceHistory.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        No performance history yet. Scores will appear here after your first review.
                      </p>
                    ) : (
                      performanceHistory.map((record, index) => (
                        <div key={index}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">{record.quarter}</span>
                            <span className="text-sm font-bold">{record.score}/5.0</span>
                          </div>
                          <Progress value={(record.score / 5) * 100} className="h-2" />
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'review_history') {
            return (
              <div className="h-full overflow-auto space-y-4">
                {reviews.length === 0 ? (
                  <Card className="h-full overflow-hidden">
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No performance reviews yet. Reviews will appear here once your manager completes them.
                    </CardContent>
                  </Card>
                ) : (
                  reviews.map((review) => {
                    const score = overallRating(review)
                    const strengths = parseList(review.strengths)
                    const improvements = parseList(review.improvements)
                    const goalsList = parseList(review.goals)
                    return (
                      <Card key={review.id}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="flex items-center gap-3">
                                {formatDateOnly(review.review_date)}
                                <Badge variant={review.review_type === "annual" ? "default" : "outline"}>
                                  {review.review_type}
                                </Badge>
                              </CardTitle>
                              <CardDescription>Reviewed by {review.reviewer?.name ?? "—"}</CardDescription>
                            </div>
                            <div className="text-right">
                              <div className="text-3xl font-bold text-primary">{score.toFixed(1)}/5.0</div>
                              <div className="flex items-center gap-1 mt-1">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`w-4 h-4 ${i < Math.round(score) ? "fill-primary text-primary" : "text-muted"}`}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {(review.strengths || review.improvements) && (
                            <div>
                              <h4 className="font-semibold mb-2 flex items-center gap-2">
                                <MessageSquare className="w-4 h-4" />
                                Notes
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                {[review.strengths, review.improvements].filter(Boolean).join(" ")}
                              </p>
                            </div>
                          )}
                          {strengths.length > 0 && (
                            <div>
                              <h4 className="font-semibold mb-2 text-green-600 dark:text-green-400 flex items-center gap-2">
                                <ThumbsUp className="w-4 h-4" />
                                Strengths
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {strengths.map((s, i) => (
                                  <Badge key={i} variant="outline" className="border-green-500 text-green-600 bg-green-500/10">
                                    {s}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {improvements.length > 0 && (
                            <div>
                              <h4 className="font-semibold mb-2 text-orange-600 dark:text-orange-400 flex items-center gap-2">
                                <Target className="w-4 h-4" />
                                Areas for Improvement
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {improvements.map((imp, i) => (
                                  <Badge key={i} variant="outline" className="border-orange-500 text-orange-600 bg-orange-500/10">
                                    {imp}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {goalsList.length > 0 && (
                            <div>
                              <h4 className="font-semibold mb-2 flex items-center gap-2">
                                <Target className="w-4 h-4" />
                                Goals for Next Period
                              </h4>
                              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                                {goalsList.map((g, i) => (
                                  <li key={i}>{g}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })
                )}
              </div>
            )
          }

          if (widgetId === 'competencies') {
            return (
              <Card className="h-full overflow-hidden">
                <CardHeader>
                  <CardTitle>Skills & Competencies</CardTitle>
                  <CardDescription>Your ratings across key competencies</CardDescription>
                </CardHeader>
                <CardContent className="overflow-auto">
                  {competencies.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No competency ratings yet. Ratings will appear here after your first review.
                    </p>
                  ) : (
                    <div className="space-y-6">
                      {["Core", "Soft Skills"].map((category) => (
                        <div key={category}>
                          <h3 className="font-semibold mb-4">{category}</h3>
                          <div className="space-y-4">
                            {competencies.filter(c => c.category === category).map((competency, index) => (
                              <div key={index}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium">{competency.name}</span>
                                  <span className="text-sm font-bold">{competency.score}/5.0</span>
                                </div>
                                <Progress value={(competency.score / 5) * 100} className="h-2" />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'peer_recognition') {
            return (
              <Card className="h-full overflow-hidden">
                <CardHeader>
                  <CardTitle>Peer Recognition</CardTitle>
                  <CardDescription>Feedback from your colleagues</CardDescription>
                </CardHeader>
                <CardContent className="overflow-auto">
                  <div className="space-y-4">
                    {peerFeedback.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">No recognitions yet. Recognition from peers and managers will appear here.</p>
                    ) : (
                      peerFeedback.map((feedback, index) => (
                        <div key={index} className="p-4 rounded-lg border border-border/40 bg-muted/20">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                              {feedback.from?.split(" ").map((n) => n[0]).join("") || "?"}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{feedback.from}</p>
                              <p className="text-xs text-muted-foreground">{feedback.date}</p>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">{feedback.comment}</p>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'perf_achievements') {
            return (
              <div className="h-full overflow-auto">
                {achievements.length === 0 ? (
                  <Card className="h-full overflow-hidden">
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No achievements yet. Complete reviews and get recognition to see achievements here.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {achievements.map((achievement, index) => (
                      <Card key={index}>
                        <CardContent className="pt-6">
                          <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                              <achievement.icon className="w-8 h-8 text-primary" />
                            </div>
                            <h3 className="font-semibold mb-2">{achievement.title}</h3>
                            <p className="text-sm text-muted-foreground mb-2">{achievement.description}</p>
                            <Badge variant="outline">{achievement.date}</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )
          }

          return null
        }}
      />
    </EmployeePortalPageContent>
  )
}
