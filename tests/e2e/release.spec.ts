import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { runSteps } from './helpers';

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string };

test.describe('release build (plan phase 6)', () => {
  test('phase 6, D-102: the page links an installable manifest and every icon loads', async ({ page, request }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBe('manifest.webmanifest');
    const res = await request.get(`/${href}`);
    expect(res.ok()).toBe(true);
    const manifest = await res.json() as { name: string; display: string; icons: Array<{ src: string; sizes: string }> };
    expect(manifest.name).toBe('Babsha');
    expect(manifest.display).toBe('standalone');
    const apple = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
    for (const src of [...manifest.icons.map((i) => i.src), apple!]) {
      const icon = await request.get(`/${src}`);
      expect(icon.ok(), src).toBe(true);
      expect(icon.headers()['content-type'], src).toContain('image/png');
    }
  });

  test('D-103: the setup screen and version.json both show the package version', async ({ page, request }) => {
    await page.goto('/?test=1');
    await expect(page.getByTestId('version')).toHaveText(`Version ${pkg.version}`);
    expect(await (await request.get('/version.json')).json()).toEqual({ version: pkg.version });
    await page.getByTestId('lang').click();
    await expect(page.getByTestId('version')).toContainText(pkg.version);
  });

  test('phase 6 release checklist: no tracking, no request ever leaves the site during a game', async ({ page, baseURL }) => {
    const outside: string[] = [];
    page.on('request', (r) => {
      const url = new URL(r.url());
      if (url.protocol !== 'data:' && url.protocol !== 'blob:' && url.origin !== new URL(baseURL!).origin) outside.push(r.url());
    });
    await page.goto('/?test=1&lang=bn');
    await page.getByTestId('start').click();
    expect((await runSteps(page, 120)).status).not.toBe('stuck');
    await page.reload();
    await page.getByTestId('continue').click();
    await runSteps(page, 20);
    expect(outside).toEqual([]);
  });
});
