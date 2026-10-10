import { expect, test } from '@playwright/test';
import { installRFixture } from './r-experience.fixture';

test.use({ viewport: { width: 393, height: 659 }, isMobile: true, hasTouch: true });

test('efficiency changes update actual overview and chart readings immediately', async ({ page }) => {
  await installRFixture(page, { populatedAdmin: true, populatedAnalytics: true });
  await page.goto('/');
  const efficiency = page.locator('.r-efficiency-card');
  await expect(efficiency.locator('strong')).toHaveText('3.1');
  await page.getByRole('button', { name: /Toggle efficiency units/ }).click();
  await expect(efficiency.locator('strong')).toHaveText('320');
  await expect(efficiency).toContainText('Wh/mi');
  await page.getByRole('button', { name: /Toggle efficiency units/ }).click();
  await expect(efficiency.locator('strong')).toHaveText('3.1');
  await page.goto('/efficiency');
  await expect(page.locator('[data-testid="sensor-chip"]').filter({ hasText: 'Avg Consumption' }).first()).toContainText('3.1 mi/kWh');
  await page.getByRole('button', { name: /Toggle efficiency units/ }).click();
  await expect(page.locator('[data-testid="sensor-chip"]').filter({ hasText: 'Avg Consumption' }).first()).toContainText('320 Wh/mi');
});

test('owner-configured R2 rotates on entry and yields immediately to touch', async ({ page }) => {
  await installRFixture(page, { unknownConfiguration: true });
  await page.goto('/');
  const orbit = page.getByRole('slider', { name: 'Rotate vehicle' });
  await expect(orbit).toBeVisible();
  await expect(page.locator('.r-orbit canvas')).toBeVisible();
  const first = await orbit.getAttribute('aria-valuenow');
  await expect.poll(() => orbit.getAttribute('aria-valuenow')).not.toBe(first);
  await orbit.dispatchEvent('pointerdown', { pointerId: 1, isPrimary: true, button: 0, clientX: 120, clientY: 450 });
  const stopped = await orbit.getAttribute('aria-valuenow');
  await page.waitForTimeout(250);
  await expect(orbit).toHaveAttribute('aria-valuenow', stopped!);
  await page.getByRole('button', { name: 'Front', exact: true }).click();
  await expect(orbit).toHaveAttribute('aria-valuenow', '325');
});

test('phone overview leads with odometer and keeps controls above the dock', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installRFixture(page, { unknownConfiguration: true, secondVehicle: true, odometer: 123456 });
  await page.goto('/');
  await expect(page.locator('.r-car-readings > div').first()).toContainText('Total mileage');
  await expect(page.locator('.r-car-readings > div').first()).toContainText('123,456');
  await expect(page.locator('.r-orbit-poster')).toBeVisible();
  const bounds = await page.locator('.r-car-readings dd').first().evaluate(element => {
    const parent = element.getBoundingClientRect();
    const value = element.firstElementChild!.getBoundingClientRect();
    return { fits: value.right <= parent.right + 1, overflow: element.scrollWidth > element.clientWidth + 1 };
  });
  expect(bounds).toEqual({ fits: true, overflow: false });
  const controls = (await page.locator('.r-orbit-controls').boundingBox())!;
  const dock = (await page.getByRole('navigation', { name: 'Primary navigation' }).boundingBox())!;
  expect(controls.y + controls.height).toBeLessThanOrEqual(dock.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('iphone-overview.png'), fullPage: true });
});

for (const mode of ['dark', 'light'] as const) {
  test(`R data colors do not change with the saved account palette in ${mode}`, async ({ browser }) => {
    const results = [];
    for (const palette of ['classic', 'rad'] as const) {
      const context = await browser.newContext({ viewport: { width: 393, height: 659 } });
      const page = await context.newPage();
      await installRFixture(page, { mode, palette, populatedAdmin: true, populatedAnalytics: true });
      await page.goto('/charging');
      const sessions = page.locator('[data-testid="sensor-chip"]').filter({ hasText: /^Sessions/ }).first();
      await expect(sessions).toContainText('25');
      results.push(await sessions.evaluate(element => {
        const value = element.querySelector('.font-mono')!;
        const style = getComputedStyle(value);
        const root = getComputedStyle(document.documentElement);
        return {
          color: style.color, halo: style.textShadow,
          series: root.getPropertyValue('--rm-series-02'), drive: root.getPropertyValue('--rm-dm-towing'),
          accent: root.getPropertyValue('--rm-chart-accent'), success: root.getPropertyValue('--rm-chart-success'),
        };
      }));
      await context.close();
    }
    expect(results[0]).toEqual(results[1]);
    expect(results[0]!.halo).toBe('none');
    expect(results[0]!.accent).not.toBe(results[0]!.success);
  });
}

