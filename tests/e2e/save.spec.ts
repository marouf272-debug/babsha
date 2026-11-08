import { expect, test, type Page } from '@playwright/test';
import { runSteps, startGame } from './helpers';

// Plays human moves through the interface for `steps` moves, waiting while computer players act.
async function play(page: Page, steps: number): Promise<string> {
  let done = 0;
  for (let tries = 0; tries < 2000 && done < steps; tries++) {
    const r = await runSteps(page, steps - done);
    done += r.steps;
    if (r.status === 'over') return 'over';
    if (r.status === 'stuck' && r.detail !== 'no suggestion') return `stuck ${r.detail}`;
    if (r.status === 'stuck') await page.waitForTimeout(20);
  }
  return done >= steps ? 'more' : 'slow';
}

// The live game state and log length, read from the page in test mode.
const snapshot = (page: Page) => page.evaluate(() => {
  const app = (window as unknown as { __babsha: { app: { session: { state: unknown } | null; events: unknown[] } } }).__babsha.app;
  return { state: JSON.stringify(app.session?.state ?? null), log: app.events.length };
});

test.describe('save and resume (FR-19)', () => {
  test('FR-19: a Pass & Play game survives a reload and continues where it stopped', async ({ page }) => {
    await startGame(page, ['human', 'human', 'human']);
    expect((await runSteps(page, 45)).status).toBe('more');
    const before = await snapshot(page);
    await page.reload();
    const card = page.getByTestId('saved-game');
    await expect(card).toBeVisible();
    await expect(card).toContainText('3 players (3 on this phone)');
    await page.screenshot({ path: 'docs/screenshots/s7-continue-en.png' });
    await page.getByTestId('continue').click();
    // Several people share the phone, so a mid-turn resume is covered until someone taps.
    const cover = page.getByTestId('resume-cover').or(page.getByTestId('handoff'));
    await expect(cover).toBeVisible();
    const after = await snapshot(page);
    expect(after.state).toBe(before.state);
    expect(after.log).toBe(before.log);
    expect(after.log).toBeGreaterThan(5);
    expect((await runSteps(page, 20)).status).not.toBe('stuck');
  });

  test('FR-19: against the computer, the computer players carry on after the resume', async ({ page }) => {
    await startGame(page, ['human', 'easy']);
    expect(await play(page, 30)).toBe('more');
    await page.reload();
    await page.getByTestId('continue').click();
    const turns = await page.evaluate(() => (window as unknown as { __babsha: { app: { session: { state: { turnCount: number } } } } }).__babsha.app.session.state.turnCount);
    expect(await play(page, 30)).toMatch(/more|over/);
    const later = await page.evaluate(() => (window as unknown as { __babsha: { app: { session: { state: { turnCount: number } } } } }).__babsha.app.session.state.turnCount);
    expect(later).toBeGreaterThan(turns);
  });

  test('FR-19: a fresh device shows no saved game, and a finished game is not offered', async ({ page }) => {
    await page.goto('/?test=1&lang=en');
    await expect(page.getByTestId('start')).toBeVisible();
    await expect(page.getByTestId('saved-game')).toHaveCount(0);
    await startGame(page, ['human', 'easy']);
    test.setTimeout(300_000);
    expect(await play(page, 20_000)).toBe('over');
    await page.reload();
    await expect(page.getByTestId('start')).toBeVisible();
    await expect(page.getByTestId('saved-game')).toHaveCount(0);
  });
});
