import { expect, test } from '@playwright/test';
import en from '../../data/en.json' with { type: 'json' };

test('S0 smoke: the built page loads and shows the title from en.json', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(en['app.title']);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(en['app.title']);
});

test('D-97: many new games in a row each start a working board, with no errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' || /too many active webgl contexts/i.test(m.text())) errors.push(m.text()); });
  await page.goto('/?test=1&lang=en');
  for (let i = 0; i < 12; i++) {
    await page.getByTestId('start').click();
    await expect(page.getByTestId('handoff')).toBeVisible();
    await page.getByTestId('new-game').click();
  }
  await page.getByTestId('start').click();
  await page.getByTestId('handoff').getByRole('button').click();
  await page.locator('.main-row [data-action*="\\"ROLL\\""]').click();
  await expect(page.getByTestId('log')).toContainText('rolled');
  const lit = await page.locator('canvas.board').evaluate((c: HTMLCanvasElement) => !!(c.getContext('webgl2') ?? c.getContext('webgl'))?.isContextLost() === false);
  expect(lit).toBe(true);
  expect(errors).toEqual([]);
});
