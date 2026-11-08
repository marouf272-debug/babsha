import { expect, test } from '@playwright/test';
import en from '../../data/en.json' with { type: 'json' };

test('S0 smoke: the built page loads and shows the title from en.json', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(en['app.title']);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(en['app.title']);
});
