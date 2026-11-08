import { expect, test } from '@playwright/test';
import { runSteps, startGame } from './helpers';

type Hook = { __babsha: { app: { tapTargetsForTest(): Array<{ id: string; x: number; y: number }>; housesForTest(id: string): number } } };

test.describe('S6 owner feedback: details, log, trade colors, tools any time', () => {
  test('FR-06, D-88: tapping a built tile shows its owner and houses; tapping a player lists their properties', async ({ page }) => {
    await startGame(page, ['human', 'human']);
    for (let i = 0; i < 3000 && !(await page.getByTestId('act-build').isEnabled()); i++) await runSteps(page, 1);
    await page.getByTestId('act-build').click();
    const t = (await page.evaluate(() => (window as unknown as Hook).__babsha.app.tapTargetsForTest()))[0]!;
    await page.mouse.click(t.x, t.y);
    const houses = await page.evaluate((id) => (window as unknown as Hook).__babsha.app.housesForTest(id), t.id);
    expect(houses).toBeGreaterThan(0);
    // Leave build mode (Build may now be disabled for lack of cash), so a tap shows details.
    await page.locator('[data-testid="manage"] button', { hasText: 'Close' }).click();
    await page.mouse.click(t.x, t.y);
    const info = page.getByTestId('info-tile');
    await expect(info).toBeVisible();
    await expect(info).toContainText('Owner:');
    await expect(info).toContainText(houses === 1 ? '1 house' : `${houses} houses`);
    await expect(info).toContainText('Rent now:');
    const tileName = (await info.locator('.deed-head').innerText()).replace(/^\S+\s/, '').trim();
    await page.screenshot({ path: 'docs/screenshots/s6-info-tile-en.png' });
    await page.getByTestId('info-close').click();
    await expect(info).toBeHidden();

    await page.locator('.player.active').click();
    const player = page.getByTestId('info-player');
    await expect(player).toBeVisible();
    await expect(player).toContainText(tileName);
    await expect(player.locator('.prop-name .tag').first()).toBeVisible();
    await page.screenshot({ path: 'docs/screenshots/s6-info-player-en.png' });
  });

  test('D-89: the full log opens for everyone, names players, and follows the language toggle', async ({ page }) => {
    await startGame(page, ['human', 'easy']);
    await runSteps(page, 60);
    await page.getByTestId('open-log').click();
    const log = page.getByTestId('info-log');
    await expect(log).toBeVisible();
    const lines = await log.locator('li').allInnerTexts();
    expect(lines.length).toBeGreaterThan(5);
    expect(lines.some((l) => l.includes('Rickshaw'))).toBe(true);
    expect(lines.some((l) => l.includes('CNG auto'))).toBe(true);
    // Card text speaks to whoever drew it, so only the log's own wording is checked for "you".
    expect(lines.filter((l) => !l.includes(' card: ') && /\byou\b/i.test(l))).toEqual([]);
    await page.screenshot({ path: 'docs/screenshots/s6-log-en.png' });
    await page.getByTestId('lang').click();
    const bn = await log.locator('li').allInnerTexts();
    expect(bn.length).toBeGreaterThanOrEqual(lines.length);
    expect(bn[bn.length - 1]).not.toBe(lines[lines.length - 1]);
  });

  test('D-87, D-88: before rolling, Mortgage and Trade work, and the trade menu shows set colors and names', async ({ page }) => {
    await startGame(page, ['human', 'human']);
    const rollShown = () => page.locator('.main-row [data-action*="\\"ROLL\\""]').isVisible();
    for (let i = 0; i < 3000; i++) {
      if (await rollShown() && await page.getByTestId('act-mortgage').isEnabled()) break;
      await runSteps(page, 1);
    }
    expect(await rollShown()).toBe(true);
    await expect(page.getByTestId('act-mortgage')).toBeEnabled();
    await expect(page.getByTestId('act-trade')).toBeEnabled();
    await page.getByTestId('act-trade').click();
    await page.locator('[data-testid^="trade-to-"]').first().click();
    const boxes = page.locator('[data-testid="trade"] .check');
    expect(await boxes.count()).toBeGreaterThan(0);
    expect(await page.locator('[data-testid="trade"] .check .tag').count()).toBe(await boxes.count());
    const labels = await page.locator('[data-testid="trade"] .cols .field-label').allInnerTexts();
    expect(labels.every((l) => !/\byou\b/i.test(l))).toBe(true);
    await page.screenshot({ path: 'docs/screenshots/s6-trade-colors-en.png' });
  });
});
