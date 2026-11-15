/** Ask / Accountability coach personality modes. */

export const ASK_PERSONALITIES = [
  {
    id: 'supportive',
    label: 'Supportive',
    blurb: 'Warm companion. Keeps you moving.',
  },
  {
    id: 'tough',
    label: 'Tough love',
    blurb: 'Direct coach. No pep-talk fluff.',
  },
  {
    id: 'dry',
    label: 'Dry humor',
    blurb: 'Deadpan companion. Still accountable.',
  },
  {
    id: 'spicy',
    label: 'Spicy',
    blurb: 'Playful roast. Honest next step.',
  },
] as const

export type AskPersonality = (typeof ASK_PERSONALITIES)[number]['id']

export function parseAskPersonality(prefs: Record<string, unknown> | undefined): AskPersonality {
  const raw = prefs?.ask_personality
  if (raw === 'supportive' || raw === 'tough' || raw === 'dry' || raw === 'spicy') return raw
  return 'supportive'
}

/**
 * Overlay for rules-path / local coach copy.
 * Keep aligned with PERSONALITY_OVERLAY in api/ask-llm-core.ts (LLM path).
 */
export function personalitySystemOverlay(mode: AskPersonality): string {
  switch (mode) {
    case 'tough':
      return `Personality — Tough love accountability coach:
- Sound like a sharp training partner, not a therapist brochure.
- Direct and a little blunt. Skip soft openers.
- Call out avoidance firmly (“That’s stalling. Pick one.”).
- Celebrate only when they actually did the thing.
- Always end with one clear next move.`
    case 'dry':
      return `Personality — Dry humor companion:
- Understated wit. Deadpan ok. Never try-hard or meme-speak.
- Treat their day like a slightly absurd project you respect.
- One joke max per reply, then the next step.
- Keep advice concrete under the humor.`
    case 'spicy':
      return `Personality — Spicy accountability companion:
- Light sarcasm about procrastination and “I’ll do it later.”
- Roast the excuse, never the person.
- Keep it playful; stop before cruelty.
- Always redeem with a clear next step.`
    case 'supportive':
    default:
      return `Personality — Supportive companion coach:
- Warm, human, slightly witty — like a sharp friend who texts back fast.
- Celebrate small wins without being syrupy.
- Name the friction, then make the next step feel doable.
- Prefer “we” lightly (“Let’s knock this out”) when it fits.
- Avoid corporate wellness speak (“leverage,” “optimize your day”).`
  }
}

export function coachGreeting(mode: AskPersonality, name: string, hour = new Date().getHours()): string {
  const slot = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
  switch (mode) {
    case 'tough':
      return slot === 'morning'
        ? `${name} — morning. What’s getting done first?`
        : slot === 'afternoon'
          ? `${name}. Midday check: are we still on the thing that matters?`
          : `${name}. Evening. Finish one thing or close the day — pick.`
    case 'dry':
      return slot === 'morning'
        ? `Morning, ${name}. The day has begun, regrettably. Let’s make it count.`
        : slot === 'afternoon'
          ? `Afternoon, ${name}. Still time to look intentional.`
          : `Evening, ${name}. Dramatic lighting optional. Progress preferred.`
    case 'spicy':
      return slot === 'morning'
        ? `${name}. New day, same brain that said “tomorrow.” Shall we surprise it?`
        : slot === 'afternoon'
          ? `${name}. Halfway through — still “warming up,” or…?`
          : `${name}. Night’s coming. Close something before the excuses clock out.`
    case 'supportive':
    default:
      return slot === 'morning'
        ? `Morning, ${name}. I’m with you — what’s the one move?`
        : slot === 'afternoon'
          ? `Hey ${name}. Let’s reset the afternoon with one clear step.`
          : `Hey ${name}. Soft landing or one last win — your call.`
  }
}

export function coachFollowUp(mode: AskPersonality, result: string): string {
  switch (mode) {
    case 'tough':
      return `${result} Good. Next.`
    case 'dry':
      return `${result} Miracles do happen. What’s next?`
    case 'spicy':
      return `${result} Look at you, doing the thing. Don’t let it go to your head — what’s next?`
    case 'supportive':
    default:
      return `${result} Nice. What’s next?`
  }
}

export function coachThinkingLabel(mode: AskPersonality): string {
  switch (mode) {
    case 'tough':
      return 'Looking at your plate…'
    case 'dry':
      return 'Consulting the evidence…'
    case 'spicy':
      return 'Judging lightly…'
    case 'supportive':
    default:
      return 'Thinking with you…'
  }
}

export function coachPlaceholder(mode: AskPersonality): string {
  switch (mode) {
    case 'tough':
      return 'What’s actually getting done?'
    case 'dry':
      return 'Ask me something useful…'
    case 'spicy':
      return 'Confess the plan… or the avoidance'
    case 'supportive':
    default:
      return 'Ask about your day, or “add gym tomorrow”…'
  }
}

/** When Katana lacks life data — personality-aware nudge to share more. */
export function coachShareMoreNudge(
  mode: AskPersonality,
  name: string,
  gaps: { label: string; reason: string }[],
): string {
  if (gaps.length === 0) return ''
  const missing = gaps
    .slice(0, 3)
    .map((g) => g.label.toLowerCase())
    .join(', ')
  const lead =
    gaps.length >= 4
      ? 'I’m mostly flying blind'
      : gaps.length >= 2
        ? 'I don’t have much to work with'
        : 'I’m light on context'

  switch (mode) {
    case 'tough':
      return `${lead}, ${name} — no ${missing}. Share more in Katana or I can’t map your day. Log it, connect it, or tell me here.`
    case 'dry':
      return `${lead}. ${missing} would help. The more you put in Katana, the less I have to pretend I’m psychic.`
    case 'spicy':
      return `${lead} — fascinating strategy. No ${missing}, though. Connect a calendar, log sleep, add a habit… communicate with me so I can actually orchestrate your day.`
    case 'supportive':
    default:
      return `${lead} — I’m missing ${missing}. The more you share (habits, calendar, sleep, journal), the better I can map your day and suggest what’s next.`
  }
}

/** LLM instruction when context is sparse. */
export function shareMoreLlmHint(gapLabels: string[]): string {
  if (gapLabels.length === 0) return ''
  return `\n\nContext note: The user's Katana data is sparse (missing: ${gapLabels.join(', ')}). In your personality voice, include one short sentence encouraging them to log or connect more — habits, calendar, sleep, journal, or integrations — so you can orchestrate their day better. Do not scold; be specific about what's missing.`
}

/** Swap the stock greeting line in a rules briefing for personality. */
export function flavorBriefingText(mode: AskPersonality, text: string, name: string): string {
  const hour = new Date().getHours()
  const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const stock = new RegExp(`^${hello},\\s*${escapeReg(name)}\\.\\s*`, 'i')
  if (stock.test(text)) {
    return text.replace(stock, `${coachGreeting(mode, name, hour)} `)
  }
  return `${coachGreeting(mode, name, hour)} ${text}`
}

function escapeReg(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
