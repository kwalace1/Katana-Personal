import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import * as hrApi from '@/lib/hr-api'
import { getModuleIdByPath, isRetiredModuleId, type ModuleId } from '@/lib/module-access'
import { applyMemberModuleAccess, normalizeModuleIdList } from '@/lib/pilot-access'
import { isUnrestrictedModuleOrg } from '@/lib/module-bundles'
import { resolveHrAdminAccess, resolveWfmManagerAccess } from '@/lib/module-access-permissions'
import {
  buildIntegrationPlan,
  intersectModuleAccess,
  resolveOrgModulesDetail,
  type IntegrationPlan,
  type ResolvedOrgModules,
} from '@/lib/org-module-access'
import { canIntegrate, type ModuleIntegrationEdge } from '@/lib/module-integrations'
import { isLocalDevEnvironment, localDevFullModuleAccess } from '@/lib/dev-module-access'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

/** When we can't find an HR employee for the logged-in user, show only these (never full access). */
const DEFAULT_MODULES_WHEN_NO_EMPLOYEE: ModuleId[] = ['employee', 'careers']

/** HR record exists but `module_access` is empty or unset — portal only (matches DB: empty = no module access). */
const EMPTY_MODULE_ACCESS_FALLBACK: ModuleId[] = ['employee']

interface ModuleAccessContextType {
  /** Modules the organization is entitled to (purchased / provisioned). */
  orgEnabledModules: ModuleId[]
  /** How org modules were resolved (explicit list, settings, or tier). */
  orgModulesDetail: ResolvedOrgModules
  /** Module IDs the current user can access (user assignment ∩ org entitlement). */
  allowedModules: ModuleId[]
  /** Cross-module connections available to the org. */
  orgIntegrations: ModuleIntegrationEdge[]
  /** Cross-module connections the current user can use. */
  userIntegrations: ModuleIntegrationEdge[]
  /** Full integration plan for Hub and system wiring. */
  integrationPlan: IntegrationPlan
  loading: boolean
  hasModuleAccess: (moduleIdOrPath: ModuleId | string) => boolean
  /** Org has provisioned this module (may still be denied to user via HR). */
  hasOrgModule: (moduleId: ModuleId) => boolean
  /** Both org and user have the modules required for this integration pair. */
  canIntegrateModules: (moduleA: ModuleId, moduleB: ModuleId) => boolean
  /** Org has both modules (integration exists at org level). */
  canOrgIntegrate: (moduleA: ModuleId, moduleB: ModuleId) => boolean
  hasHrAdminAccess: boolean
  hasWfmManagerAccess: boolean
}

const ModuleAccessContext = createContext<ModuleAccessContextType | undefined>(undefined)

