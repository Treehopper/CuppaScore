import type { ReminderRule } from './reminders';
import type { Weekday } from './time';

/**
 * `.ics` export of one fixed-time reminder rule for the phone's calendar (README §3 F8, §9.1).
 * The calendar fires unconditionally, since it can't know whether a cup was logged. Times are
 * *floating* (no time zone), so "10:00" stays 10:00 wherever you are, like the in-app rules (F7).
 */

export interface IcsOptions {
  /** stable id, e.g. `${ruleId}@cuplog` */
  uid: string;
  /** creation instant (epoch ms), DTSTAMP */
  now: number;
  /** first date YYYY-MM-DD */
  startDate: string;
  title: string;
  description?: string;
  /** event length in minutes */
  durationMin?: number;
}

type TimedRule = Extract<ReminderRule, { time: string }>;

const DAY_CODES: Record<Weekday, string> = { MO: 'MO', TU: 'TU', WE: 'WE', TH: 'TH', FR: 'FR', SA: 'SA', SU: 'SU' };

/** RFC 5545 text escaping. */
export function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** UTF-8 length of one code point. */
function utf8Bytes(ch: string): number {
  const cp = ch.codePointAt(0)!;
  return cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
}

/** Folds lines longer than 75 octets (UTF-8) with CRLF + space, never splitting a character. */
export function icsFold(line: string): string {
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const n = utf8Bytes(ch);
    const limit = out.length === 0 ? 75 : 74; // continuation lines start with a space
    if (bytes + n > limit) {
      out.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const utcStamp = (ms: number): string => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export function reminderIcs(rule: TimedRule, o: IcsOptions): string {
  const days = 'days' in rule ? rule.days : 'all';
  const rrule = days === 'all' ? 'RRULE:FREQ=DAILY' : `RRULE:FREQ=WEEKLY;BYDAY=${days.map((d) => DAY_CODES[d]).join(',')}`;
  const start = `${o.startDate.replace(/-/g, '')}T${rule.time.replace(':', '')}00`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CupLog//Reminders//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${o.uid}`,
    `DTSTAMP:${utcStamp(o.now)}`,
    `DTSTART:${start}`,
    `DURATION:PT${o.durationMin ?? 5}M`,
    rrule,
    `SUMMARY:${icsEscape(o.title)}`,
    ...(o.description ? [`DESCRIPTION:${icsEscape(o.description)}`] : []),
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsEscape(o.title)}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(icsFold).join('\r\n') + '\r\n';
}
