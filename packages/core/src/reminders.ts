import { z } from 'zod';
import { IsoDate, IsoDateTime } from './record';
import { SUGGESTED_REMINDER_RULES } from './vocab';
import { addDays, DEFAULT_TIME_ZONE, localParts, parseHm, toZonedIso, WEEKDAYS, zonedTimeToMs, type Weekday } from './time';

/**
 * On-device reminders (README §4.7, §12): pure rule evaluation, no I/O and no timers.
 * All instants are epoch ms; wall-clock times ("HH:MM") and dates are in `cfg.timeZone`.
 */

const Hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const WeekdayEnum = z.enum(WEEKDAYS as [Weekday, ...Weekday[]]);
const Days = z.union([z.literal('all'), z.array(WeekdayEnum).min(1)]).default('all');
const RuleBase = { id: z.string().min(1).max(64), enabled: z.boolean().default(true) };

export const ReminderRule = z.discriminatedUnion('kind', [
  z.object({ ...RuleBase, kind: z.literal('nothingLoggedBy'), time: Hm, days: Days }),
  z.object({ ...RuleBase, kind: z.literal('fewerThanBy'), count: z.number().int().min(1).max(20), time: Hm, days: Days }),
  z.object({
    ...RuleBase,
    kind: z.literal('afterLastLog'),
    hours: z.number().min(0.25).max(24),
    window: z.object({ from: Hm, to: Hm }).default({ from: '08:00', to: '18:00' }),
    days: Days,
  }),
  z.object({ ...RuleBase, kind: z.literal('fixedDaily'), time: Hm, days: Days }),
  z.object({ ...RuleBase, kind: z.literal('bagExpiring'), daysBefore: z.number().int().min(0).max(60), time: Hm }),
]);
export type ReminderRule = z.infer<typeof ReminderRule>;
export type RuleKind = ReminderRule['kind'];

export const ReminderConfig = z.object({
  enabled: z.boolean().default(false),
  timeZone: z.string().min(1).max(64).default(DEFAULT_TIME_ZONE),
  quietHours: z.object({ from: Hm, to: Hm }).nullable().default(null),
  /** reminders resume on this local date */
  pausedUntil: IsoDate.nullable().default(null),
  rules: z.array(ReminderRule).max(50).default([]),
});
export type ReminderConfig = z.infer<typeof ReminderConfig>;

/** The README §4.7 / §9.1 suggestion offered on the welcome screen (only the weekday rule on). */
export const suggestedReminderRules = (): ReminderRule[] => z.array(ReminderRule).parse(SUGGESTED_REMINDER_RULES);

export interface Activity {
  /** latest cup, ISO */
  lastLoggedAt?: string;
  /** cups on the current local date in `cfg.timeZone` */
  cupsToday: number;
  /** open / unopened bags with an expiry date */
  expiringBags: { bagId: string; expiryDate: string }[];
}

export const RuleState = z.object({
  /** "Later": hidden until this instant */
  snoozedUntil: IsoDateTime.optional(),
  /** "Not today": hidden for this local date */
  dismissedOn: IsoDate.optional(),
  /** "Logged" / "Log now": occurrences due at or before this instant are done */
  handledAt: IsoDateTime.optional(),
});
export type RuleState = z.infer<typeof RuleState>;
export const ReminderState = z.record(z.string(), RuleState);
export type ReminderState = z.infer<typeof ReminderState>;

export interface DueReminder {
  ruleId: string;
  kind: RuleKind;
  /** when it became due (zoned ISO) */
  since: string;
  /** the rule's wall-clock time ("10:00"), for "your 10:00 reminder" */
  time: string;
  payload: { bagId?: string; daysLeft?: number; cupsToday?: number };
}

export type ReminderAction = 'logged' | 'later' | 'notToday';

export const SNOOZE_MS = 30 * 60_000;
/** Banner priority (README §12.3); bag expiry is shown as an extra line. */
export const KIND_PRIORITY: readonly RuleKind[] = ['nothingLoggedBy', 'fewerThanBy', 'afterLastLog', 'fixedDaily', 'bagExpiring'];

// ---------- helpers ----------

