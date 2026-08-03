import { describe, expect, it } from 'vitest'
import { detectAnswerFlags, hasDuplicatedAnswerBlock, isDefect } from './detect-flags'

// Condensed from the real audit row 2016a84e (2026-07-09): a truncated first
// generation continued, then a second generation restated the whole answer in
// different formatting, glued mid-line with a single space.
const HUB_INCIDENT_ANSWER = [
  'The',
  '',
  ' Project Management (PM) module in Katana is where teams plan and track their work, including tasks, milestones, and sprints. It\'s designed to function similarly to tools like Asana or Monday, but integrated directly into Katana.',
  '',
  'Here\'s a breakdown of its key features:',
  '',
  '*   **Work Planning:** You can create and manage tasks, milestones, files, and sprints within projects.',
  '*   **Visibility:** Assigned tasks appear in the assignee\'s Launchpad feed.',
  '*   **Portfolio Stats:** Provides a quick overview of active projects, upcoming deadlines, and involved team members.',
  '*   **Import Projects:** Supports importing projects from CSV or templates, with a recommendation to verify assignees and dates after import. The Project Management (PM) module in Katana is where teams plan and track their work, including tasks, milestones, and sprints. It functions similarly to tools like Asana or Monday, but integrated directly into Katana.',
  '',
  '**Key features:**',
  '',
  '- **Work Planning:** Create and manage tasks, milestones, files, and sprints within projects',
  '- **Visibility:** Assigned tasks appear in the assignee\'s Launchpad feed',
  '- **Portfolio Stats:** Quick overview of active projects, upcoming deadlines, and involved team members',
  '- **Import:** Supports importing projects from CSV or templates',
].join('\n')

describe('hasDuplicatedAnswerBlock', () => {
  it('flags the Hub duplicated-answer incident artifact (reformatted restate)', () => {
    expect(hasDuplicatedAnswerBlock(HUB_INCIDENT_ANSWER)).toBe(true)
  })

  it('does not flag a normal single answer', () => {
    const answer = [
      'The Project Management (PM) module in Katana is where teams plan and track their work.',
      '',
      '*   **Work Planning:** Create and manage tasks, milestones, files, and sprints.',
      '*   **Visibility:** Assigned tasks appear in the assignee\'s Launchpad feed.',
      '*   **Import Projects:** Supports importing from CSV or templates.',
    ].join('\n')
    expect(hasDuplicatedAnswerBlock(answer)).toBe(false)
  })

  it('does not flag short answers', () => {
    expect(hasDuplicatedAnswerBlock('We currently have **5** active employees.')).toBe(false)
  })

  it('does not flag legitimate structured multi-module answers', () => {
    const answer = [
      '**Headcount:** We currently have **5** active employees across 3 departments.',
      '',
      '**Open Support Tickets:** There are **12** open tickets, 4 of which are high priority.',
      '',
      '**Inventory:** 3 items are currently below their low-stock threshold.',
    ].join('\n')
    expect(hasDuplicatedAnswerBlock(answer)).toBe(false)
  })

  it('does not flag a long intro followed by a uniform per-module refrain (sparse-org shape)', () => {
    const answer = [
      'I checked every module you have access to in Katana and gathered the current state of the data for your organization. Most modules are still waiting on their first records, which is expected for a workspace that was set up recently. Here is the module-by-module breakdown so you can see exactly where things stand today.',
      '',
      '**CRM:** No records have been added to this module yet.',
      '**Finance:** No records have been added to this module yet.',
      '**Inventory:** No records have been added to this module yet.',
      '**Support:** No records have been added to this module yet.',
    ].join('\n')
    expect(hasDuplicatedAnswerBlock(answer)).toBe(false)
  })

  it('does not flag task rows sharing a boilerplate suffix after a long intro', () => {
    const answer = [
      'Here are the open tasks across your active projects, pulled from the project management module just now. I grouped them by project and included the assignee where one is set, so you can quickly spot anything that needs scheduling attention before the end of the week.',
      '',
      '- Draft Q3 budget review — no due date set for this task',
      '- Update onboarding checklist — no due date set for this task',
      '- Renew vendor contract — no due date set for this task',
    ].join('\n')
    expect(hasDuplicatedAnswerBlock(answer)).toBe(false)
  })
})

describe('detectAnswerFlags + isDefect', () => {
  it('marks a duplicated answer as a defect', () => {
    const flags = detectAnswerFlags(HUB_INCIDENT_ANSWER)
    expect(flags.duplicate_answer).toBe(true)
    expect(isDefect(flags)).toBe(true)
  })

  it('keeps a clean answer defect-free', () => {
    const flags = detectAnswerFlags('We currently have **5** active employees.')
    expect(flags.duplicate_answer).toBe(false)
    expect(isDefect(flags)).toBe(false)
  })

  it('flags competitor product mentions as a defect (Katana-only rule)', () => {
    // The exact phrasing the Hub used on 2026-07-11.
    const flags = detectAnswerFlags(
      "The Katana PM (Project Management) module is where teams plan and track their work. It's designed to be similar to tools like Asana or Monday, but it's built right into Katana.",
    )
    expect(flags.competitor_mention).toBe(true)
    expect(isDefect(flags)).toBe(true)
  })

  it('does not flag org data containing ambiguous everyday words', () => {
    // "monday" (weekday), "notion", "linear", "teams" are excluded from the
    // blocklist precisely because they collide with normal business language.
    const flags = detectAnswerFlags(
      'The kickoff is scheduled for Monday. The team\'s notion of done is linear: 3 teams review, then ship. Deal "Xerox renewal" closed at $12,000.',
    )
    expect(flags.competitor_mention).toBe(false)
    expect(isDefect(flags)).toBe(false)
  })
})
