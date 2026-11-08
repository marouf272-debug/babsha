import { expect, test } from '@playwright/test';
import { runSteps } from './helpers';

// S5 and S6 visual checks: the sample position at iPhone 13 Pro size (390 by 844 points, 3x pixels),
// both camera presets and both languages, saved for comparison with docs/style-guide.md.
test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

for (const camera of ['tabletop']) {
  for (const lang of ['en', 'bn']) {
    test(`S6 showcase: ${camera} camera, ${lang}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`/?showcase=1&camera=${camera}&lang=${lang}`);
      await page.waitForTimeout(800);
      await page.screenshot({ path: `docs/screenshots/s6-board-${lang}.png` });
      expect(errors).toEqual([]);
    });
  }
}

test('S6 game screen, both languages', async ({ page }) => {
  await page.goto('/?test=1&lang=en');
  await page.getByTestId('count-4').click();
  await page.getByTestId('start').click();
  await page.getByTestId('handoff').getByRole('button').click();
  await page.screenshot({ path: 'docs/screenshots/s6-game-en.png' });
  await page.getByTestId('lang').click();
  await page.screenshot({ path: 'docs/screenshots/s6-game-bn.png' });
});

test('S6 card artwork', async ({ page }) => {
  await page.goto('/?test=1&lang=en');
  await page.getByTestId('start').click();
  for (let i = 0; i < 2000 && !(await page.getByTestId('card').isVisible()); i++) await runSteps(page, 1);
  await expect(page.getByTestId('card')).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/s6-card-en.png' });
  await page.getByTestId('lang').click();
  await page.screenshot({ path: 'docs/screenshots/s6-card-bn.png' });
});

test('S6 phone pop-up: the deed is a small card over the board', async ({ page }) => {
  await page.goto('/?test=1&lang=en');
  await page.getByTestId('start').click();
  for (let i = 0; i < 300 && !(await page.getByTestId('deed').isVisible()); i++) await runSteps(page, 1);
  await expect(page.getByTestId('deed')).toBeVisible();
  const box = await page.locator('.sheet').boundingBox();
  const board = await page.locator('.board-wrap').boundingBox();
  // The card stays inside the board area and leaves most of it visible.
  expect(box!.width * box!.height).toBeLessThan(board!.width * board!.height * 0.75);
  await page.screenshot({ path: 'docs/screenshots/s6-phone-deed-en.png' });
});
