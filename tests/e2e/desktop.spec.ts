import { expect, test } from '@playwright/test';
import { runSteps } from './helpers';

// Desktop layout (D-86): players on the left, the board in the middle, actions and pop-ups right.
test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false });

test('D-86: desktop puts players left, board centre, and pop-ups in the right panel', async ({ page }) => {
  await page.goto('/?test=1&lang=en');
  await page.getByTestId('count-3').click();
  await page.getByTestId('start').click();
  for (let i = 0; i < 300 && !(await page.getByTestId('deed').isVisible()); i++) await runSteps(page, 1);
  await expect(page.getByTestId('deed')).toBeVisible();
  const players = (await page.locator('.players').boundingBox())!;
  const board = (await page.locator('.board-wrap').boundingBox())!;
  const panel = (await page.locator('.side').boundingBox())!;
  const deed = (await page.getByTestId('deed').boundingBox())!;
  expect(players.x + players.width).toBeLessThanOrEqual(board.x + 1);
  expect(board.x + board.width).toBeLessThanOrEqual(panel.x + 1);
  // The deed sits in the right panel, not over the board.
  expect(deed.x).toBeGreaterThanOrEqual(panel.x - 1);
  await page.screenshot({ path: 'docs/screenshots/s6-desktop-en.png' });
  await page.getByTestId('lang').click();
  await page.screenshot({ path: 'docs/screenshots/s6-desktop-bn.png' });
});
