import { expect, test } from '@playwright/test';
import { installRFixture } from './r-experience.fixture';

const fields = {
  'front-left': 'door_front_left_closed', 'front-right': 'door_front_right_closed',
  'rear-left': 'door_rear_left_closed', 'rear-right': 'door_rear_right_closed',
  frunk: 'closure_frunk_closed', gate: 'closure_liftgate_closed',
} as const;

for (const width of [393, 1280]) for (const mode of ['dark', 'light'] as const) {
  test(`car openings follow independent live positions at ${width} ${mode}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const fixture = await installRFixture(page, { mode, populatedAdmin: true });
    await page.goto('/');
    const panels = page.locator('[data-car-closure]');
    await expect(panels).toHaveCount(6);
    await expect(page.locator('[data-car-closure][data-open-progress="0.000"]')).toHaveCount(6);
    await expect.poll(fixture.liveConnections).toBe(1);
    fixture.publishStatus({ doors_locked: false });
    await expect(page.getByRole('button', { name: 'Doors & locks: Doors closed, Unlocked' })).toBeVisible();
    await expect(page.locator('[data-car-closure][data-open-progress="0.000"]')).toHaveCount(6);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    for (const [id, field] of Object.entries(fields)) {
      const panel = page.locator(`[data-car-closure="${id}"]`);
      fixture.publishStatus({ [field]: false });
      await expect(panel).toHaveAttribute('data-position', 'open');
      await expect.poll(async () => Number(await panel.getAttribute('data-open-progress'))).toBeGreaterThan(0);
      await expect(panel).toHaveAttribute('data-open-progress', '1.000');
      await expect(page.locator('[data-car-closure][data-open-progress="0.000"]')).toHaveCount(5);
      fixture.publishStatus({ [field]: false, speed_mph: 0, doors_locked: true });
      await expect(panel).toHaveAttribute('data-open-progress', '1.000');
      fixture.publishStatus({ [field]: true });
      await expect(panel).toHaveAttribute('data-open-progress', '0.000');
    }
    fixture.publishStatus({ door_front_left_closed: false, closure_frunk_closed: false, closure_liftgate_closed: false });
    await expect(page.locator('[data-car-closure][data-open-progress="1.000"]')).toHaveCount(3);
    await page.screenshot({ path: testInfo.outputPath('open-front.png') });
    const car = page.getByRole('slider', { name: 'Rotate vehicle' });
    await car.focus();
    for (let step = 0; step < 12; step++) await car.press('ArrowLeft');
    await expect(car).toHaveAttribute('aria-valuenow', '160');
    await expect.poll(() => page.locator('[data-car-closure="gate"]').getAttribute('opacity')).toBe('1');
    await page.screenshot({ path: testInfo.outputPath('open-rear.png') });
    await page.getByRole('button', { name: 'Reset vehicle view' }).click();
    await expect(car).toHaveAttribute('aria-valuenow', '280');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    fixture.publishStatus({ door_front_left_closed: true, closure_frunk_closed: true, closure_liftgate_closed: true });
    await expect(page.locator('[data-car-closure][data-open-progress="0.000"]')).toHaveCount(6);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(fixture.writes).toEqual([]);
    expect(fixture.unsupportedRequests).toEqual([]);
  });
}

test('initial open positions and unavailable sensors do not play opening or closing', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const fixture = await installRFixture(page, { statusOverrides: {
    door_front_left_closed: false, door_front_right_closed: null, closure_frunk_closed: false,
  } });
  await page.goto('/');
  const left = page.locator('[data-car-closure="front-left"]');
  const right = page.locator('[data-car-closure="front-right"]');
  await expect(left).toHaveAttribute('data-open-progress', '1.000');
  await expect(right).toHaveAttribute('data-position', 'unknown');
  await expect(right).toHaveAttribute('opacity', '0');
  await expect.poll(fixture.liveConnections).toBe(1);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  fixture.publishStatus({ door_front_left_closed: null, door_front_right_closed: false });
  await expect(left).toHaveAttribute('data-position', 'open');
  await expect(left).toHaveAttribute('data-open-progress', '1.000');
  await expect(right).toHaveAttribute('data-open-progress', '1.000');
  fixture.publishStatus({ field_availability: {
    door_front_left_closed: { availability: 'never_seen', reason_code: 'invalid_sensor', ever_seen: false, last_seen_at: null, latest_event_at: null },
  } });
  await expect(left).toHaveAttribute('data-position', 'unknown');
  await expect(left).toHaveAttribute('data-open-progress', '0.000');
  fixture.publishStatus({ field_availability: {
    door_front_right_closed: { availability: 'never_seen', reason_code: 'invalid_sensor', ever_seen: false, last_seen_at: null, latest_event_at: null },
  } });
  await expect(right).toHaveAttribute('data-position', 'unknown');
  await expect(right).toHaveAttribute('data-open-progress', '0.000');
  expect(fixture.writes).toEqual([]);
});
