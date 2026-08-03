/**
 * Know Your Customer — account coach responses (template + context for AI).
 */

import type { KycSummaryContext } from './kyc-client-summary'

export interface KycCoachResponse {
  recommended_action: string
  why: string
  cautions: string[]
  priority: 'high' | 'medium' | 'low'
}

export function buildTemplateCoachResponse(ctx: KycSummaryContext): KycCoachResponse {
  const action = ctx.primary_action?.label ?? 'Schedule a customer check-in'
  const whyParts: string[] = []

  if (ctx.expansion_reasons.length > 0) {
    const positive = ctx.expansion_reasons.filter((r) => !/must improve|before upsell|missing/i.test(r))
    if (positive.length > 0) whyParts.push(positive[0]!)
  }

  if (ctx.renewal_risk_reasons.length > 0) {
    whyParts.push(ctx.renewal_risk_reasons[0]!)
  } else if (ctx.health_score < 55) {
    whyParts.push(`Health score is ${ctx.health_score}, which needs proactive engagement`)
  } else {
    whyParts.push('Maintain relationship momentum with consistent touchpoints')
  }

  if (ctx.primary_action?.reason) {
    whyParts.push(ctx.primary_action.reason)
  }

  const cautions: string[] = []
  if (ctx.expansion_likelihood === 'low') {
    cautions.push('Do not recommend an upsell yet — adoption and relationship signals do not support expansion.')
  }
  if (ctx.renewal_risk === 'high') {
    cautions.push('Treat renewal protection as the top priority this week.')
  }
  if (ctx.renewal_date) {
    cautions.push(`Renewal date on file: ${ctx.renewal_date}.`)
  }

  const priority =
    ctx.renewal_risk === 'high' || ctx.primary_action?.priority === 'high'
      ? 'high'
      : ctx.renewal_risk === 'medium' || ctx.primary_action?.priority === 'medium'
        ? 'medium'
        : 'low'

  return {
    recommended_action: action,
    why: whyParts.slice(0, 3).join('. ') + (whyParts.length ? '.' : ''),
    cautions,
    priority,
  }
}

export function formatCoachResponse(response: KycCoachResponse): string {
  const lines = [`Recommended action: ${response.recommended_action}`, `Why: ${response.why}`]
  for (const caution of response.cautions) {
    lines.push(caution)
  }
  return lines.join('\n\n')
}
