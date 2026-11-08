import { expect, test } from '@playwright/test';
import { runSteps } from './helpers';

test.describe('game settings (FR-14)', () => {
  test('FR-14, R-07: the chosen start cash is what every player starts with', async ({ page }) => {
    await page.goto('/?test=1&lang=en');
    await expect(page.getByTestId('cash-10000')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('timer-off')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('cash-15000').click();
    await page.screenshot({ path: 'docs/screenshots/s7-settings-en.png' });
    await page.getByTestId('count-3').click();
    await page.getByTestId('start').click();
    for (const i of [0, 1, 2]) await expect(page.getByTestId(`player-${i}`)).toContainText('৳15,000');
    await expect(page.getByTestId('timer')).toHaveCount(0);
  });

  test('FR-14, D-34, R-18: with the timer on, an unanswered buy decision runs out after 30 seconds and goes to auction', async ({ page }) => {
    await page.clock.install();
    await page.goto('/?test=1&lang=en');
    await page.getByTestId('timer-on').click();
    await page.getByTestId('start').click();
    for (let i = 0; i < 300 && !(await page.getByTestId('deed').isVisible()); i++) await runSteps(page, 1);
    await expect(page.getByTestId('deed')).toBeVisible();
    const timer = page.getByTestId('timer');
    await expect(timer).toBeVisible();
    await expect(timer).toHaveText('30');
    await page.screenshot({ path: 'docs/screenshots/s7-timer-en.png' });
    await page.clock.fastForward(20_000);
    await expect(timer).toHaveText('10');
    await expect(page.getByTestId('deed')).toBeVisible();
    await page.clock.fastForward(11_000);
    await expect(page.getByTestId('deed')).toBeHidden();
    await expect(page.getByTestId('auction')).toBeVisible();
    // A new decision (the first bid) starts a fresh 30 seconds.
    await expect(timer).toHaveText('30');
  });

  test('FR-14, D-34: no timer before the roll or at the hand-off', async ({ page }) => {
    await page.clock.install();
    await page.goto('/?test=1&lang=en');
    await page.getByTestId('timer-on').click();
    await page.getByTestId('start').click();
    await expect(page.getByTestId('handoff')).toBeVisible();
    await expect(page.getByTestId('timer')).toBeHidden();
    await page.getByTestId('handoff').getByRole('button').click();
    await expect(page.getByTestId('timer')).toBeHidden();
    await page.clock.fastForward(60_000);
    await expect(page.locator('.main-row [data-action*="\\"ROLL\\""]')).toBeVisible();
  });
});
