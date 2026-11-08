import { expect, test } from '@playwright/test';
import { runSteps } from './helpers';

test.describe('offline play (plan 2.2, D-94)', () => {
  test('plan 2.2: after the first visit the game starts and plays with no connection, Bangla font included', async ({ page, context }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/?test=1&lang=bn');
    // Wait until the service worker has cached everything and controls the page.
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId('start')).toBeVisible();
    expect(await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('600 20px "Noto Sans Bengali"', 'বাংলা'); })).toBe(true);
    await page.getByTestId('start').click();
    expect((await runSteps(page, 40)).status).not.toBe('stuck');
    await page.screenshot({ path: 'docs/screenshots/s7-offline-bn.png' });
    expect(errors).toEqual([]);
    await context.setOffline(false);
  });
});
