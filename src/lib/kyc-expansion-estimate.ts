/**
 * Expansion value estimate — only when pricing, modules, and usage support it (KYC doc §1, Phase 3).
 */

import type { KycRiskLevel } from './kyc-client-scoring'

export interface ProductModuleRow {
  id: string
  label: string
  monthly_price: number
}

export interface ClientModuleEntitlement {
  module_id: string
  status: 'active' | 'trial' | 'churned'
}

export interface KycExpansionEstimate {
  available: boolean
  estimated_annual_value: number | null
  expansion_probability: number
  unpurchased_modules: ProductModuleRow[]
  reasons: string[]
}

const HISTORICAL_UPSELL_RATE = 0.35

export function computeExpansionEstimate(opts: {
  expansion_likelihood: KycRiskLevel
  expansion_reasons: string[]
  modules: ProductModuleRow[]
  entitlements: ClientModuleEntitlement[]
  has_strong_usage: boolean
  has_pricing_data: boolean
}): KycExpansionEstimate {
  const purchased = new Set(
    opts.entitlements.filter((e) => e.status === 'active' || e.status === 'trial').map((e) => e.module_id),
  )
  const unpurchased = opts.modules.filter((m) => !purchased.has(m.id) && m.monthly_price > 0)

  const reasons: string[] = []
  if (!opts.has_pricing_data) {
    return {
      available: false,
      estimated_annual_value: null,
      expansion_probability: 0,
      unpurchased_modules: unpurchased,
      reasons: ['Module pricing catalog not available — cannot estimate expansion dollars.'],
    }
  }

  if (opts.expansion_likelihood === 'low' || !opts.has_strong_usage) {
    return {
      available: false,
      estimated_annual_value: null,
      expansion_probability: 0,
      unpurchased_modules: unpurchased,
      reasons: [
        'Expansion dollar estimate withheld — adoption or relationship signals do not support upsell yet.',
        ...opts.expansion_reasons.filter((r) => /must improve|before upsell|missing|low portal/i.test(r)).slice(0, 2),
      ],
    }
  }

  const availableUpsellValue = unpurchased.reduce((sum, m) => sum + m.monthly_price * 12, 0)
  if (availableUpsellValue <= 0) {
    return {
      available: false,
      estimated_annual_value: null,
      expansion_probability: 0,
      unpurchased_modules: [],
      reasons: ['All priced modules are already active on this account.'],
    }
  }

  const expansion_probability =
    opts.expansion_likelihood === 'high' ? HISTORICAL_UPSELL_RATE * 1.2 : HISTORICAL_UPSELL_RATE * 0.85

  const estimated_annual_value = Math.round(availableUpsellValue * expansion_probability)

  reasons.push(`Available upsell modules: ${unpurchased.map((m) => m.label).join(', ')}`)
  reasons.push(
    `Estimate uses module pricing × ${Math.round(expansion_probability * 100)}% expansion probability (historical upsell rate)`,
  )
  for (const r of opts.expansion_reasons.slice(0, 3)) {
    reasons.push(r)
  }

  return {
    available: true,
    estimated_annual_value,
    expansion_probability: Math.round(expansion_probability * 100) / 100,
    unpurchased_modules: unpurchased,
    reasons: reasons.slice(0, 6),
  }
}
