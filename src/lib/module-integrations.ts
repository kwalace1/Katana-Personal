/**
 * Cross-module integration registry and access helpers.
 *
 * Layering:
 * - Org entitlements (`orgEnabledModules`) — what the client purchased
 * - User access (`allowedModules`) — org ∩ HR assignment
 * - Use `canIntegrate(orgModules, a, b)` for org-level wiring
 * - Use `canIntegrate(allowedModules, a, b)` for user-visible actions
 */

import type { ModuleId } from './module-access'

/** Describes a bidirectional link between two modules. */
export interface ModuleIntegrationEdge {
  from: ModuleId
  to: ModuleId
  label: string
}

/**
 * Canonical integration graph — which modules communicate with each other.
 * Used for docs, onboarding, and integration gating.
 */
export const MODULE_INTEGRATION_EDGES: ModuleIntegrationEdge[] = [
  { from: 'customer-success', to: 'workforce', label: 'Clients → work orders' },
  { from: 'workforce', to: 'customer-success', label: 'Time → invoices' },
  { from: 'workforce', to: 'projects', label: 'Jobs → project tasks' },
  { from: 'workforce', to: 'inventory', label: 'Job parts checkout' },
  { from: 'customer-success', to: 'finance', label: 'Invoices → bank matching' },
  { from: 'inventory', to: 'finance', label: 'POs → bank matching' },
  { from: 'workforce', to: 'finance', label: 'Billable time → receivables' },
  { from: 'hr', to: 'projects', label: 'Employee assignees' },
  { from: 'hr', to: 'workforce', label: 'Technician roster' },
  { from: 'hr', to: 'customer-success', label: 'CSM identity' },
  { from: 'comms', to: 'projects', label: 'Task discussions' },
  { from: 'comms', to: 'customer-success', label: 'Client discussions' },
  { from: 'comms', to: 'workforce', label: 'Job discussions' },
  { from: 'comms', to: 'hr', label: 'Employee discussions' },
  { from: 'customer-success', to: 'support', label: 'Client support tickets' },
  { from: 'hub', to: 'projects', label: 'Mission control KPIs' },
  { from: 'hub', to: 'finance', label: 'Financial health snapshot' },
]

/** Returns true when the user has access to both modules in an integration pair. */
export function canIntegrate(
  allowedModules: readonly ModuleId[],
  moduleA: ModuleId,
  moduleB: ModuleId,
): boolean {
  const set = new Set(allowedModules)
  return set.has(moduleA) && set.has(moduleB)
}

/** Whether billing/invoicing UI should route to CS Commerce. */
export function canBillViaCustomerSuccess(allowedModules: readonly ModuleId[]): boolean {
  return allowedModules.includes('customer-success')
}

/** Whether Finance bank-matching links should appear alongside invoices. */
export function canReconcileInFinance(allowedModules: readonly ModuleId[]): boolean {
  return allowedModules.includes('finance')
}

/** Best invoice deep-link for a linked invoice id. */
export function invoiceDeepLink(
  invoiceId: string,
  allowedModules: readonly ModuleId[],
): string {
  if (canBillViaCustomerSuccess(allowedModules)) {
    return `/customer-success?tab=commerce&invoice=${invoiceId}`
  }
  if (canReconcileInFinance(allowedModules)) {
    return '/finance?tab=transactions'
  }
  return '/customer-success?tab=commerce'
}

/** Finance transactions tab for bank matching after an invoice is created. */
export function financeMatchDeepLink(): string {
  return '/finance?tab=transactions'
}

/** Modules that participate in at least one integration edge. */
export function integratedModuleIds(): ModuleId[] {
  const ids = new Set<ModuleId>()
  for (const edge of MODULE_INTEGRATION_EDGES) {
    ids.add(edge.from)
    ids.add(edge.to)
  }
  return Array.from(ids)
}

/** Edges visible to a user given their module access. */
export function visibleIntegrationEdges(
  allowedModules: readonly ModuleId[],
): ModuleIntegrationEdge[] {
  return MODULE_INTEGRATION_EDGES.filter((e) => canIntegrate(allowedModules, e.from, e.to))
}