test('populated phone charts retain readable labels within their visible frame', async ({ page }, testInfo) => {
  await installRFixture(page, { populatedAdmin: true, populatedAnalytics: true });
  await page.goto('/charging');
  const chart = page.locator('[data-chart-renderer="daily-charge-sessions"]');
  await expect(chart.locator('svg')).toBeVisible();
  await expect(chart.locator('[data-testid="daily-charge-axis-label"]').first()).toBeVisible();
  const geometry = await chart.evaluate(element => {
    const svg = element.querySelector('svg')!;
    const text = [...svg.querySelectorAll('text')].filter(node => node.textContent?.trim());
    const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
    const rect = element.getBoundingClientRect();
    let clipped = false;
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (['hidden', 'clip'].includes(style.overflowY)) {
        const box = parent.getBoundingClientRect();
        if (rect.bottom > box.bottom + 2) clipped = true;
      }
    }
    return { minFont: Math.min(...text.map(node => parseFloat(getComputedStyle(node).fontSize) * scale)), clipped };
  });
  expect(geometry.minFont).toBeGreaterThanOrEqual(11);
  expect(geometry.clipped).toBe(false);
  await chart.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('iphone-charging-chart.png') });
});

test('selected-trip tagging has room for input and complete action labels', async ({ page }, testInfo) => {
  await installRFixture(page, { populatedAdmin: true, populatedAnalytics: true, role: 'super_user' });
  await page.goto('/trips');
  await page.getByRole('button').filter({ hasText: /Home.*Office/ }).first().click();
  const toolbar = page.locator('[data-trip-selection-actions]');
  await expect(toolbar).toBeVisible();
  const input = toolbar.getByRole('textbox');
  const inputBox = (await input.boundingBox())!;
  expect(inputBox.width).toBeGreaterThan(220);
  for (const name of ['Clear tags', 'Add staged tags', 'Replace tags']) {
    const button = toolbar.getByRole('button', { name: new RegExp(`^${name}`) });
    const box = (await button.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x + box.width).toBeLessThanOrEqual(393);
  }
  await input.fill('Daily');
  await page.getByRole('option', { name: /Daily commute/ }).click();
  await toolbar.getByRole('button', { name: /^Add staged tags/ }).click();
  await expect(toolbar).toHaveCount(0);
  await expect(page.getByText('Daily commute').first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('iphone-trip-tags.png'), fullPage: true });
});

test('settings pickers stay inside the phone viewport and restore focus', async ({ page }) => {
  await installRFixture(page, { populatedAdmin: true, role: 'super_user' });
  await page.goto('/settings?section=units');
  await page.getByRole('button', { name: /^Custom/ }).click();
  const trigger = page.getByRole('button', { name: 'Application time zone', exact: true });
  await page.getByRole('button', { name: 'Efficiency display', exact: true }).click();
  await page.keyboard.press('Tab');
  await expect(trigger).toBeFocused();
  await trigger.evaluate(element => window.scrollTo(0, scrollY + element.getBoundingClientRect().top - 500));
  await trigger.click();
  const menu = page.getByRole('listbox', { name: 'Application time zone' });
  const bounds = (await menu.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(11);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(382);
  expect(bounds.y).toBeGreaterThanOrEqual(11);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(648);
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(menu).toHaveCount(0);
  await page.getByRole('button', { name: 'Settings section', exact: true }).click();
  const section = (await page.getByRole('listbox', { name: 'Settings section' }).boundingBox())!;
  expect(section.x + section.width).toBeLessThanOrEqual(382);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('vehicle settings keep Catalina Cove artwork and capture controls fit long names', async ({ page }) => {
  const name = 'Catalina Cove R2 Performance Family Adventure';
  await installRFixture(page, { populatedAdmin: true, unknownConfiguration: true, vehicleName: name, role: 'super_user' });
  await page.goto('/settings?section=vehicles');
  await expect(page.getByRole('img', { name: 'Catalina Cove R2 Performance with 21-inch wheels' })).toBeVisible();
  await page.goto('/settings?section=raw');
  await page.getByRole('button', { name: `Start capture for ${name}` }).click();
  const stop = page.getByRole('button', { name: `Stop capture for ${name}` });
  const bounds = (await stop.boundingBox())!;
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(393);
  await stop.click();
  await expect(page.getByRole('button', { name: `Start capture for ${name}` })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
