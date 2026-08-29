import { describe, expect, it } from 'vitest'
import { parseIcsEvents, filterEventsInWindow } from './ics-parse'

describe('ics-parse', () => {
  it('parses a simple VEVENT', () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:abc123
SUMMARY:Team standup
DTSTART:20260829T150000Z
DTEND:20260829T153000Z
DESCRIPTION:Daily sync
LOCATION:Zoom
END:VEVENT
END:VCALENDAR`
    const events = parseIcsEvents(ics)
    expect(events).toHaveLength(1)
    expect(events[0]?.title).toBe('Team standup')
    expect(events[0]?.external_id).toBe('abc123')
    expect(events[0]?.location).toBe('Zoom')
  })

  it('filters events to sync window', () => {
    const events = [
      {
        external_id: '1',
        title: 'In range',
        notes: '',
        starts_at: '2026-08-29T15:00:00.000Z',
        ends_at: '2026-08-29T16:00:00.000Z',
        all_day: false,
        location: '',
      },
      {
        external_id: '2',
        title: 'Far future',
        notes: '',
        starts_at: '2027-01-01T15:00:00.000Z',
        ends_at: '2027-01-01T16:00:00.000Z',
        all_day: false,
        location: '',
      },
    ]
    const filtered = filterEventsInWindow(
      events,
      '2026-08-01T00:00:00.000Z',
      '2026-09-30T00:00:00.000Z',
    )
    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.title).toBe('In range')
  })
})
