import { expect, test } from '@playwright/test';
import { installGraphFixture } from './r-default-graphs.fixture';

for (const width of [393, 1280]) for (const mode of ['dark', 'light'] as const) {
  test(`individual locks update without changing closed positions ${width} ${mode}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 852 });
    const fixture = await installGraphFixture(page, { mode });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    const summary = page.getByRole('button', { name: /^Doors & locks:/ });
    await expect(summary).toHaveAccessibleName('Doors & locks: Doors closed, Locked');
    await expect.poll(fixture.liveConnections).toBe(1);
    await summary.click();
    const sheet = page.locator('.r-door-sheet');
    await expect(sheet.locator('.r-door-lock-reading [data-locked="true"]')).toHaveCount(6);
    fixture.publishStatus({
      doors_locked: false, door_front_left_locked: false, door_front_right_locked: false,
      closure_frunk_locked: false, closure_liftgate_locked: false,
    });
    await expect(sheet.getByText('Doors closed · Unlocked', { exact: true })).toBeVisible();
    await expect(sheet.locator('.r-door-lock-reading [data-locked="false"]')).toHaveCount(4);
    await expect(sheet.locator('[data-position="closed"]')).toHaveCount(6);
    const shackle = sheet.locator('[data-locked="false"] .r-lock-shackle').first();
    await expect.poll(() => shackle.evaluate(e => getComputedStyle(e).transform)).not.toBe('none');
    expect(await shackle.evaluate(e => getComputedStyle(e).transitionDuration)).toBe('0.36s');
    fixture.publishStatus({
      door_front_left_closed: false, closure_frunk_closed: false, closure_liftgate_closed: false,
    });
    await expect(sheet.getByText('3 closures open · Unlocked', { exact: true })).toBeVisible();
    for (const id of ['front-left', 'frunk', 'gate']) {
      await expect(sheet.locator(`[data-door="${id}"]`)).toHaveAttribute('data-position', 'open');
    }
    await page.screenshot({ path: testInfo.outputPath('individual-locks.png') });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await shackle.evaluate(e => parseFloat(getComputedStyle(e).transitionDuration))).toBeLessThanOrEqual(0.001);
    fixture.publishStatus({ door_front_left_locked: true });
    await expect(sheet.locator('.r-door-list > div').first().getByText('Locked', { exact: true })).toBeVisible();
    await expect(sheet.locator('[data-door="front-left"]')).toHaveAttribute('data-position', 'open');
    await page.getByRole('button', { name: 'Close door status' }).click();
    await expect(summary).toHaveAccessibleName('Doors & locks: 3 closures open, Unlocked');
    await expect(page.locator('.r-orbit-openings')).toHaveCount(0);
    await expect(page.getByRole('slider', { name: 'Rotate vehicle' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('vehicle-summary.png') });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(fixture.writes).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('unknown individual and overall locks are not shown as locked on a small phone', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const unavailable = { availability: 'never_seen', ever_seen: false, last_seen_at: null, latest_event_at: null, reason_code: 'invalid_sensor' } as const;
  const fixture = await installGraphFixture(page, { mode: 'dark', statusOverrides: {
    doors_locked: true,
    door_front_left_locked: null, door_front_right_locked: null, door_rear_left_locked: null,
    door_rear_right_locked: null, closure_frunk_locked: true, closure_liftgate_locked: true,
    field_availability: { closure_frunk_locked: unavailable, closure_liftgate_locked: unavailable },
  } });
  await page.goto('/');
  const summary = page.getByRole('button', { name: /^Doors & locks:/ });
  await expect(summary).toHaveAccessibleName('Doors & locks: Doors closed, Locked');
  await summary.click();
  const sheet = page.locator('.r-door-sheet');
  await expect(sheet.getByText('Lock unknown', { exact: true })).toHaveCount(6);
  await expect(sheet.locator('.r-door-lock-reading .r-lock-icon')).toHaveCount(6);
  await expect.poll(fixture.liveConnections).toBe(1);
  fixture.publishStatus({ field_availability: {
    doors_locked: unavailable, closure_frunk_locked: unavailable, closure_liftgate_locked: unavailable,
  } });
  await expect(sheet.getByText('Doors closed · Locks unknown', { exact: true })).toBeVisible();
  await expect(sheet.getByText('Lock unknown', { exact: true })).toHaveCount(6);
  await page.screenshot({ path: testInfo.outputPath('unknown-locks-320.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Close door status' }).click();
  await expect(summary).toHaveAccessibleName('Doors & locks: Doors closed, Locks unknown');
  expect(fixture.writes).toEqual([]);
});
