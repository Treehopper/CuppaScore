import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { addBag } from './helpers';

// the API worker follows the page clock (followerClock), so page.clock drives reminders too
test.use({ timezoneId: 'Europe/Berlin' });

/** Settings → reminders on, plus the weekday "nothing logged by 10:00" rule. */
async function enableWeekdayRule(page: Page): Promise<void> {
  await page.goto('./#/settings');
  await page.getByLabel('Remind me when I open CupLog').check();
  await page.getByTestId('reminder-rule').first().getByRole('checkbox').check();
}

const banner = (page: Page) => page.getByTestId('reminder-banner');

test('banner when due; Later comes back on the timer; Not today sticks; days matter', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-16T10:30:00+02:00') }); // a Friday
  await enableWeekdayRule(page);
  await expect(banner(page)).toContainText('No coffee logged yet today ☕ — your 10:00 reminder');
  await expect(page.getByTestId('reminder-settings')).toContainText('Next reminder: Mon');

  await banner(page).getByRole('button', { name: 'Later' }).click();
  await expect(banner(page)).toHaveCount(0);
  await page.clock.fastForward('31:00');
  await expect(banner(page)).toBeVisible();

  await banner(page).getByRole('button', { name: 'Not today' }).click();
  await expect(banner(page)).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('reminder-settings')).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
});

test('banner and reminder settings pass axe (light and dark)', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-16T10:30:00+02:00') });
  await enableWeekdayRule(page);
  await expect(banner(page)).toBeVisible();
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  }
});

test('a weekday the rule is off for shows nothing', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-16T10:30:00+02:00') });
  await enableWeekdayRule(page);
  await expect(banner(page)).toBeVisible();
  await page.getByTestId('reminder-rule').first().getByRole('button', { name: 'Friday' }).click();
  await expect(banner(page)).toHaveCount(0);
});

test('appears while the app is open; Log now + saving a cup settles it', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-16T09:50:00+02:00') });
  await addBag(page);
  await enableWeekdayRule(page);
  await expect(page.getByTestId('reminder-settings')).toContainText('Next reminder: 10:00');
  await page.getByRole('link', { name: 'Bags' }).click();
  await expect(banner(page)).toHaveCount(0);

  await page.clock.fastForward('11:00');
  await expect(banner(page)).toBeVisible();
  await banner(page).getByRole('button', { name: 'Log now' }).click();
  await expect(page).toHaveURL(/#\/log\?mode=home$/);
  await expect(banner(page)).toHaveCount(0);

  await page.getByRole('radio', { name: 'Stars' }).click();
  await page.locator('[data-star="4"]').click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Cup saved')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('log-bag')).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
});

test('fixed-time rule exports to the calendar', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-16T08:00:00+02:00') });
  await enableWeekdayRule(page);
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Add to my calendar (.ics)' }).click(),
  ]);
  expect(dl.suggestedFilename()).toBe('cuplog-reminder-rem_1.ics');
  const ics = await readFile(await dl.path(), 'utf8');
  expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR');
  expect(ics).toContain('DTSTART:20261016T100000');
  expect(ics).toContain('SUMMARY:Rate your coffee in CupLog ☕');
});
