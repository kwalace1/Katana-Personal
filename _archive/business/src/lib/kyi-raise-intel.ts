/**
 * Raise intelligence — answers the KYI 2.0 write-up “future vision” questions
 * using the shared ecosystem + company raise profile (happy marriage).
 */

import { assertCompanyInOrg } from '@/lib/kyi-org'
import {
  searchGlobalInvestors,
  suggestGlobalInvestorsForCompany,
  type KYIGlobalInvestor,
} from '@/lib/kyi-ecosystem'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

function requireSupabase(): void {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured')
}

export type KyiIntelQuestionId =
  | 'funds_like_ours'
  | 'specialize_industry'
  | 'long_term'
  | 'market_experience'
  | 'best_match_strategy'

export interface KyiIntelQuestion {
  id: KyiIntelQuestionId
  prompt: string
  description: string
}

/** Exact prompts from the KYI 2.0 write-up future vision section */
export const KYI_INTEL_QUESTIONS: KyiIntelQuestion[] = [
  {
    id: 'funds_like_ours',
    prompt: 'Which investors are actively funding companies like ours?',
    description: 'Stage + sector overlap with your raise profile, weighted by platform coverage.',
  },
  {
    id: 'specialize_industry',
    prompt: 'Which firms specialize in our industry?',
    description: 'Thesis/industry categories and investment focus matching your company industry.',
  },
  {
    id: 'long_term',
    prompt: 'Which investors focus on long-term partnerships?',
    description: 'Horizon category: Long-Term Investors.',
  },
  {
    id: 'market_experience',
    prompt: 'Which investors have experience in our market?',
    description: 'Geography + industry signals from the shared directory.',
  },
  {
    id: 'best_match_strategy',
    prompt: 'Which investors best match our fundraising strategy?',
    description: 'Full match score from raise stage, preferred types, and sectors.',
  },
]

export interface KyiIntelAnswerRow extends KYIGlobalInvestor {
  match_score: number
  match_reasons: string[]
}

export interface KyiIntelAnswer {
  question: KyiIntelQuestion
  results: KyiIntelAnswerRow[]
}

async function loadCompanyContext(companyId: number) {
  const { data } = await supabase
    .from('kyi_companies')
    .select('name, industry, location, raise_stage, preferred_investor_types, sector_tags')
    .eq('id', companyId)
    .maybeSingle()
  return {
    name: (data?.name as string) ?? '',
    industry: (data?.industry as string) ?? '',
    location: (data?.location as string) ?? '',
    raise_stage: (data?.raise_stage as string) ?? '',
    preferred: Array.isArray(data?.preferred_investor_types)
      ? (data!.preferred_investor_types as string[])
      : [],
    sector_tags: Array.isArray(data?.sector_tags) ? (data!.sector_tags as string[]) : [],
  }
}

function industrySlugHints(industry: string, sectors: string[]): string[] {
  const text = [industry, ...sectors].join(' ').toLowerCase()
  const slugs: string[] = []
  if (/\bai\b|artificial/.test(text)) slugs.push('ai')
  if (/health|bio|pharma/.test(text)) slugs.push('healthcare')
  if (/fintech|finance|payment/.test(text)) slugs.push('fintech')
  if (/real.?estate|proptech/.test(text)) slugs.push('real-estate')
  if (/manufactur/.test(text)) slugs.push('manufacturing')
  if (/consumer|retail|cpg/.test(text)) slugs.push('consumer-products')
  if (/esg|climate|sustain/.test(text)) slugs.push('esg-environmental')
  if (/tech|software|saas/.test(text)) slugs.push('technology')
  return slugs
}

export async function answerRaiseIntelQuestion(
  companyId: number,
  questionId: KyiIntelQuestionId,
  limit = 12,
): Promise<KyiIntelAnswer> {
  requireSupabase()
  await assertCompanyInOrg(companyId)
  const question = KYI_INTEL_QUESTIONS.find((q) => q.id === questionId)
  if (!question) throw new Error('Unknown question')

  const ctx = await loadCompanyContext(companyId)
  const industrySlugs = industrySlugHints(ctx.industry, ctx.sector_tags)

  let results: KyiIntelAnswerRow[] = []

  if (questionId === 'best_match_strategy' || questionId === 'funds_like_ours') {
    const suggested = await suggestGlobalInvestorsForCompany(companyId, limit)
    results = suggested.map((s) => ({
      ...s,
      match_reasons:
        questionId === 'funds_like_ours'
          ? [
              ...(ctx.raise_stage ? [`Raise stage: ${ctx.raise_stage}`] : []),
              ...s.match_reasons,
            ].slice(0, 4)
          : s.match_reasons,
    }))
  } else if (questionId === 'long_term') {
    const res = await searchGlobalInvestors({
      categorySlugs: ['long-term'],
      companyId,
      limit,
    })
    results = res.investors
      .filter((i) => !i.associated_for_company)
      .map((i) => ({
        ...i,
        match_score: 20 + (i.tracked_by_org_count ?? 0) * 3,
        match_reasons: ['Long-Term Investors category', ...(i.investment_focus ? [i.investment_focus] : [])],
      }))
  } else if (questionId === 'specialize_industry') {
    const res = await searchGlobalInvestors({
      categorySlugs: industrySlugs.slice(0, 3),
      query: ctx.industry || ctx.sector_tags[0] || undefined,
      companyId,
      limit: limit * 2,
    })
    results = res.investors
      .filter((i) => !i.associated_for_company)
      .map((i) => {
        const reasons: string[] = []
        let score = (i.tracked_by_org_count ?? 0) * 2
        const focus = `${i.industry ?? ''} ${i.investment_focus ?? ''}`.toLowerCase()
        if (ctx.industry && focus.includes(ctx.industry.toLowerCase())) {
          score += 15
          reasons.push(`Industry: ${ctx.industry}`)
        }
        for (const c of i.categories ?? []) {
          if (industrySlugs.includes(c.slug)) {
            score += 10
            reasons.push(c.label)
          }
        }
        if (reasons.length === 0) reasons.push('Directory industry match')
        return { ...i, match_score: score, match_reasons: reasons.slice(0, 4) }
      })
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, limit)
  } else {
    // market_experience
    const locToken = ctx.location.split(',')[0]?.trim() || ''
    const res = await searchGlobalInvestors({
      query: [ctx.industry, locToken].filter(Boolean).join(' ') || undefined,
      categorySlugs: industrySlugs.slice(0, 2),
      companyId,
      limit: limit * 2,
    })
    results = res.investors
      .filter((i) => !i.associated_for_company)
      .map((i) => {
        const reasons: string[] = []
        let score = 0
        if (locToken && (i.location ?? '').toLowerCase().includes(locToken.toLowerCase())) {
          score += 12
          reasons.push(`Market: ${locToken}`)
        }
        if (ctx.industry && `${i.industry ?? ''}`.toLowerCase().includes(ctx.industry.toLowerCase())) {
          score += 10
          reasons.push(`Industry: ${ctx.industry}`)
        }
        score += (i.tracked_by_org_count ?? 0) * 3
        if (reasons.length === 0) reasons.push('Shared market signals')
        return { ...i, match_score: score, match_reasons: reasons.slice(0, 4) }
      })
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, limit)
  }

  return { question, results }
}

export async function answerAllRaiseIntel(
  companyId: number,
  limitPerQuestion = 5,
): Promise<KyiIntelAnswer[]> {
  const out: KyiIntelAnswer[] = []
  for (const q of KYI_INTEL_QUESTIONS) {
    out.push(await answerRaiseIntelQuestion(companyId, q.id, limitPerQuestion))
  }
  return out
}