export function ModuleAccessProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, organization, loading: authLoading, hasRole } = useAuth()
  const [employee, setEmployee] = useState<hrApi.Employee | null>(null)
  const [employeeLoading, setEmployeeLoading] = useState(true)

  const isAdmin = hasRole(['owner', 'admin'])
  const profileEmail = (profile?.email ?? '').trim().toLowerCase()
  const userEmail = (user?.email ?? '').trim().toLowerCase()
  const emailCandidates = useMemo(() => {
    const set = new Set<string>()
    if (profileEmail) set.add(profileEmail)
    if (userEmail) set.add(userEmail)
    return Array.from(set)
  }, [profileEmail, userEmail])

  const orgModulesDetail = useMemo(
    () => resolveOrgModulesDetail(organization),
    [organization],
  )

  const orgEnabledModules = orgModulesDetail.modules

  const bypassPilotRestrictions = useMemo(
    () => isUnrestrictedModuleOrg(orgModulesDetail.tier, orgEnabledModules),
    [orgModulesDetail.tier, orgEnabledModules],
  )

  const pilotAccessOptions = useMemo(
    () => ({ bypassPilot: bypassPilotRestrictions }),
    [bypassPilotRestrictions],
  )

  const loadEmployeeForUser = useCallback(async () => {
    if (!user || authLoading || isAdmin || emailCandidates.length === 0) return
    for (const email of emailCandidates) {
      const emp = await hrApi.getEmployeeByEmail(email)
      if (emp) {
        setEmployee(emp)
        return
      }
    }
    setEmployee(null)
  }, [user, authLoading, isAdmin, emailCandidates])

  useEffect(() => {
    if (!user || authLoading) {
      setEmployee(null)
      setEmployeeLoading(false)
      return
    }
    if (isAdmin) {
      setEmployee(null)
      setEmployeeLoading(false)
      return
    }
    if (emailCandidates.length === 0) {
      setEmployee(null)
      setEmployeeLoading(false)
      return
    }
    let cancelled = false
    setEmployeeLoading(true)
    const findEmployee = async () => {
      for (const email of emailCandidates) {
        if (cancelled) return
        const emp = await hrApi.getEmployeeByEmail(email)
        if (emp && !cancelled) {
          setEmployee(emp)
          setEmployeeLoading(false)
          return
        }
      }
      if (!cancelled) setEmployee(null)
    }
    findEmployee().finally(() => {
      if (!cancelled) setEmployeeLoading(false)
    })
    return () => { cancelled = true }
  }, [user, authLoading, isAdmin, emailCandidates])

  useEffect(() => {
    if (!user || authLoading || isAdmin) return
    const onFocus = () => { void loadEmployeeForUser() }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void loadEmployeeForUser()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [user, authLoading, isAdmin, loadEmployeeForUser])

  useEffect(() => {
    if (!isSupabaseConfigured || !employee?.id || isAdmin) return
    const id = employee.id
    const channel = supabase
      .channel(`hr_employee_module_access:${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hr_employees', filter: `id=eq.${id}` },
        async () => {
          const fresh = await hrApi.getEmployeeById(id)
          if (fresh) setEmployee(fresh)
        }
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [employee?.id, isAdmin])

  const userAssignedModules = useMemo((): ModuleId[] => {
    if (authLoading || (employeeLoading && !isAdmin)) return []
    if (isAdmin) {
      if (isLocalDevEnvironment()) {
        return localDevFullModuleAccess()
      }
      return [...orgEnabledModules]
    }
    if (employee) {
      const list = normalizeModuleIdList(employee.module_access)
      if (list.length > 0) {
        return applyMemberModuleAccess(list, pilotAccessOptions)
      }
      return [...EMPTY_MODULE_ACCESS_FALLBACK]
    }
    if (!profile && user) return [...DEFAULT_MODULES_WHEN_NO_EMPLOYEE]
    return [...DEFAULT_MODULES_WHEN_NO_EMPLOYEE]
  }, [authLoading, employeeLoading, isAdmin, profile, user, employee, orgEnabledModules, pilotAccessOptions])

  const allowedModules = useMemo(
    () => intersectModuleAccess(userAssignedModules, orgEnabledModules),
    [userAssignedModules, orgEnabledModules],
  )

  const integrationPlan = useMemo(
    () => buildIntegrationPlan(orgEnabledModules, allowedModules),
    [orgEnabledModules, allowedModules],
  )

  const hasHrAdminAccess = useMemo(
    () => resolveHrAdminAccess(profile?.role, employee?.module_access),
    [profile?.role, employee?.module_access]
  )

  const hasWfmManagerAccess = useMemo(
    () => resolveWfmManagerAccess(profile?.role, employee?.module_access),
    [profile?.role, employee?.module_access]
  )

  const hasOrgModule = useCallback(
    (moduleId: ModuleId) => orgEnabledModules.includes(moduleId),
    [orgEnabledModules],
  )

  const canIntegrateModules = useCallback(
    (moduleA: ModuleId, moduleB: ModuleId) => canIntegrate(allowedModules, moduleA, moduleB),
    [allowedModules],
  )

  const canOrgIntegrate = useCallback(
    (moduleA: ModuleId, moduleB: ModuleId) => canIntegrate(orgEnabledModules, moduleA, moduleB),
    [orgEnabledModules],
  )

  const value: ModuleAccessContextType = {
    orgEnabledModules,
    orgModulesDetail,
    allowedModules,
    orgIntegrations: integrationPlan.orgIntegrations,
    userIntegrations: integrationPlan.userIntegrations,
    integrationPlan,
    loading: authLoading || (employeeLoading && !!user && !isAdmin),
    hasHrAdminAccess,
    hasWfmManagerAccess,
    hasOrgModule,
    canIntegrateModules,
    canOrgIntegrate,
    hasModuleAccess: (moduleIdOrPath: ModuleId | string) => {
      const path = String(moduleIdOrPath)
      if (path.startsWith('/')) {
        const id = getModuleIdByPath(path)
        if (!id || isRetiredModuleId(id)) return false
        return allowedModules.includes(id)
      }
      if (isRetiredModuleId(path)) return false
      return allowedModules.includes(path as ModuleId)
    },
  }

  return (
    <ModuleAccessContext.Provider value={value}>
      {children}
    </ModuleAccessContext.Provider>
  )
}

export function useModuleAccess() {
  const ctx = useContext(ModuleAccessContext)
  if (ctx === undefined) {
    throw new Error('useModuleAccess must be used within ModuleAccessProvider')
  }
  return ctx
}
