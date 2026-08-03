"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { getAssignableModulesForHr, isPilotModeEnabled } from "@/lib/pilot-access"
import { isUnrestrictedModuleOrg } from "@/lib/module-bundles"
import { useModuleAccess } from "@/contexts/ModuleAccessContext"
import {
  applyModuleAccessToggle,
  HR_PERMISSION_OPTIONS,
  isHrPermissionId,
  WFM_PERMISSION_OPTIONS,
} from "@/lib/module-access-permissions"
import { MODULES } from "@/lib/module-access"

interface ModuleAccessFieldsProps {
  value: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
}

export function ModuleAccessFields({ value, onChange, disabled }: ModuleAccessFieldsProps) {
  const { orgEnabledModules, orgModulesDetail } = useModuleAccess()
  const bypassPilot = isUnrestrictedModuleOrg(orgModulesDetail.tier, orgEnabledModules)
  const assignableModules = getAssignableModulesForHr(orgEnabledModules, { bypassPilot })
  const hasHrModule = value.includes("hr")
  const hasWorkforceModule = value.includes("workforce")

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">App modules</p>
        <div className="flex flex-wrap gap-4">
          {assignableModules.map((m) => (
            <label key={m.id} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                disabled={disabled}
                checked={value.includes(m.id)}
                onCheckedChange={(checked) =>
                  onChange(applyModuleAccessToggle(value, m.id, checked === true))
                }
              />
              <span className="text-sm">{m.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-border p-3 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">HR permissions</p>
        <p className="text-[11px] text-muted-foreground">
          Grant HR admin to manage recruitment, the employee roster, and analytics without making
          them an organization owner or admin.
        </p>
        {HR_PERMISSION_OPTIONS.map((perm) => (
          <label key={perm.id} className="flex items-start gap-2 cursor-pointer">
            <Checkbox
              disabled={disabled}
              checked={value.includes(perm.id)}
              onCheckedChange={(checked) =>
                onChange(applyModuleAccessToggle(value, perm.id, checked === true))
              }
              className="mt-0.5"
            />
            <span className="text-sm leading-snug">
              <span className="font-medium">{perm.label}</span>
              <span className="block text-xs text-muted-foreground">{perm.description}</span>
            </span>
          </label>
        ))}
        {!hasHrModule && value.some(isHrPermissionId) && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Katana HR module will be added automatically when HR Admin is enabled.
          </p>
        )}
      </div>

      <div className="rounded-md border border-border p-3 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Workforce permissions</p>
        <p className="text-[11px] text-muted-foreground">
          Grant manager console access for scheduling, team roster, and reports. Without this,
          employees only see My Work (their assigned jobs).
        </p>
        {WFM_PERMISSION_OPTIONS.map((perm) => (
          <label key={perm.id} className="flex items-start gap-2 cursor-pointer">
            <Checkbox
              disabled={disabled}
              checked={value.includes(perm.id)}
              onCheckedChange={(checked) =>
                onChange(applyModuleAccessToggle(value, perm.id, checked === true))
              }
              className="mt-0.5"
            />
            <span className="text-sm leading-snug">
              <span className="font-medium">{perm.label}</span>
              <span className="block text-xs text-muted-foreground">{perm.description}</span>
            </span>
          </label>
        ))}
        {!hasWorkforceModule && value.includes('wfm-manager') && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            WFM module will be added automatically when Workforce Manager is enabled.
          </p>
        )}
      </div>

      {isPilotModeEnabled() && !bypassPilot && (
        <p className="text-xs text-muted-foreground">
          Pilot mode: only modules in VITE_PILOT_MODULES can be assigned. HR Admin is always
          assignable when permitted.
        </p>
      )}
    </div>
  )
}

/** Read-only badges for assigned modules and permissions. */
export function ModuleAccessBadges({ access }: { access: string[] }) {
  const ids = access.length > 0 ? access : ["employee"]
  return (
    <div className="flex flex-wrap gap-2">
      {ids.map((id) => {
        const label =
          MODULES.find((m) => m.id === id)?.label ??
          HR_PERMISSION_OPTIONS.find((p) => p.id === id)?.label ??
          WFM_PERMISSION_OPTIONS.find((p) => p.id === id)?.label ??
          id
        return (
          <span
            key={id}
            className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground"
          >
            {label}
          </span>
        )
      })}
    </div>
  )
}
