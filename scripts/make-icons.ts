// Draws the home screen icons in code (plan phase 6, D-102) and writes them to assets/icons.
//   node scripts/make-icons.ts
// The letter is the first letter of the Bangla game name, in the bundled Noto Sans Bengali, on a
// rickshaw-art disc. Colors come from data/app.json. Uses the Chromium that Playwright installs.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { ICONS } from '../src/build/manifest.ts';

const root = new URL('..', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root));
const app = JSON.parse(read('data/app.json').toString()) as { icon: { background: string; disc: string; ring: string; dots: string[]; letter: string } };
const letter = Array.from((JSON.parse(read('data/bn.json').toString()) as Record<string, string>)['app.title']!)[0]!;
const font = read('node_modules/@fontsource/noto-sans-bengali/files/noto-sans-bengali-bengali-700-normal.woff2').toString('base64');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(`<style>@font-face{font-family:Icon;font-weight:700;src:url(data:font/woff2;base64,${font}) format('woff2')}</style>`);
await page.evaluate(() => document.fonts.load('700 100px Icon', 'ব'));
mkdirSync(new URL('assets/icons/', root), { recursive: true });

for (const icon of ICONS) {
  const png = await page.evaluate(({ size, maskable, c, letter }) => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const g = cv.getContext('2d')!;
    g.fillStyle = c.background;
    g.fillRect(0, 0, size, size);
    // A maskable icon keeps everything inside the central safe circle (radius 40 percent).
    const s = size * (maskable ? 0.8 : 1);
    const mid = size / 2;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      g.fillStyle = c.dots[i % c.dots.length]!;
      g.beginPath();
      g.arc(mid + Math.cos(a) * s * 0.4, mid + Math.sin(a) * s * 0.4, s * 0.035, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = c.ring;
    g.beginPath(); g.arc(mid, mid, s * 0.335, 0, Math.PI * 2); g.fill();
    g.fillStyle = c.disc;
    g.beginPath(); g.arc(mid, mid, s * 0.3, 0, Math.PI * 2); g.fill();
    g.fillStyle = c.letter;
    g.font = `700 ${Math.round(s * 0.44)}px Icon`;
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    const m = g.measureText(letter);
    g.fillText(letter, mid, mid + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
    return cv.toDataURL('image/png').split(',')[1]!;
  }, { size: icon.size, maskable: icon.purpose === 'maskable', c: app.icon, letter });
  writeFileSync(new URL(`assets/${icon.file}`, root), Buffer.from(png, 'base64'));
  console.log(`Wrote assets/${icon.file}`);
}
await browser.close();
