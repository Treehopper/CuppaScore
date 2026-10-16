import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  applyAction,
  dueReminders,
  mergeDue,
  nextDueAt,
  ReminderConfig,
  suggestedReminderRules,
  type Activity,
  type ReminderRule,
  type ReminderState,
} from './reminders';
import { localParts, parseDateTimeInZone } from './time';

const BERLIN = 'Europe/Berlin';
/** wall-clock time in Berlin unless a zone is given */
const T = (local: string, tz = BERLIN): number => parseDateTimeInZone(local, tz)!;
const cfg = (rules: ReminderRule[], extra: Partial<ReminderConfig> = {}): ReminderConfig =>
  ReminderConfig.parse({ enabled: true, rules, ...extra });
const act = (a: Partial<Activity> = {}): Activity => ({ cupsToday: 0, expiringBags: [], ...a });
const ids = (c: ReminderConfig, a: Activity, s: ReminderState, now: number): string[] =>
  dueReminders(c, a, s, now).map((d) => d.ruleId);

const weekday10: ReminderRule = { id: 'wd', kind: 'nothingLoggedBy', time: '10:00', days: ['MO', 'TU', 'WE', 'TH', 'FR'], enabled: true };
const weekend1130: ReminderRule = { id: 'we', kind: 'nothingLoggedBy', time: '11:30', days: ['SA', 'SU'], enabled: true };
const fewer: ReminderRule = { id: 'fewer', kind: 'fewerThanBy', count: 2, time: '15:30', days: 'all', enabled: true };
const daily20: ReminderRule = { id: 'daily', kind: 'fixedDaily', time: '20:00', days: 'all', enabled: true };
const after2h: ReminderRule = { id: 'after', kind: 'afterLastLog', hours: 2, window: { from: '08:00', to: '18:00' }, days: 'all', enabled: true };
const expiry: ReminderRule = { id: 'bag', kind: 'bagExpiring', daysBefore: 2, time: '09:00', enabled: true };

// 2026-10-16 is a Friday
describe('dueReminders: table', () => {
  const c = cfg([weekday10, weekend1130]);
  const cases: [string, number, Activity, string[]][] = [
    ['opened before the rule time', T('2026-10-16T09:59'), act(), []],
    ['opened after the rule time', T('2026-10-16T10:40'), act(), ['wd']],
    ['logged just before', T('2026-10-16T10:40'), act({ cupsToday: 1, lastLoggedAt: '2026-10-16T09:55:00+02:00' }), []],
    ['weekend rule on Saturday', T('2026-10-17T11:31'), act(), ['we']],
    ['weekday rule not on Saturday', T('2026-10-17T10:30'), act(), []],
    ['late evening still today', T('2026-10-16T23:59'), act(), ['wd']],
    ['next morning: yesterday is not caught up', T('2026-10-19T08:00'), act(), []],
  ];
  for (const [name, now, a, expected] of cases) it(name, () => expect(ids(c, a, {}, now)).toEqual(expected));

  it('reports since and the rule time', () => {
    expect(dueReminders(c, act(), {}, T('2026-10-16T10:40'))[0]).toMatchObject({
      kind: 'nothingLoggedBy',
      since: '2026-10-16T10:00:00+02:00',
      time: '10:00',
    });
  });

  it('nothing when disabled globally or per rule', () => {
    expect(ids(cfg([weekday10], { enabled: false }), act(), {}, T('2026-10-16T12:00'))).toEqual([]);
    expect(ids(cfg([{ ...weekday10, enabled: false }]), act(), {}, T('2026-10-16T12:00'))).toEqual([]);
  });
});

describe('rule kinds', () => {
  it('fewerThanBy counts cups today', () => {
    const c = cfg([fewer]);
    expect(dueReminders(c, act({ cupsToday: 1 }), {}, T('2026-10-16T16:00'))[0]?.payload).toEqual({ cupsToday: 1 });
    expect(ids(c, act({ cupsToday: 2 }), {}, T('2026-10-16T16:00'))).toEqual([]);
  });

  it('afterLastLog fires inside its window only', () => {
    const c = cfg([after2h]);
    const last = (hm: string) => act({ cupsToday: 1, lastLoggedAt: `2026-10-16T${hm}:00+02:00` });
    expect(ids(c, last('09:00'), {}, T('2026-10-16T10:59'))).toEqual([]);
    expect(ids(c, last('09:00'), {}, T('2026-10-16T11:00'))).toEqual(['after']);
    expect(ids(c, last('09:00'), {}, T('2026-10-16T18:01'))).toEqual([]);
    // early cup: waits for the window
    expect(ids(c, last('05:00'), {}, T('2026-10-16T07:30'))).toEqual([]);
    expect(ids(c, last('05:00'), {}, T('2026-10-16T08:00'))).toEqual(['after']);
    // too late for today's window
    expect(nextDueAt(c, last('17:00'), {}, T('2026-10-16T17:00'))).toBeNull();
  });

  it('bagExpiring: from N days before through the expiry date, soonest bag first', () => {
    const c = cfg([expiry]);
    const a = act({
      expiringBags: [
        { bagId: 'b2', expiryDate: '2026-10-20' },
        { bagId: 'b1', expiryDate: '2026-10-18' },
      ],
    });
    expect(ids(c, a, {}, T('2026-10-15T12:00'))).toEqual([]);
    expect(dueReminders(c, a, {}, T('2026-10-16T09:00'))[0]?.payload).toEqual({ bagId: 'b1', daysLeft: 2 });
    expect(dueReminders(c, a, {}, T('2026-10-18T09:00'))[0]?.payload).toEqual({ bagId: 'b1', daysLeft: 0 });
    expect(dueReminders(c, a, {}, T('2026-10-19T09:00'))[0]?.payload).toEqual({ bagId: 'b2', daysLeft: 1 });
  });
});

