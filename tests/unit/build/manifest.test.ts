import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import app from '../../../data/app.json';
import { ICONS, headTags, webManifest } from '../../../src/build/manifest';

const pngSize = (file: string) => {
  const b = readFileSync(new URL(`../../../assets/${file}`, import.meta.url));
  expect(b.subarray(1, 4).toString()).toBe('PNG');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

describe('installable web app (plan phase 6, D-102)', () => {
  it('phase 6: the manifest has what browsers need to install the game, relative to wherever it is hosted', () => {
    const m = webManifest({ name: 'Babsha', lang: 'en', ...app.install });
    expect(m).toMatchObject({ name: 'Babsha', short_name: 'Babsha', start_url: './', scope: './', id: './', display: 'standalone', orientation: 'portrait' });
    expect(m.theme_color).toBe(app.install.themeColor);
    expect(m.icons.map((i) => `${i.sizes} ${i.purpose}`)).toEqual(['192x192 any', '512x512 any', '512x512 maskable']);
    expect(m.icons.every((i) => !i.src.startsWith('/'))).toBe(true);
  });

  it('phase 6: every icon exists in assets/icons at its stated size', () => {
    for (const icon of ICONS) {
      expect(existsSync(new URL(`../../../assets/${icon.file}`, import.meta.url)), icon.file).toBe(true);
      expect(pngSize(icon.file), icon.file).toEqual([icon.size, icon.size]);
    }
  });

  it('phase 6: the page links the manifest, a favicon and the iOS home screen icon', () => {
    const tags = headTags('#094C33');
    expect(tags.map((t) => t.attrs.rel ?? t.attrs.name)).toEqual(['manifest', 'icon', 'apple-touch-icon', 'theme-color']);
    expect(tags.find((t) => t.attrs.rel === 'apple-touch-icon')!.attrs.href).toBe('icons/apple-touch-icon.png');
  });
});
