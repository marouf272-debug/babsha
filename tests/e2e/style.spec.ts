import { expect, test } from '@playwright/test';

// S5 visual checks: the sample position at iPhone 13 Pro size (390 by 844 points, 3x pixels),
// both camera presets and both languages, saved for comparison with docs/style-guide.md.
test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

for (const camera of ['tabletop', 'tilted45', 'isometric']) {
  for (const lang of ['en', 'bn']) {
    test(`S5 showcase: ${camera} camera, ${lang}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`/?showcase=1&camera=${camera}&lang=${lang}`);
      await page.waitForTimeout(800);
      await page.screenshot({ path: `docs/screenshots/s5-${camera}-${lang}.png` });
      expect(errors).toEqual([]);
    });
  }
}

test('S5 game screen in the new style, both languages', async ({ page }) => {
  await page.goto('/?test=1&lang=en');
  await page.getByTestId('count-4').click();
  await page.getByTestId('start').click();
  await page.getByTestId('handoff').getByRole('button').click();
  await page.screenshot({ path: 'docs/screenshots/s5-game-en.png' });
  await page.getByTestId('lang').click();
  await page.screenshot({ path: 'docs/screenshots/s5-game-bn.png' });
});