describe('several due rules', () => {
  it('sorted by priority and merged into one banner', () => {
    const c = cfg([daily20, expiry, fewer, weekday10]);
    const a = act({ expiringBags: [{ bagId: 'b1', expiryDate: '2026-10-17' }] });
    const due = dueReminders(c, a, {}, T('2026-10-16T20:30'));
    expect(due.map((d) => d.kind)).toEqual(['nothingLoggedBy', 'fewerThanBy', 'fixedDaily', 'bagExpiring']);
    const m = mergeDue(due);
    expect(m.primary?.ruleId).toBe('wd');
    expect(m.bag?.ruleId).toBe('bag');
    expect(mergeDue([])).toEqual({ primary: null, bag: null });
  });
});

describe('quiet hours', () => {
  const quietHours = { from: '21:30', to: '07:00' };

  it('suppress while quiet, show after', () => {
    const early: ReminderRule = { id: 'early', kind: 'fixedDaily', time: '06:30', days: 'all', enabled: true };
    const c = cfg([early], { quietHours });
    expect(ids(c, act(), {}, T('2026-10-16T06:45'))).toEqual([]);
    expect(ids(c, act(), {}, T('2026-10-16T07:00'))).toEqual(['early']);
    expect(nextDueAt(c, act(), {}, T('2026-10-16T06:00'))).toBe('2026-10-16T07:00:00+02:00');
  });

  it('a rule inside the evening quiet hours never fires (no next-day catch-up)', () => {
    const late: ReminderRule = { id: 'late', kind: 'fixedDaily', time: '22:00', days: 'all', enabled: true };
    const c = cfg([late], { quietHours });
    expect(ids(c, act(), {}, T('2026-10-16T22:30'))).toEqual([]);
    expect(nextDueAt(c, act(), {}, T('2026-10-16T12:00'))).toBeNull();
  });
});

describe('time zones', () => {
  it('travel: rules follow the configured zone', () => {
    const now = Date.parse('2026-10-16T12:00:00Z'); // 14:00 Berlin, 08:00 New York
    expect(ids(cfg([weekday10]), act(), {}, now)).toEqual(['wd']);
    const ny = cfg([weekday10], { timeZone: 'America/New_York' });
    expect(ids(ny, act(), {}, now)).toEqual([]);
    expect(nextDueAt(ny, act(), {}, now)).toBe('2026-10-16T10:00:00-04:00');
  });

  it('DST end (fall back): wall-clock time is kept', () => {
    const c = cfg([daily20]);
    expect(nextDueAt(c, act(), {}, T('2026-10-25T01:00'))).toBe('2026-10-25T20:00:00+01:00');
    expect(ids(c, act(), {}, Date.parse('2026-10-25T18:59:00Z'))).toEqual([]);
    expect(ids(c, act(), {}, Date.parse('2026-10-25T19:00:00Z'))).toEqual(['daily']);
  });

  it('DST start: a time in the gap fires after the gap', () => {
    const gap: ReminderRule = { id: 'gap', kind: 'fixedDaily', time: '02:30', days: 'all', enabled: true };
    expect(nextDueAt(cfg([gap]), act(), {}, T('2026-03-29T00:00'))).toBe('2026-03-29T03:30:00+02:00');
  });
});

