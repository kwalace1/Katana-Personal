import { useEmployeePortal } from '@/contexts/EmployeePortalContext'
import { useModuleAccess } from '@/contexts/ModuleAccessContext'
import { EmployeePortalNoAccess } from '@/components/employee/EmployeePortalNoAccess'
import { EmployeePortalPageContent } from '@/components/employee/EmployeePortalPageContent'
import { LoadingState } from '@/components/ui/loading-state'
import { Button } from '@/components/ui/button'
import { WfmMyWorkPanel } from '@/components/workforce/WfmMyWorkPanel'
import { useWfmTerminology } from '@/hooks/useWfmTerminology'
import { useModuleTour } from '@/components/tour/use-module-tour'
import {
  ModuleCustomizeControls,
  ModuleCustomizeHint,
} from '@/components/module-layout/ModuleCustomizeBar'
import { WidgetCatalogDialog } from '@/components/module-layout/WidgetCatalogDialog'
import { useModuleWidgetLayout } from '@/hooks/useModuleWidgetLayout'
import {
  EMPLOYEE_MODULE_ID,
  getEmployeeSurfaceConfig,
  type EmployeeTabLayoutProps,
} from '@/lib/employee/employee-widget-layout'

export default function EmployeeMyWorkPage() {
  useModuleTour('launchpad')
  const { terms } = useWfmTerminology()
  const { hasWfmManagerAccess } = useModuleAccess()
  const { employee, employeeId, loading, error } = useEmployeePortal()

  const surfaceConfig = getEmployeeSurfaceConfig('my_work')
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

  const tabLayout: EmployeeTabLayoutProps = {
    widgets: layout.widgets,
    catalog: surfaceConfig.catalog,
    customizeMode: isCustomizeMode,
    onLayoutChange,
    onRemoveWidget: removeWidget,
  }

  if (loading) {
    return (
      <EmployeePortalPageContent maxWidth="max-w-6xl">
        <LoadingState message="Loading your work…" />
      </EmployeePortalPageContent>
    )
  }

  if (error || !employeeId || !employee) {
    return <EmployeePortalNoAccess />
  }

  return (
    <EmployeePortalPageContent maxWidth="max-w-6xl">
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
      <WfmMyWorkPanel
        terms={terms}
        employeeId={employeeId}
        employeeEmail={employee.email}
        employeeName={employee.name}
        showManagerLink={hasWfmManagerAccess}
        layout={tabLayout}
        headerActions={
          <ModuleCustomizeControls
            customizeMode={isCustomizeMode}
            onEnterCustomize={enterCustomize}
            onDone={() => void saveAndExit()}
            dataTourCustomize="launchpad-my-work-customize"
          />
        }
      />
    </EmployeePortalPageContent>
  )
}
