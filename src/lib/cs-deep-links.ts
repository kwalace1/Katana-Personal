/**
 * Deep links into the Customers module — used by notifications and hub activity.
 */

export type CustomerSuccessTab =
  | 'dashboard'
  | 'pipeline'
  | 'leads'
  | 'clients'
  | 'contacts'
  | 'tasks'
  | 'milestones'
  | 'interactions'
  | 'commerce'
  | 'campaigns'
  | 'analytics'

export function customerSuccessClientPath(
  clientId: string,
  tab: CustomerSuccessTab = 'clients',
): string {
  const params = new URLSearchParams({ tab, client: clientId })
  return `/customer-success?${params.toString()}`
}

export function customerSuccessTabPath(tab: CustomerSuccessTab): string {
  return `/customer-success?tab=${encodeURIComponent(tab)}`
}

export function parseCustomerSuccessSearchParams(search: string): {
  tab: CustomerSuccessTab | null
  clientId: string | null
} {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const tab = params.get('tab') as CustomerSuccessTab | null
  const clientId = params.get('client')
  return { tab, clientId }
}
