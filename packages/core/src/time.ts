/** Time-zone aware helpers built on Intl only (pure, deterministic for a given instant). */

export const DEFAULT_TIME_ZONE = 'Europe/Berlin';
const DAY_MS = 86_400_000;

export type Weekday = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';
export const WEEKDAYS: readonly Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

export interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: Weekday;
  /** YYYY-MM-DD in the zone. */
  date: string;
  /** Minutes since local midnight. */
  minuteOfDay: number;
  /** UTC offset in minutes (e.g. +120 for CEST). */
  offsetMin: number;
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

const WD: Record<string, Weekday> = { Mon: 'MO', Tue: 'TU', Wed: 'WE', Thu: 'TH', Fri: 'FR', Sat: 'SA', Sun: 'SU' };
const pad = (n: number, w = 2): string => String(Math.abs(n)).padStart(w, '0');

export function localParts(ms: number, tz: string = DEFAULT_TIME_ZONE): LocalParts {
  const parts: Record<string, string> = {};
  for (const p of formatter(tz).formatToParts(new Date(ms))) parts[p.type] = p.value;
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const second = Number(parts.second);
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const offsetMin = Math.round((asUtc - (ms - (ms % 1000 + 1000) % 1000)) / 60_000);
  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    weekday: WD[parts.weekday ?? 'Mon'] ?? 'MO',
    date: `${year}-${pad(month)}-${pad(day)}`,
    minuteOfDay: hour * 60 + minute,
    offsetMin,
  };
}

/** ISO-8601 with the zone's offset, e.g. `2026-10-16T07:45:00+02:00` (README §4). */
export function toZonedIso(ms: number, tz: string = DEFAULT_TIME_ZONE): string {
  const p = localParts(ms, tz);
  const sign = p.offsetMin < 0 ? '-' : '+';
  const off = `${sign}${pad(Math.floor(Math.abs(p.offsetMin) / 60))}:${pad(Math.abs(p.offsetMin) % 60)}`;
  return `${p.date}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}${off}`;
}

/** Local wall-clock time "HH:MM" → minutes since midnight. */
export function parseHm(hm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm);
  if (!m) throw new Error(`invalid time ${hm}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Epoch ms of a local wall-clock time on a local date in `tz`.
 * Times that don't exist (DST gap) are shifted forward by the gap length (Temporal "compatible").
 */
export function zonedTimeToMs(date: string, minuteOfDay: number, tz: string = DEFAULT_TIME_ZONE): number {
  const [y, mo, d] = date.split('-').map(Number) as [number, number, number];
  const naive = Date.UTC(y, mo - 1, d, Math.floor(minuteOfDay / 60), minuteOfDay % 60);
  // Two passes converge for all real-world zones, including across DST switches.
  let guess = naive - localParts(naive, tz).offsetMin * 60_000;
  guess = naive - localParts(guess, tz).offsetMin * 60_000;
  const back = localParts(guess, tz);
  if (back.date === date && back.minuteOfDay === minuteOfDay) return guess;
  // In a DST gap: interpret with the pre-gap offset, which lands after the gap.
  const after = naive - localParts(guess + 3_600_000, tz).offsetMin * 60_000;
  return Math.max(guess, after);
}

/**
 * Epoch ms of a date-time string: ISO with offset (`…+02:00`, `…Z`) as is, or a local wall-clock
 * time without offset (`2026-10-16T07:45`, as from `<input type="datetime-local">`) in `tz`.
 * Returns null for anything else.
 */
export function parseDateTimeInZone(s: string, tz: string = DEFAULT_TIME_ZONE): number | null {
  const local = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(s);
  if (local) {
    const [, date, h, m, sec] = local as unknown as [string, string, string, string, string | undefined];
    if (Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || +h > 23 || +m > 59) return null;
    return zonedTimeToMs(date, +h * 60 + +m, tz) + (sec ? +sec * 1000 : 0);
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(s)) return null;
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? null : ms;
}

/** Calendar days from date `a` to date `b` (YYYY-MM-DD), negative if b < a. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Local date (YYYY-MM-DD) of an ISO timestamp, in its own offset. */
export function isoLocalDate(iso: string): string {
  return iso.slice(0, 10);
}

export type TimeOfDay = 'early' | 'morning' | 'midday' | 'afternoon' | 'evening';
export const TIMES_OF_DAY: readonly TimeOfDay[] = ['early', 'morning', 'midday', 'afternoon', 'evening'];

/** Buckets from README §4.3: early <07, morning 07–11, midday 11–14, afternoon 14–18, evening ≥18. */
export function timeOfDayAt(hour: number): TimeOfDay {
  if (hour < 7) return 'early';
  if (hour < 11) return 'morning';
  if (hour < 14) return 'midday';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

/** Hour of the wall-clock time written in an ISO timestamp with offset. */
export function isoLocalHour(iso: string): number {
  return Number(iso.slice(11, 13));
}
