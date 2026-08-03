"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Link2, Puzzle } from "lucide-react"
import { useModuleAccess } from "@/contexts/ModuleAccessContext"
import { VISIBLE_MODULES } from "@/lib/module-access"
import { moduleLabel, TIER_LABELS } from "@/lib/module-bundles"

export function OrgModulesIntegrationCard() {
  const {
    orgEnabledModules,
    orgModulesDetail,
    orgIntegrations,
    integrationPlan,
    allowedModules,
  } = useModuleAccess()

  const inactiveOrgModules = VISIBLE_MODULES.filter((m) => !orgEnabledModules.includes(m.id))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Puzzle className="h-5 w-5" />
          Modules &amp; connections
        </CardTitle>
        <CardDescription>
          Your organization&apos;s active modules and how they connect. The system wires integrations
          automatically based on what you have enabled (
          {orgModulesDetail.source === 'tier'
            ? `${TIER_LABELS[orgModulesDetail.tier]} plan defaults`
            : orgModulesDetail.source === 'explicit'
              ? 'custom module list'
              : 'organization settings'}
          ).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Enabled modules ({orgEnabledModules.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {orgEnabledModules.map((id) => (
              <Badge key={id} variant={allowedModules.includes(id) ? 'default' : 'secondary'}>
                {moduleLabel(id)}
              </Badge>
            ))}
          </div>
          {inactiveOrgModules.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Not on your plan: {inactiveOrgModules.slice(0, 6).map((m) => m.label).join(', ')}
              {inactiveOrgModules.length > 6 ? ` +${inactiveOrgModules.length - 6} more` : ''}
            </p>
          )}
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <Link2 className="h-3.5 w-3.5" />
            Active connections ({orgIntegrations.length})
          </p>
          {orgIntegrations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add modules to unlock cross-module workflows.</p>
          ) : (
            <ul className="grid gap-1.5 sm:grid-cols-2 text-sm">
              {orgIntegrations.map((edge) => (
                <li key={`${edge.from}-${edge.to}`} className="rounded-md border px-2.5 py-1.5 text-muted-foreground">
                  <span className="text-foreground font-medium">{moduleLabel(edge.from)}</span>
                  {' → '}
                  <span className="text-foreground font-medium">{moduleLabel(edge.to)}</span>
                  <span className="block text-[11px]">{edge.label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {integrationPlan.latentIntegrations.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Unlock by adding a module</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              {integrationPlan.latentIntegrations.slice(0, 4).map((edge) => (
                <li key={`latent-${edge.from}-${edge.to}`}>
                  {edge.label} — add{' '}
                  <span className="text-foreground">
                    {moduleLabel(orgEnabledModules.includes(edge.from) ? edge.to : edge.from)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
