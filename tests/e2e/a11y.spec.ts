import { expect, test, type Page } from '@playwright/test';
import { runSteps } from './helpers';

// Plan 2.2 and phase 5 accessibility: contrast on every text and background pair, tap targets
// of at least 44 by 44 points, on the narrowest phone in scope (375 points wide), both languages.
test.use({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, actionTimeout: 10_000 });

interface Problem { screen: string; kind: 'contrast' | 'tap'; text: string; detail: string }

// Runs in the page: every visible text against the colors actually behind it, and every control's size.
async function audit(page: Page, screen: string): Promise<Problem[]> {
  return page.evaluate((screenName) => {
    type C = { r: number; g: number; b: number; a: number };
    const parse = (s: string): C => {
      const m = /rgba?\(([^)]+)\)/.exec(s);
      if (!m) return { r: 0, g: 0, b: 0, a: 0 };
      const p = m[1]!.split(/[\s,/]+/).filter(Boolean).map(Number);
      return { r: p[0]!, g: p[1]!, b: p[2]!, a: p[3] ?? 1 };
    };
    const over = (top: C, under: C): C => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
    const lum = (c: C) => {
      const f = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const ratio = (a: C, b: C) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };
    const hex = (c: C) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
    const shown = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !el.closest('[hidden]') && getComputedStyle(el).visibility !== 'hidden'; };
    // Background layers from the element up to the first opaque one; gradients use their first color.
    const background = (el: Element): C => {
      const layers: C[] = [];
      for (let e: Element | null = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        let c = parse(cs.backgroundColor);
        if (c.a === 0 && cs.backgroundImage.includes('gradient')) c = parse(cs.backgroundImage);
        if (c.a > 0) { layers.push(c); if (c.a >= 1) break; }
      }
      let base: C = { r: 255, g: 255, b: 255, a: 1 };
      for (const l of layers.reverse()) base = over(l, base);
      return base;
    };
    const opacity = (el: Element) => { let o = 1; for (let e: Element | null = el; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity); return o; };
    const out: Array<{ screen: string; kind: 'contrast' | 'tap'; text: string; detail: string }> = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set<Element>();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      const text = n.textContent?.trim();
      if (!el || !text || seen.has(el) || !shown(el)) continue;
      seen.add(el);
      // WCAG 1.4.3 exempts inactive controls.
      if (el.closest('button:disabled, [aria-disabled="true"], option')) continue;
      const cs = getComputedStyle(el);
      const bg = background(el);
      const fgRaw = parse(cs.color);
      const fg = over({ ...fgRaw, a: fgRaw.a * opacity(el) }, bg);
      const size = parseFloat(cs.fontSize);
      const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
      const need = large ? 3 : 4.5;
      const got = ratio(fg, bg);
      if (got < need) out.push({ screen: screenName, kind: 'contrast', text: text.slice(0, 40), detail: `${got.toFixed(2)} < ${need} (${hex(fg)} on ${hex(bg)}, ${size}px, .${el.className || el.tagName})` });
    }
    for (const el of Array.from(document.querySelectorAll('button, select, input, a[href], [role="button"]'))) {
      if (!shown(el)) continue;
      // A checkbox is tapped through its whole label row.
      const target = el.matches('input[type="checkbox"], input[type="radio"]') ? el.closest('label') ?? el : el;
      const r = target.getBoundingClientRect();
      if (r.width < 43.5 || r.height < 43.5) out.push({ screen: screenName, kind: 'tap', text: (target.textContent ?? '').trim().slice(0, 40) || target.getAttribute('aria-label') || target.tagName, detail: `${r.width.toFixed(0)} by ${r.height.toFixed(0)} (.${(target as HTMLElement).className || target.tagName})` });
    }
    return out;
  }, screen);
}

const shown = (page: Page, id: string) => page.getByTestId(id).isVisible().catch(() => false);

async function stepUntil(page: Page, done: () => Promise<boolean>, max = 400): Promise<void> {
  for (let i = 0; i < max && !(await done()); i++) await runSteps(page, 1);
}

for (const lang of ['en', 'bn'] as const) {
  test(`plan 2.2 accessibility (${lang}): contrast and 44 point tap targets on every screen`, async ({ page }) => {
    test.setTimeout(240_000);
    const problems: Problem[] = [];
    await page.goto(`/?test=1&lang=${lang}`);
    problems.push(...await audit(page, 'setup'));
    await page.getByTestId('timer-on').click();
    await page.getByTestId('start').click();
    problems.push(...await audit(page, 'handoff'));
    await stepUntil(page, () => shown(page, 'deed'));
    problems.push(...await audit(page, 'deed and timer'));
    await page.locator('[data-testid="deed"] [data-action*="DECLINE"]').click();
    await expect(page.getByTestId('auction')).toBeVisible();
    problems.push(...await audit(page, 'auction'));
    await stepUntil(page, () => shown(page, 'card'));
    await expect(page.getByTestId('card')).toBeVisible();
    problems.push(...await audit(page, 'card'));
    await stepUntil(page, async () => (await page.locator('.main-row [data-action*="\\"ROLL\\""]').isVisible()) && (await page.getByTestId('act-trade').isEnabled()) && (await page.getByTestId('act-mortgage').isEnabled()), 3000);
    await page.getByTestId('act-trade').click();
    await page.locator('[data-testid^="trade-to-"]').first().click();
    problems.push(...await audit(page, 'trade'));
    await page.getByTestId('trade-cancel').click();
    await page.getByTestId('act-mortgage').click();
    problems.push(...await audit(page, 'manage'));
    await page.getByTestId('manage-close').click();
    await page.locator('.player').first().click();
    problems.push(...await audit(page, 'player details'));
    await page.getByTestId('info-close').click();
    await page.getByTestId('open-log').click();
    problems.push(...await audit(page, 'log'));
    await page.getByTestId('info-close').click();
    await page.reload();
    problems.push(...await audit(page, 'setup with saved game'));
    await page.getByTestId('continue').click();
    problems.push(...await audit(page, 'resume'));
    let r = await runSteps(page, 500);
    for (let i = 0; i < 60 && r.status === 'more'; i++) r = await runSteps(page, 500);
    expect(r.status).toBe('over');
    problems.push(...await audit(page, 'game over'));
    const lines = problems.map((p) => `${p.screen} | ${p.kind} | ${p.text} | ${p.detail}`);
    expect([...new Set(lines)]).toEqual([]);
  });
}
