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
