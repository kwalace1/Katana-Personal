import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { LoadingState } from "@/components/ui/loading-state"
import { EmptyState } from "@/components/ui/empty-state"
import { EmployeePortalPageContent } from '@/components/employee/EmployeePortalPageContent'
import { useModuleAccess } from '@/contexts/ModuleAccessContext'
import { useAuth } from '@/contexts/AuthContext'
import { loadEmployeeDirectory, type EmployeeDirectoryEntry } from '@/lib/employee-directory'
import { presenceIndicatorClass } from '@/lib/employee-directory-presence'
import { navigateToCommsDirectMessage } from '@/lib/comms-navigation'
import {
  Search,
  Users,
  Mail,
  Phone,
  MapPin,
  Grid3x3,
  List,
  MessageSquare,
} from "lucide-react"
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

function PresenceDot({ entry }: { entry: EmployeeDirectoryEntry }) {
  return (
    <span
      className={`absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-background ${presenceIndicatorClass(entry.presence)}`}
      title={entry.presenceLabel}
      aria-label={entry.presenceLabel}
    />
  )
}

export default function EmployeeDirectoryPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { hasModuleAccess } = useModuleAccess()
  const hasCommsAccess = hasModuleAccess('comms')
  const [searchQuery, setSearchQuery] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeDirectoryEntry | null>(null)
  const [employees, setEmployees] = useState<EmployeeDirectoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  const surfaceConfig = getEmployeeSurfaceConfig('directory')
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
    loadEmployeeDirectory()
      .then(setEmployees)
      .catch(() => setEmployees([]))
      .finally(() => setLoading(false))
  }, [])

  const handleMessage = useCallback(
    (entry: EmployeeDirectoryEntry, e?: React.MouseEvent) => {
      e?.stopPropagation()
      if (entry.katanaUserId && user?.id && entry.katanaUserId === user.id) return
      navigateToCommsDirectMessage({
        targetUserId: entry.katanaUserId,
        targetEmail: entry.email,
        targetName: entry.name,
        hasCommsAccess,
        navigate,
      })
    },
    [hasCommsAccess, navigate, user?.id]
  )

  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         employee.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         employee.department.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesDepartment = departmentFilter === "all" || employee.department === departmentFilter

    return matchesSearch && matchesDepartment
  })

  const departments = Array.from(new Set(employees.map(e => e.department)))

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8">
        <LoadingState message="Loading directory…" />
      </div>
    )
  }

  const deptColors: Record<string, string> = {}
  const colorPalette = [
    "from-blue-500/80 to-cyan-500/80",
    "from-violet-500/80 to-purple-500/80",
    "from-amber-500/80 to-orange-500/80",
    "from-emerald-500/80 to-teal-500/80",
    "from-rose-500/80 to-pink-500/80",
  ]
  departments.forEach((d, i) => {
    deptColors[d] = colorPalette[i % colorPalette.length]
  })

  const isSelf = (entry: EmployeeDirectoryEntry) =>
    !!user?.id && entry.katanaUserId === user.id

  return (
    <EmployeePortalPageContent maxWidth="max-w-5xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">People</h1>
          <p className="text-muted-foreground text-sm">Find and connect with your team</p>
        </div>
        <ModuleCustomizeControls
          customizeMode={isCustomizeMode}
          onEnterCustomize={enterCustomize}
          onDone={() => void saveAndExit()}
          dataTourCustomize="launchpad-directory-customize"
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
        rowHeight={36}
        renderWidget={(widgetId) => {
          if (widgetId === 'directory_toolbar') {
            return (
              <Card className="h-full overflow-hidden border-0 shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search people..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 rounded-full bg-background border-border shadow-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        variant={departmentFilter === "all" ? "default" : "outline"}
                        size="sm"
                        className="rounded-full"
                        onClick={() => setDepartmentFilter("all")}
                      >
                        All
                      </Button>
                      {departments.map((dept) => (
                        <Button
                          key={dept}
                          variant={departmentFilter === dept ? "default" : "outline"}
                          size="sm"
                          className="rounded-full"
                          onClick={() => setDepartmentFilter(dept)}
                        >
                          {dept}
                        </Button>
                      ))}
                      <div className="flex gap-1 ml-auto">
                        <Button
                          variant={viewMode === "grid" ? "default" : "ghost"}
                          size="icon"
                          className="rounded-full h-9 w-9"
                          onClick={() => setViewMode("grid")}
                        >
                          <Grid3x3 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant={viewMode === "list" ? "default" : "ghost"}
                          size="icon"
                          className="rounded-full h-9 w-9"
                          onClick={() => setViewMode("list")}
                        >
                          <List className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span>{filteredEmployees.length} of {employees.length} people</span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-green-500" aria-hidden />
                      Active now
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" aria-hidden />
                      Signed in before
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-gray-400" aria-hidden />
                      Not signed in yet
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'people_directory') {
            if (filteredEmployees.length === 0) {
              return (
                <Card className="h-full overflow-hidden border-0 shadow-sm">
                  <EmptyState
                    icon={Users}
                    title="No people found"
                    description="Try a different search or filter"
                    compact
                  />
                </Card>
              )
            }

            if (viewMode === "grid") {
              return (
                <div className="h-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 content-start">
                  {filteredEmployees.map((employee) => (
                    <Card
                      key={employee.id}
                      className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                      onClick={() => setSelectedEmployee(employee)}
                    >
                      <div className={`h-20 bg-gradient-to-br ${deptColors[employee.department] ?? "from-muted to-muted/80"}`} />
                      <CardContent className="pt-0 pb-4 -mt-10 px-4">
                        <div className="flex flex-col items-center text-center">
                          <div className="relative mb-2">
                            {employee.photo && employee.photo !== "/placeholder.svg?height=100&width=100" ? (
                              <img
                                src={employee.photo}
                                alt={employee.name}
                                className="w-16 h-16 rounded-full object-cover border-4 border-background shadow"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.style.display = "none"
                                  const fallback = target.nextElementSibling as HTMLElement
                                  if (fallback) fallback.style.display = "flex"
                                }}
                              />
                            ) : null}
                            <div
                              className={`w-16 h-16 rounded-full border-4 border-background shadow flex items-center justify-center text-lg font-bold text-primary bg-primary/10 ${employee.photo && employee.photo !== "/placeholder.svg?height=100&width=100" ? "hidden" : ""}`}
                            >
                              {employee.name.split(" ").map((n) => n[0]).join("")}
                            </div>
                            <PresenceDot entry={employee} />
                          </div>
                          <h3 className="font-semibold text-foreground">{employee.name}</h3>
                          <p className="text-sm text-muted-foreground">{employee.position}</p>
                          <p className="text-xs text-muted-foreground">{employee.department}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{employee.presenceLabel}</p>
                          <div className="flex gap-2 mt-3 w-full justify-center" onClick={(e) => e.stopPropagation()}>
                            {!isSelf(employee) && (
                              <Button
                                size="sm"
                                variant="default"
                                className="rounded-full flex-1 max-w-[120px]"
                                onClick={(e) => handleMessage(employee, e)}
                              >
                                <MessageSquare className="w-3 h-3 mr-1" />
                                Message
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="rounded-full" onClick={() => setSelectedEmployee(employee)}>
                              Profile
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )
            }

            return (
              <div className="h-full space-y-2">
                {filteredEmployees.map((employee) => (
                  <div
                    key={employee.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedEmployee(employee)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        setSelectedEmployee(employee)
                      }
                    }}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border/50 shadow-sm hover:shadow transition-all cursor-pointer"
                  >
                    <div className="relative shrink-0">
                      {employee.photo && employee.photo !== "/placeholder.svg?height=100&width=100" && (
                        <img
                          src={employee.photo}
                          alt={employee.name}
                          className="w-12 h-12 rounded-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.style.display = "none"
                            const fallback = target.nextElementSibling as HTMLElement
                            if (fallback) fallback.style.display = "flex"
                          }}
                        />
                      )}
                      <div
                        className={`w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary ${employee.photo && employee.photo !== "/placeholder.svg?height=100&width=100" ? "hidden" : ""}`}
                      >
                        {employee.name.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <PresenceDot entry={employee} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{employee.name}</h3>
                        <Badge variant="outline" className="text-xs">{employee.presenceLabel}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{employee.position} · {employee.department}</p>
                    </div>
                    {!isSelf(employee) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full shrink-0"
                        onClick={(e) => handleMessage(employee, e)}
                      >
                        <MessageSquare className="w-4 h-4 mr-1" />
                        Message
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )
          }

          return null
        }}
      />

      <Dialog open={!!selectedEmployee} onOpenChange={(open) => !open && setSelectedEmployee(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{selectedEmployee?.name}</DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  {selectedEmployee.photo && selectedEmployee.photo !== "/placeholder.svg?height=100&width=100" ? (
                    <img
                      src={selectedEmployee.photo}
                      alt={selectedEmployee.name}
                      className="w-14 h-14 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
                      {selectedEmployee.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                  )}
                  <PresenceDot entry={selectedEmployee} />
                </div>
                <div>
                  <p className="font-medium">{selectedEmployee.position}</p>
                  <Badge variant="outline">{selectedEmployee.department}</Badge>
                  <p className="text-xs text-muted-foreground mt-1">{selectedEmployee.presenceLabel}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-4 h-4 shrink-0" />
                  <a href={`mailto:${selectedEmployee.email}`} className="hover:text-primary truncate">
                    {selectedEmployee.email}
                  </a>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-4 h-4 shrink-0" />
                  <span>{selectedEmployee.phone || '—'}</span>
                </div>
                {(selectedEmployee.location || selectedEmployee.timezone) && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4 shrink-0" />
                    <span>{[selectedEmployee.location, selectedEmployee.timezone].filter(Boolean).join(" · ") || "—"}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="w-4 h-4 shrink-0" />
                  <span>Reports to {selectedEmployee.manager || "—"}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                {!isSelf(selectedEmployee) && (
                  <Button className="w-full rounded-full flex-1" onClick={() => handleMessage(selectedEmployee)}>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Message in Comms
                  </Button>
                )}
                {selectedEmployee.email && (
                  <Button variant="outline" className="w-full rounded-full flex-1" asChild>
                    <a href={`mailto:${selectedEmployee.email}`}>
                      <Mail className="w-4 h-4 mr-2" />
                      Email
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </EmployeePortalPageContent>
  )
}
