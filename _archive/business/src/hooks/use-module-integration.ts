import { useModuleAccess } from '@/contexts/ModuleAccessContext'
import type { ModuleId } from '@/lib/module-access'

/**
 * Check whether a cross-module integration is active for the current user and org.
 */
export function useModuleIntegration(moduleA: ModuleId, moduleB: ModuleId) {
  const {
    canIntegrateModules,
    canOrgIntegrate,
    hasOrgModule,
    hasModuleAccess,
    orgEnabledModules,
    allowedModules,
  } = useModuleAccess()

  return {
    /** User can use this integration right now. */
    active: canIntegrateModules(moduleA, moduleB),
    /** Org has both modules — integration exists at org level. */
    orgActive: canOrgIntegrate(moduleA, moduleB),
    hasModuleA: hasModuleAccess(moduleA),
    hasModuleB: hasModuleAccess(moduleB),
    orgHasModuleA: hasOrgModule(moduleA),
    orgHasModuleB: hasOrgModule(moduleB),
    /** Org has one side but not the other — could unlock by adding a module. */
    latent:
      (hasOrgModule(moduleA) && !hasOrgModule(moduleB)) ||
      (hasOrgModule(moduleB) && !hasOrgModule(moduleA)),
    orgEnabledModules,
    allowedModules,
  }
}