describe('state: pause, snooze, not today, logged', () => {
  const c = cfg([weekday10]);

  it('pause until a date (resumes on that date)', () => {
    const p = cfg([weekday10], { pausedUntil: '2026-10-20' });
    expect(ids(p, act(), {}, T('2026-10-19T12:00'))).toEqual([]);
    expect(ids(p, act(), {}, T('2026-10-20T12:00'))).toEqual(['wd']);
    expect(nextDueAt(p, act(), {}, T('2026-10-16T12:00'))).toBe('2026-10-20T10:00:00+02:00');
  });

  it('later snoozes 30 minutes, then shows again', () => {
    const s = applyAction({}, 'wd', 'later', T('2026-10-16T10:40'), BERLIN);
    expect(s.wd?.snoozedUntil).toBe('2026-10-16T11:10:00+02:00');
    expect(ids(c, act(), s, T('2026-10-16T11:09'))).toEqual([]);
    expect(ids(c, act(), s, T('2026-10-16T11:10'))).toEqual(['wd']);
    expect(nextDueAt(c, act(), s, T('2026-10-16T10:41'))).toBe('2026-10-16T11:10:00+02:00');
  });

  it('not today hides it until tomorrow', () => {
    const s = applyAction({}, 'wd', 'notToday', T('2026-10-15T10:40'), BERLIN);
    expect(ids(c, act(), s, T('2026-10-15T23:00'))).toEqual([]);
    expect(nextDueAt(c, act(), s, T('2026-10-15T10:41'))).toBe('2026-10-16T10:00:00+02:00');
    expect(ids(c, act(), s, T('2026-10-16T10:00'))).toEqual(['wd']);
  });

  it('logged handles today’s occurrence of an unconditional rule', () => {
    const d = cfg([daily20]);
    const s = applyAction({}, 'daily', 'logged', T('2026-10-16T20:05'), BERLIN);
    expect(ids(d, act(), s, T('2026-10-16T21:00'))).toEqual([]);
    expect(ids(d, act(), s, T('2026-10-17T20:00'))).toEqual(['daily']);
    // logging clears a pending snooze
    const snoozed = applyAction({}, 'daily', 'later', T('2026-10-16T20:01'), BERLIN);
    expect(applyAction(snoozed, 'daily', 'logged', T('2026-10-16T20:05'), BERLIN).daily?.snoozedUntil).toBeUndefined();
  });

  it('afterLastLog re-arms after each new cup', () => {
    const a = cfg([after2h]);
    const s = applyAction({}, 'after', 'logged', T('2026-10-16T11:05'), BERLIN);
    const later = act({ cupsToday: 2, lastLoggedAt: '2026-10-16T11:05:00+02:00' });
    expect(ids(a, later, s, T('2026-10-16T13:05'))).toEqual(['after']);
  });
});

describe('nextDueAt', () => {
  it('skips today when the condition is already met, then weekends', () => {
    const c = cfg([weekday10, weekend1130]);
    expect(nextDueAt(c, act({ cupsToday: 1 }), {}, T('2026-10-16T08:00'))).toBe('2026-10-17T11:30:00+02:00');
    expect(nextDueAt(c, act(), {}, T('2026-10-16T08:00'))).toBe('2026-10-16T10:00:00+02:00');
  });

  it('rounds up to whole seconds so an armed timer finds the reminder due', () => {
    const c = cfg([after2h]);
    const a = act({ cupsToday: 1, lastLoggedAt: '2026-10-16T09:00:00.400+02:00' });
    const next = nextDueAt(c, a, {}, T('2026-10-16T10:00'));
    expect(next).toBe('2026-10-16T11:00:01+02:00');
    expect(ids(c, a, {}, Date.parse(next!))).toEqual(['after']);
  });

  it('is null when disabled or without rules', () => {
    expect(nextDueAt(cfg([]), act(), {}, T('2026-10-16T08:00'))).toBeNull();
    expect(nextDueAt(cfg([weekday10], { enabled: false }), act(), {}, T('2026-10-16T08:00'))).toBeNull();
  });

  it('property: always in the future, and a same-day next time really is due then', () => {
    const rules = suggestedReminderRules().map((r) => ({ ...r, enabled: true }));
    fc.assert(
      fc.property(
        fc.integer({ min: T('2026-01-01T00:00'), max: T('2027-12-31T00:00') }),
        fc.integer({ min: 0, max: 3 }),
        fc.boolean(),
        fc.option(fc.constantFrom('21:30', '22:00', '23:00'), { nil: undefined }),
        (now, cups, hasLast, quietFrom) => {
          const c = cfg(rules, quietFrom ? { quietHours: { from: quietFrom, to: '07:00' } } : {});
          const a = act({
            cupsToday: cups,
            lastLoggedAt: hasLast && cups > 0 ? new Date(now - 30 * 60_000).toISOString() : undefined,
            expiringBags: [{ bagId: 'b', expiryDate: localParts(now + 86_400_000, BERLIN).date }],
          });
          const next = nextDueAt(c, a, {}, now);
          if (next === null) return;
          const t = Date.parse(next);
          expect(t).toBeGreaterThan(now);
          if (localParts(t, BERLIN).date === localParts(now, BERLIN).date) {
            expect(dueReminders(c, a, {}, t).length).toBeGreaterThan(0);
          }
        },
      ),
    );
  });
});

describe('schema', () => {
  it('accepts the README §4.7 example and rejects bad times', () => {
    const c = ReminderConfig.parse({
      enabled: true,
      timeZone: 'Europe/Berlin',
      quietHours: { from: '21:30', to: '07:00' },
      pausedUntil: null,
      rules: suggestedReminderRules(),
    });
    expect(c.rules).toHaveLength(6);
    expect(ReminderConfig.safeParse({ rules: [{ id: 'x', kind: 'fixedDaily', time: '25:00' }] }).success).toBe(false);
    expect(ReminderConfig.parse({}).enabled).toBe(false);
  });
});
