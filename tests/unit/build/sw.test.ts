import { describe, expect, it } from 'vitest';
import { precacheList, serviceWorkerSource } from '../../../src/build/sw';

describe('offline service worker (plan 2.2 offline, D-94)', () => {
  const bundle = ['assets/index-abc.js', 'assets/index-def.css', 'assets/noto-sans-bengali-bengali-400-normal-x1.woff2', 'assets/index-abc.js.map'];

  it('plan 2.2: precaches the page and every built file the game needs, without source maps', () => {
    const files = precacheList(bundle);
    expect(files).toEqual(['./', 'index.html', 'assets/index-abc.js', 'assets/index-def.css', 'assets/noto-sans-bengali-bengali-400-normal-x1.woff2']);
  });

  it('plan 2.2: the cache name changes whenever a built file changes, so old caches are replaced', () => {
    const a = serviceWorkerSource(precacheList(bundle));
    const b = serviceWorkerSource(precacheList(['assets/index-xyz.js', ...bundle.slice(1)]));
    const name = (src: string) => /const CACHE = "(babsha-[0-9a-f]{12})"/.exec(src)?.[1];
    expect(name(a)).toBeDefined();
    expect(name(b)).toBeDefined();
    expect(name(a)).not.toBe(name(b));
    expect(serviceWorkerSource(precacheList(bundle))).toBe(a);
  });

  it('plan 2.2 privacy: the worker only touches same-origin GET requests and names no other host', () => {
    const src = serviceWorkerSource(precacheList(bundle));
    expect(src).toContain("request.method !== 'GET'");
    expect(src).toContain('url.origin !== self.location.origin');
    expect(src).not.toMatch(/https?:\/\//);
    expect(src).not.toContain(String.fromCharCode(0x2014));
  });
});
