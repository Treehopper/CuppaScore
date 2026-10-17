import { i18n } from './i18n.svelte';

// ---------- formatting (Intl; 24-h clock in all four languages) ----------

export function fmtDate(iso: string | number, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  return new Intl.DateTimeFormat(i18n.intl, opts).format(new Date(iso));
}

export function fmtTime(iso: string | number): string {
  return new Intl.DateTimeFormat(i18n.intl, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}

export function fmtDateTime(iso: string | number): string {
  return new Intl.DateTimeFormat(i18n.intl, { dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23' }).format(new Date(iso));
}

export function fmtNumber(n: number, opts: Intl.NumberFormatOptions = { maximumFractionDigits: 1 }): string {
  return new Intl.NumberFormat(i18n.intl, opts).format(n);
}

export function fmtMoney(eur: number): string {
  return new Intl.NumberFormat(i18n.intl, { style: 'currency', currency: 'EUR' }).format(eur);
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 86400],
  ['month', 30 * 86400],
  ['week', 7 * 86400],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
];

/** "vor 3 Tagen", "hace 3 días" … */
export function fmtRelative(iso: string | number, nowMs: number): string {
  const diffS = (new Date(iso).getTime() - nowMs) / 1000;
  const rtf = new Intl.RelativeTimeFormat(i18n.intl, { numeric: 'auto' });
  for (const [unit, s] of UNITS) if (Math.abs(diffS) >= s) return rtf.format(Math.round(diffS / s), unit);
  return rtf.format(0, 'minute');
}

const WEEKDAY_INDEX = { MO: 0, TU: 1, WE: 2, TH: 3, FR: 4, SA: 5, SU: 6 } as const;

/** "Mo", "Lun", "Mon" … for a weekday key (2026-10-12 is a Monday). */
export function fmtWeekday(key: keyof typeof WEEKDAY_INDEX, style: 'short' | 'long' = 'short'): string {
  return new Intl.DateTimeFormat(i18n.intl, { weekday: style, timeZone: 'UTC' }).format(
    Date.UTC(2026, 9, 12 + WEEKDAY_INDEX[key]),
  );
}

/** "Sat 11:30" / "today 10:00"-style next time: weekday + time unless it is today. */
export function fmtNextTime(iso: string, nowMs: number): string {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date(nowMs).toDateString();
  return new Intl.DateTimeFormat(i18n.intl, {
    ...(sameDay ? {} : { weekday: 'short', day: 'numeric', month: 'short' }),
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(d);
}
