import { VISIBLE_MODULES, type ModuleId } from '@/lib/module-access'

/** Modules that appear elsewhere on Hub (not in the tools grid). */
export const HUB_NON_TOOL_MODULE_IDS: ModuleId[] = ['hub', 'employee']

/** Every assignable module that should have a card on the Hub tools grid. */
export const HUB_TOOL_MODULE_IDS: ModuleId[] = VISIBLE_MODULES.map((m) => m.id).filter(
  (id): id is ModuleId => !HUB_NON_TOOL_MODULE_IDS.includes(id)
)

export function getMissingHubToolModules(definedModuleIds: ModuleId[]): ModuleId[] {
  const defined = new Set(definedModuleIds)
  return HUB_TOOL_MODULE_IDS.filter((id) => !defined.has(id))
}
