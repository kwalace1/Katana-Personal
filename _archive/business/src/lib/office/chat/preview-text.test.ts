import { describe, expect, it } from 'vitest'
import { toPreviewText } from './preview-text'

describe('toPreviewText', () => {
  it('strips bold markers', () => {
    expect(toPreviewText('There are **5** active employees')).toBe('There are 5 active employees')
  })

  it('strips list markers and inline bold (the real roster preview case)', () => {
    const md = 'You have the following **5 active projects**:\n*   **Pilot roll out**\n*   **Katana Agentic AI**'
    expect(toPreviewText(md)).toBe('You have the following 5 active projects: Pilot roll out Katana Agentic AI')
  })

  it('strips an unbalanced/leftover asterisk', () => {
    expect(toPreviewText('We currently have **5*5** employees')).toBe('We currently have 55 employees')
  })

  it('strips inline code and links', () => {
    expect(toPreviewText('Run `execute_sql` — see [docs](https://x.com/y)')).toBe('Run execute_sql — see docs')
  })

  it('strips headings and blockquotes', () => {
    expect(toPreviewText('# Overview\n> note')).toBe('Overview note')
  })

  it('collapses whitespace and trims', () => {
    expect(toPreviewText('  a\n\n  b   c ')).toBe('a b c')
  })

  it('handles empty / null input', () => {
    expect(toPreviewText('')).toBe('')
    expect(toPreviewText(null)).toBe('')
    expect(toPreviewText(undefined)).toBe('')
  })

  it('leaves plain text untouched', () => {
    expect(toPreviewText('Katana Finance module expert')).toBe('Katana Finance module expert')
  })
})
