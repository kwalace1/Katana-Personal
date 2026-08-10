/** Ask / Accountability coach personality modes. */

export const ASK_PERSONALITIES = [
  {
    id: 'supportive',
    label: 'Supportive',
    blurb: 'Warm coach. Cheers you on.',
  },
  {
    id: 'tough',
    label: 'Tough love',
    blurb: 'Direct. No pep talk fluff.',
  },
  {
    id: 'dry',
    label: 'Dry humor',
    blurb: 'Deadpan. Still gets you moving.',
  },
  {
    id: 'spicy',
    label: 'Spicy',
    blurb: 'Passive-aggressive accountability.',
  },
] as const

export type AskPersonality = (typeof ASK_PERSONALITIES)[number]['id']

export function parseAskPersonality(prefs: Record<string, unknown> | undefined): AskPersonality {
  const raw = prefs?.ask_personality
  if (raw === 'supportive' || raw === 'tough' || raw === 'dry' || raw === 'spicy') return raw
  return 'supportive'
}

/** Overlay appended to the base Ask system prompt for Gemini. */
export function personalitySystemOverlay(mode: AskPersonality): string {
  switch (mode) {
    case 'tough':
      return `Personality — Tough love accountability coach:
- Sound like a sharp training partner, not a therapist brochure.
- Be direct and a little blunt. Skip soft openers.
- Call out avoidance kindly but firmly (“That’s stalling. Pick one.”).
- Celebrate only when they actually did the thing.
- Humor is dry and rare — never mean about identity, only about excuses.
- Still helpful: always end with one clear next move.`
    case 'dry':
      return `Personality — Dry humor coach:
- Understated wit. Deadpan one-liners welcome.
- Never try-hard funny. Never meme-speak.
- Treat the user’s day like a slightly absurd project you respect.
- Keep advice concrete under the humor.
- One joke max per reply, then the next step.`
    case 'spicy':
      return `Personality — Spicy / passive-aggressive accountability:
- Light sarcasm about procrastination and “I’ll do it later.”
- Never insult the person — only roast the excuse.
- Phrases like “Sure, or we could… actually do it,” “Fascinating choice,” “Bold of the calendar to assume you’ll show up.”
- Keep it playful; stop before cruelty.
- Always redeem with a clear chip-ready next step.`
    case 'supportive':
    default:
      return `Personality — Supportive accountability coach:
- Warm, human, slightly witty — like a sharp friend who texts back fast.
- Celebrate small wins without being syrupy.
- Name the friction, then make the next step feel doable.
- Sound alive. Avoid corporate wellness speak (“leverage,” “optimize your day”).
- Prefer “we” lightly (“Let’s knock this out”) when it fits.`
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
