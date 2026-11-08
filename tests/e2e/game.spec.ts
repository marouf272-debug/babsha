import { expect, test } from '@playwright/test';
import { playOneStep, runSteps, startGame, visibleTexts } from './helpers';

test.describe('S4 interface on a phone', () => {
  test('FR-12: a full Pass & Play game for two humans completes through the interface', async ({ page }) => {
    test.setTimeout(600_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await startGame(page, ['human', 'human']);
    await expect(page.getByTestId('handoff')).toBeVisible();
    let steps = 0;
    let status = 'more';
    for (let round = 0; round < 200 && status === 'more'; round++) {
      const r = await runSteps(page, 100);
      steps += r.steps;
      status = r.status;
      expect(r.status, r.detail).not.toBe('stuck');
    }
    expect(status).toBe('over');
    await expect(page.getByTestId('game-over')).toBeVisible();
    await page.screenshot({ path: 'docs/screenshots/s4-game-over-en.png' });
    expect(errors).toEqual([]);
    // FR-17: the HUD shows every player with name and cash.
    await expect(page.getByTestId('player-0')).toContainText('৳');
    await expect(page.getByTestId('player-1')).toContainText('৳');
    console.log(`[e2e] game finished after ${steps} interface steps`);
  });

  test('FR-15, FR-17: the language toggle changes every visible string, including the HUD, on setup and in game', async ({ page }) => {
    await page.goto('/?test=1&lang=en');
    const setupEn = await visibleTexts(page);
    await page.getByTestId('lang').click();
    const setupBn = await visibleTexts(page);
    expect(setupBn.filter((x) => setupEn.includes(x))).toEqual([]);
    await page.getByTestId('lang').click();

    await startGame(page, ['human', 'human', 'easy']);
    // Play until a deed sheet is open, so the board, player strip, log and a sheet are all on screen.
    for (let i = 0; i < 200 && !(await page.getByTestId('deed').isVisible()); i++) await playOneStep(page);
    await expect(page.getByTestId('deed')).toBeVisible();
    const en = await visibleTexts(page);
    await page.screenshot({ path: 'docs/screenshots/s4-deed-en.png' });
    await page.getByTestId('lang').click();
    const bn = await visibleTexts(page);
    await page.screenshot({ path: 'docs/screenshots/s4-deed-bn.png' });
    // Set symbols (♥, ★, ...) are language-neutral markers, so only strings with letters or digits count.
    const words = (x: string) => /[\p{L}\p{N}]/u.test(x);
    expect(bn.filter((x) => words(x) && en.includes(x)), 'strings that did not change').toEqual([]);
    // Bangla screen has no Latin letters except the toggle back to English.
    expect(bn.filter((x) => /[A-Za-z]/.test(x) && x !== 'English')).toEqual([]);
  });

  test('FR-17: a fixed action bar offers Build, Sell, Mortgage, Redeem and Trade; Build lists only build moves', async ({ page }) => {
    await startGame(page, ['human', 'human']);
    for (const id of ['act-build', 'act-sell', 'act-mortgage', 'act-redeem', 'act-trade']) await expect(page.getByTestId(id)).toBeVisible();
    // Play until the active player can build, then use the Build button.
    for (let i = 0; i < 3000; i++) {
      if (await page.getByTestId('act-build').isEnabled()) break;
      await runSteps(page, 1);
    }
    await expect(page.getByTestId('act-build')).toBeEnabled();
    await page.getByTestId('act-build').click();
    const types = await page.locator('[data-testid="manage"] [data-action]').evaluateAll((els) => els.map((e) => JSON.parse((e as HTMLElement).dataset['action']!).type as string));
    expect(types.length).toBeGreaterThan(0);
    expect(new Set(types)).toEqual(new Set(['BUILD']));
  });

  test('FR-13: a game with one human against a computer player runs the computer turns', async ({ page }) => {
    await startGame(page, ['human', 'hard']);
    for (let i = 0; i < 60; i++) await playOneStep(page);
    await expect(page.getByTestId('turn')).toBeVisible();
    await page.screenshot({ path: 'docs/screenshots/s4-vs-computer-en.png' });
    const logText = await page.locator('.log').innerText();
    expect(logText.length).toBeGreaterThan(0);
  });
});