const weekdayOf = (date: string): Weekday => WEEKDAYS[(new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7]!;
const onDay = (days: 'all' | Weekday[], date: string): boolean => days === 'all' || days.includes(weekdayOf(date));
const at = (date: string, hm: string, tz: string): number => zonedTimeToMs(date, parseHm(hm), tz);

function inQuiet(cfg: ReminderConfig, ms: number): boolean {
  const q = cfg.quietHours;
  if (!q) return false;
  const m = localParts(ms, cfg.timeZone).minuteOfDay;
  const from = parseHm(q.from);
  const to = parseHm(q.to);
  if (from === to) return false;
  return from < to ? m >= from && m < to : m >= from || m < to;
}

/** First instant ≥ ms outside quiet hours (may be on a later local date). */
function afterQuiet(cfg: ReminderConfig, ms: number): number {
  if (!cfg.quietHours || !inQuiet(cfg, ms)) return ms;
  const p = localParts(ms, cfg.timeZone);
  const to = parseHm(cfg.quietHours.to);
  const date = p.minuteOfDay < to ? p.date : addDays(p.date, 1);
  return zonedTimeToMs(date, to, cfg.timeZone);
}

const paused = (cfg: ReminderConfig, date: string): boolean => !!cfg.pausedUntil && date < cfg.pausedUntil;

interface Occurrence {
  fire: number;
  /** last instant it may still be shown (inclusive), else end of day */
  until?: number;
  payload: DueReminder['payload'];
}

/**
 * When `rule` fires on local `date`, given the activity as known for that date. `today` tells
 * whether the activity counts (cup conditions reset on later days).
 */
function occurrence(rule: ReminderRule, date: string, act: Activity, today: boolean, tz: string): Occurrence | null {
  switch (rule.kind) {
    case 'nothingLoggedBy':
      if (!onDay(rule.days, date) || (today && act.cupsToday > 0)) return null;
      return { fire: at(date, rule.time, tz), payload: {} };
    case 'fewerThanBy': {
      const cups = today ? act.cupsToday : 0;
      if (!onDay(rule.days, date) || cups >= rule.count) return null;
      return { fire: at(date, rule.time, tz), payload: { cupsToday: cups } };
    }
    case 'fixedDaily':
      if (!onDay(rule.days, date)) return null;
      return { fire: at(date, rule.time, tz), payload: {} };
    case 'afterLastLog': {
      if (!act.lastLoggedAt || !onDay(rule.days, date)) return null;
      const target = Date.parse(act.lastLoggedAt) + rule.hours * 3_600_000;
      if (localParts(target, tz).date !== date) return null;
      const from = at(date, rule.window.from, tz);
      const to = at(date, rule.window.to, tz);
      const fire = Math.max(target, from);
      return fire <= to ? { fire, until: to, payload: {} } : null;
    }
    case 'bagExpiring': {
      const soon = act.expiringBags
        .map((b) => ({ ...b, daysLeft: Math.round((Date.parse(b.expiryDate) - Date.parse(date)) / 86_400_000) }))
        .filter((b) => b.daysLeft >= 0 && b.daysLeft <= rule.daysBefore)
        .sort((a, b) => a.daysLeft - b.daysLeft || a.bagId.localeCompare(b.bagId));
      const first = soon[0];
      if (!first) return null;
      return { fire: at(date, rule.time, tz), payload: { bagId: first.bagId, daysLeft: first.daysLeft } };
    }
  }
}

const ruleTime = (r: ReminderRule): string => ('time' in r ? r.time : r.window.from);

function blockedByState(s: RuleState | undefined, fire: number, date: string): boolean {
  if (!s) return false;
  if (s.dismissedOn === date) return true;
  return !!s.handledAt && Date.parse(s.handledAt) >= fire;
}

// ---------- public API ----------

/** Reminders to show right now (README §12.2); highest priority first. */
export function dueReminders(cfg: ReminderConfig, act: Activity, state: ReminderState, now: number): DueReminder[] {
  const tz = cfg.timeZone;
  const today = localParts(now, tz).date;
  if (!cfg.enabled || paused(cfg, today) || inQuiet(cfg, now)) return [];
  const out: DueReminder[] = [];
  for (const rule of cfg.rules) {
    if (!rule.enabled) continue;
    const occ = occurrence(rule, today, act, true, tz);
    if (!occ || occ.fire > now || (occ.until !== undefined && now > occ.until)) continue;
    const s = state[rule.id];
    if (blockedByState(s, occ.fire, today)) continue;
    if (s?.snoozedUntil && now < Date.parse(s.snoozedUntil)) continue;
    out.push({ ruleId: rule.id, kind: rule.kind, since: toZonedIso(occ.fire, tz), time: ruleTime(rule), payload: occ.payload });
  }
  return out.sort((a, b) => KIND_PRIORITY.indexOf(a.kind) - KIND_PRIORITY.indexOf(b.kind) || a.since.localeCompare(b.since));
}

/**
 * The next instant after `now` at which a reminder becomes due, assuming nothing else is logged
 * today (for the in-app timer and "next reminder" in Settings). Null if none within two weeks.
 */
export function nextDueAt(cfg: ReminderConfig, act: Activity, state: ReminderState, now: number): string | null {
  if (!cfg.enabled) return null;
  const tz = cfg.timeZone;
  const today = localParts(now, tz).date;
  let best: number | null = null;
  for (let i = 0; i < 14; i++) {
    const date = addDays(today, i);
    if (paused(cfg, date)) continue;
    for (const rule of cfg.rules) {
      if (!rule.enabled) continue;
      const occ = occurrence(rule, date, act, i === 0, tz);
      if (!occ) continue;
      const s = i === 0 ? state[rule.id] : undefined;
      if (blockedByState(s, occ.fire, date)) continue;
      let t = Math.max(occ.fire, s?.snoozedUntil ? Date.parse(s.snoozedUntil) : 0);
      t = afterQuiet(cfg, t);
      // catch-up is same-day only, and window rules end at their window
      if (localParts(t, tz).date !== date || (occ.until !== undefined && t > occ.until)) continue;
      if (t > now && (best === null || t < best)) best = t;
    }
    if (best !== null) break;
  }
  // ISO has second precision: round up, so a timer armed for this instant finds the reminder due
  return best === null ? null : toZonedIso(Math.ceil(best / 1000) * 1000, tz);
}

/** Banner action → new state (README §12.3). */
export function applyAction(
  state: ReminderState,
  ruleId: string,
  action: ReminderAction,
  now: number,
  tz: string = DEFAULT_TIME_ZONE,
): ReminderState {
  const cur = { ...state[ruleId] };
  if (action === 'logged') {
    cur.handledAt = toZonedIso(now, tz);
    delete cur.snoozedUntil;
  } else if (action === 'later') {
    cur.snoozedUntil = toZonedIso(now + SNOOZE_MS, tz);
  } else {
    cur.dismissedOn = localParts(now, tz).date;
    delete cur.snoozedUntil;
  }
  return { ...state, [ruleId]: cur };
}

/** One combined banner (README §12.3 / F5a): the top rule plus a bag-expiry line. */
export function mergeDue(due: DueReminder[]): { primary: DueReminder | null; bag: DueReminder | null } {
  return {
    primary: due.find((d) => d.kind !== 'bagExpiring') ?? null,
    bag: due.find((d) => d.kind === 'bagExpiring') ?? null,
  };
}
