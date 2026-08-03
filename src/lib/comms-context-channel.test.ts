import { describe, expect, it } from 'vitest'
import {
  buildContextChannelMarker,
  contextRecordPath,
  parseContextChannelMarker,
} from './comms-api'

describe('context channel markers', () => {
  it('builds and parses durable project markers', () => {
    const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    const marker = buildContextChannelMarker('project', id)
    expect(marker).toBe(`katana-context:project:${id}`)

    const parsed = parseContextChannelMarker(
      `${marker} Module discussion for project ${id}`
    )
    expect(parsed).toEqual({ contextType: 'project', contextId: id })
  })

  it('maps project context to project detail path', () => {
    expect(contextRecordPath('project', 'abc')).toBe('/projects/abc')
    expect(contextRecordPath('job', 'x')).toBe('/workforce')
  })

  it('returns null for unknown descriptions', () => {
    expect(parseContextChannelMarker(null)).toBeNull()
    expect(parseContextChannelMarker('General chat')).toBeNull()
  })
})
