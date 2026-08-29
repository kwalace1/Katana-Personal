import type { ExternalCalendarEvent } from './types';
/** Minimal ICS parser — VEVENT blocks with SUMMARY, DTSTART, DTEND, UID. */
export declare function parseIcsEvents(icsText: string): ExternalCalendarEvent[];
export declare function filterEventsInWindow(events: ExternalCalendarEvent[], timeMin: string, timeMax: string): ExternalCalendarEvent[];
