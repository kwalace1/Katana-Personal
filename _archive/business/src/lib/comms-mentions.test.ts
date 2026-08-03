import { describe, expect, it } from 'vitest'
import { parseMentionTokens, contextRecordPath } from './comms-api'

describe('parseMentionTokens', () => {
  it('extracts user tokens and channel', () => {
    const tokens = parseMentionTokens('Hey @Alex Smith and @channel please look')
    expect(tokens).toContain('Alex Smith')
    expect(tokens).toContain('channel')
  })

  it('returns empty for plain text', () => {
    expect(parseMentionTokens('no mentions here')).toEqual([])
  })
})

describe('contextRecordPath', () => {
  it('maps project to detail path', () => {
    expect(contextRecordPath('project', 'abc')).toBe('/projects/abc')
  })
})
