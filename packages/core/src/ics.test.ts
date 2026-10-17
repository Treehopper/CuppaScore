import { describe, expect, it } from 'vitest';
import { icsEscape, icsFold, reminderIcs } from './ics';

const opts = { uid: 'rem_1@cuplog', now: Date.parse('2026-10-16T06:00:00Z'), startDate: '2026-10-17', title: 'Rate your coffee ☕' };

describe('reminderIcs', () => {
  it('weekly rule with BYDAY, floating local time and an alarm', () => {
    const ics = reminderIcs({ id: 'rem_1', kind: 'nothingLoggedBy', time: '10:00', days: ['MO', 'TU', 'WE', 'TH', 'FR'], enabled: true }, opts);
    const lines = ics.split('\r\n');
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines).toContain('DTSTART:20261017T100000');
    expect(lines).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR');
    expect(lines).toContain('DTSTAMP:20261016T060000Z');
    expect(lines).toContain('UID:rem_1@cuplog');
    expect(lines).toContain('TRIGGER:PT0M');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/);
  });

  it('daily rule', () => {
    const ics = reminderIcs({ id: 'rem_5', kind: 'fixedDaily', time: '20:00', days: 'all', enabled: true }, opts);
    expect(ics).toContain('RRULE:FREQ=DAILY\r\n');
    expect(ics).toContain('DTSTART:20261017T200000\r\n');
  });

  it('escapes text and folds long lines', () => {
    expect(icsEscape('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
    const long = `SUMMARY:${'é'.repeat(60)}`;
    const folded = icsFold(long);
    // only ASCII and 2-byte "é" here
    const bytes = (p: string) => [...p].reduce((n, ch) => n + (ch.charCodeAt(0) < 0x80 ? 1 : 2), 0);
    for (const part of folded.split('\r\n')) expect(bytes(part)).toBeLessThanOrEqual(75);
    expect(folded.split('\r\n').length).toBeGreaterThan(1);
    expect(folded.replace(/\r\n /g, '')).toBe(long);
  });
});
