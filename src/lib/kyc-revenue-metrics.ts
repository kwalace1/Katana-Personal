/**
 * Portfolio revenue metrics — GRR, NRR, logo retention (KYC doc §9).
 */

export interface MrrSnapshotRow {
  client_id: string
  snapshot_month: string
  mrr: number
  arr: number
  is_active: boolean
}

export interface KycRevenueMetrics {
  grr: number | null
  nrr: number | null
  logo_retention: number | null
  expansion_revenue: number | null
  contraction_revenue: number | null
  months_of_data: number
  available: boolean
  note: string
}

function monthKey(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr.slice(0, 7)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export function computeRevenueMetrics(snapshots: MrrSnapshotRow[]): KycRevenueMetrics {
  const empty: KycRevenueMetrics = {
    grr: null,
    nrr: null,
    logo_retention: null,
    expansion_revenue: null,
    contraction_revenue: null,
    months_of_data: 0,
    available: false,
    note: 'GRR, NRR, and logo retention require at least 2 monthly MRR snapshots.',
  }

  if (snapshots.length < 2) return empty

  const months = [...new Set(snapshots.map((s) => monthKey(s.snapshot_month)))].sort()
  if (months.length < 2) return empty

  const startMonth = months[0]!
  const endMonth = months[months.length - 1]!
  const startRows = snapshots.filter((s) => monthKey(s.snapshot_month) === startMonth && s.is_active)
  const endRows = snapshots.filter((s) => monthKey(s.snapshot_month) === endMonth)

  const startMrrByClient = new Map(startRows.map((s) => [s.client_id, s.mrr]))
  const endMrrByClient = new Map(endRows.map((s) => [s.client_id, s.mrr]))

  let startMrr = 0
  let retainedMrr = 0
  let endMrrFromCohort = 0
  let expansion = 0
  let contraction = 0
  let logosStart = startMrrByClient.size
  let logosRetained = 0

  for (const [clientId, startMrrValue] of startMrrByClient) {
    startMrr += startMrrValue
    const endMrrValue = endMrrByClient.get(clientId) ?? 0
    if (endMrrValue > 0) {
      logosRetained += 1
      endMrrFromCohort += endMrrValue
      retainedMrr += Math.min(startMrrValue, endMrrValue)
      if (endMrrValue > startMrrValue) expansion += endMrrValue - startMrrValue
      if (endMrrValue < startMrrValue) contraction += startMrrValue - endMrrValue
    } else {
      contraction += startMrrValue
    }
  }

  if (startMrr <= 0 || logosStart === 0) {
    return {
      ...empty,
      months_of_data: months.length,
      note: 'Insufficient starting MRR in snapshots to compute retention metrics.',
    }
  }

  const grr = retainedMrr / startMrr
  const nrr = endMrrFromCohort / startMrr
  const logo_retention = logosRetained / logosStart

  return {
    grr: Math.round(grr * 1000) / 10,
    nrr: Math.round(nrr * 1000) / 10,
    logo_retention: Math.round(logo_retention * 1000) / 10,
    expansion_revenue: Math.round(expansion),
    contraction_revenue: Math.round(contraction),
    months_of_data: months.length,
    available: true,
    note: `Computed from ${months.length} months of MRR snapshots (${startMonth} → ${endMonth}).`,
  }
}

export function computeAccountMrrTrend(
  snapshots: MrrSnapshotRow[],
  clientId: string,
): { current_mrr: number; prior_mrr: number | null; trend: 'up' | 'down' | 'flat' } {
  const rows = snapshots
    .filter((s) => s.client_id === clientId)
    .sort((a, b) => monthKey(a.snapshot_month).localeCompare(monthKey(b.snapshot_month)))

  if (rows.length === 0) return { current_mrr: 0, prior_mrr: null, trend: 'flat' }
  const current = rows[rows.length - 1]!
  if (rows.length === 1) return { current_mrr: current.mrr, prior_mrr: null, trend: 'flat' }
  const prior = rows[rows.length - 2]!
  const trend = current.mrr > prior.mrr ? 'up' : current.mrr < prior.mrr ? 'down' : 'flat'
  return { current_mrr: current.mrr, prior_mrr: prior.mrr, trend }
}
