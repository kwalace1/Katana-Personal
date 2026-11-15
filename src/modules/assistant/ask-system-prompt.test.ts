import { describe, expect, it } from 'vitest'
import { KATANA_ASK_SYSTEM_PROMPT, resolveAskSystemPrompt } from '../../../api/ask-llm-core'

describe('Ask companion coach system prompt', () => {
  it('frames Ask as companion / accountability coach', () => {
    expect(KATANA_ASK_SYSTEM_PROMPT).toMatch(/companion and accountability coach/i)
    expect(KATANA_ASK_SYSTEM_PROMPT).toMatch(/ONE clear next move/)
    expect(KATANA_ASK_SYSTEM_PROMPT).toMatch(/held accountable/)
    expect(KATANA_ASK_SYSTEM_PROMPT).not.toMatch(/capable general assistant/)
  })

  it('appends the chosen personality overlay', () => {
    const tough = resolveAskSystemPrompt('tough')
    expect(tough).toContain(KATANA_ASK_SYSTEM_PROMPT)
    expect(tough).toMatch(/Tough love accountability coach/)
    expect(tough).toMatch(/That’s stalling/)

    const supportive = resolveAskSystemPrompt(null)
    expect(supportive).toMatch(/Supportive companion coach/)
  })
})
