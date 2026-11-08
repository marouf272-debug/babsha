import { expect, type Page } from '@playwright/test';

type Action = { type: string; player?: number; tileId?: string; amount?: number; offer?: { to: number; giveTiles: string[]; getTiles: string[]; giveCash: number; getCash: number } };

const visible = async (page: Page, testId: string) => page.getByTestId(testId).isVisible().catch(() => false);

// Clicks the button whose data-action matches the action (type, and player/tile/amount when given).
async function clickAction(page: Page, a: Action): Promise<boolean> {
  const handle = await page.evaluateHandle((want) => {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-action]'))) {
      if (el.offsetParent === null || (el as HTMLButtonElement).disabled) continue;
      const got = JSON.parse(el.dataset['action']!) as Record<string, unknown>;
      if (got['type'] !== want.type) continue;
      if (got['tileId'] !== undefined && got['tileId'] !== want.tileId) continue;
      if (got['amount'] !== undefined && got['amount'] !== want.amount) continue;
      if (got['player'] !== undefined && want.player !== undefined && got['player'] !== want.player) continue;
      return el;
    }
    return null;
  }, a);
  const el = handle.asElement();
  if (!el) return false;
  await el.click();
  return true;
}

// Plays one human decision through the interface, using the move the Medium AI suggests.
export async function playOneStep(page: Page): Promise<'over' | 'acted' | 'waiting'> {
  if (await visible(page, 'game-over')) return 'over';
  // A computer player's card closes by itself, so it may vanish before the click lands.
  if (await visible(page, 'card')) { await page.getByTestId('card-ok').click({ timeout: 1000 }).catch(() => {}); return 'acted'; }
  if (await visible(page, 'handoff-trade')) { await page.getByTestId('reveal-trade').click({ timeout: 1000 }).catch(() => {}); return 'acted'; }
  const a = await page.evaluate(() => (window as unknown as { __babsha: { app: { suggest(): unknown } } }).__babsha.app.suggest()) as Action | null;
  if (!a) return 'waiting';
  switch (a.type) {
    case 'BUILD': case 'SELL_BUILDING': case 'MORTGAGE': case 'REDEEM': {
      const ids: Record<string, string> = { BUILD: 'act-build', SELL_BUILDING: 'act-sell', MORTGAGE: 'act-mortgage', REDEEM: 'act-redeem' };
      const open = await page.locator('.tool.on').getAttribute('data-testid').catch(() => null);
      if (!(await visible(page, 'debt')) && open !== ids[a.type]) await page.getByTestId(ids[a.type]!).click();
      break;
    }
    case 'DECLARE_BANKRUPTCY':
      await page.getByTestId('bankrupt').click();
      break;
    case 'PROPOSE_TRADE': {
      const o = a.offer!;
      await page.getByTestId('act-trade').click();
      await page.getByTestId(`trade-to-${o.to}`).click();
      for (const id of o.giveTiles) await page.getByTestId(`trade-give-${id}`).check();
      for (const id of o.getTiles) await page.getByTestId(`trade-get-${id}`).check();
      await page.getByTestId('trade-giveCash').fill(String(o.giveCash));
      await page.getByTestId('trade-getCash').fill(String(o.getCash));
      await page.getByTestId('trade-propose').click();
      return 'acted';
    }    default:
      // D-87: a tool can be open before rolling or while buying; close it for any other move.
      if (await page.locator('.tool.on').count()) await page.locator('.tool.on').click();
  }
  const ok = await clickAction(page, a);
  expect(ok, `no button for ${JSON.stringify(a)}`).toBe(true);
  return 'acted';
}

export async function startGame(page: Page, seats: string[], lang = 'en'): Promise<void> {
  await page.goto(`/?test=1&lang=${lang}`);
  await page.getByTestId(`count-${seats.length}`).click();
  for (const [i, s] of seats.entries()) await page.getByTestId(`seat-${i}`).selectOption(s);
  await page.getByTestId('start').click();
}

// Visible text of every element with its own text, for the language check.
export async function visibleTexts(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent?.trim();
      const el = n.parentElement;
      if (!text || !el || el.offsetParent === null || el.closest('[hidden]')) continue;
      out.push(text);
    }
    return out;
  });
}

// Fast driver for whole games: runs up to `max` human decisions inside the page, each by
// clicking the real button (or filling the real trade form) that matches the Medium AI's move.
// Returns 'over' when the game-over screen shows, 'stuck' if no button matched, else 'more'.
export async function runSteps(page: Page, max: number): Promise<{ status: 'over' | 'stuck' | 'more'; steps: number; detail?: string }> {
  return page.evaluate((limit) => {
    type A = { type: string; player?: number; tileId?: string; amount?: number; offer?: { to: number; giveTiles: string[]; getTiles: string[]; giveCash: number; getCash: number } };
    const shown = (id: string) => { const el = document.querySelector<HTMLElement>(`[data-testid="${id}"]`); return el && el.offsetParent !== null ? el : null; };
    const press = (id: string) => { const el = shown(id); if (!el) return false; el.click(); return true; };
    const pressAction = (want: A) => {
      for (const el of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-action]'))) {
        if (el.offsetParent === null || el.disabled) continue;
        const got = JSON.parse(el.dataset['action']!) as A;
        if (got.type !== want.type) continue;
        if (got.tileId !== undefined && got.tileId !== want.tileId) continue;
        if (got.amount !== undefined && got.amount !== want.amount) continue;
        if (got.player !== undefined && want.player !== undefined && got.player !== want.player) continue;
        el.click();
        return true;
      }
      return false;
    };
    const app = (window as unknown as { __babsha: { app: { suggest(): A | null } } }).__babsha.app;
    for (let i = 0; i < limit; i++) {
      if (shown('game-over')) return { status: 'over' as const, steps: i };
      if (press('card-ok') || press('reveal-trade') || press('resume-go')) continue;
      const a = app.suggest();
      if (!a) return { status: 'stuck' as const, steps: i, detail: 'no suggestion' };
      const opener: Record<string, string> = { BUILD: 'act-build', SELL_BUILDING: 'act-sell', MORTGAGE: 'act-mortgage', REDEEM: 'act-redeem' };
      const open = document.querySelector('.tool.on')?.getAttribute('data-testid');
      if (opener[a.type] && !shown('debt') && open !== opener[a.type]) press(opener[a.type]!);
      // D-87: a tool can be open before rolling or while buying; close it for any other move.
      if (!opener[a.type] && a.type !== 'PROPOSE_TRADE' && open) press(open);
      if (a.type === 'DECLARE_BANKRUPTCY') press('bankrupt');
      if (a.type === 'PROPOSE_TRADE') {
        const o = a.offer!;
        press('act-trade');
        press(`trade-to-${o.to}`);
        const tick = (id: string) => { const b = shown(id) as HTMLInputElement | null; if (b && !b.checked) { b.checked = true; b.dispatchEvent(new Event('change')); } };
        o.giveTiles.forEach((id) => tick(`trade-give-${id}`));
        o.getTiles.forEach((id) => tick(`trade-get-${id}`));
        const fill = (id: string, v: number) => { const f = shown(id) as HTMLInputElement | null; if (f) { f.value = String(v); f.dispatchEvent(new Event('input')); } };
        fill('trade-giveCash', o.giveCash);
        fill('trade-getCash', o.getCash);
        if (!press('trade-propose')) return { status: 'stuck' as const, steps: i, detail: JSON.stringify(a) };
        continue;
      }
      if (!pressAction(a)) return { status: 'stuck' as const, steps: i, detail: JSON.stringify(a) };
    }
    return { status: 'more' as const, steps: limit };
  }, max);
}
