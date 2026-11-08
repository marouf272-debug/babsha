// Card artwork (S6), drawn in code: a rickshaw-art border of flowers and dots around a round
// medallion with the card's effect icon. Lucky is pink, DOHS is teal (style guide 3).

import type { CardEffect } from '../engine';
import { icon } from './icons';

const NS = 'http://www.w3.org/2000/svg';

export function cardArt(deck: 'lucky' | 'dohs', effect: CardEffect['type'], palette: Record<string, string>): HTMLElement {
  const main = deck === 'lucky' ? '#C42A72' : '#0E7C88';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 300 120');
  svg.setAttribute('class', 'card-art');
  svg.setAttribute('aria-hidden', 'true');
  const el = (tag: string, attrs: Record<string, string | number>) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    svg.append(e);
    return e;
  };
  el('rect', { x: 0, y: 0, width: 300, height: 120, rx: 14, fill: main });
  el('rect', { x: 8, y: 8, width: 284, height: 104, rx: 10, fill: 'none', stroke: palette['rickYellow']!, 'stroke-width': 3 });
  // Flowers along the border, alternating colors, with dots between them.
  const petals = [palette['rickYellow']!, '#FFFFFF', palette['rickTeal']!];
  for (let k = 0; k < 9; k++) {
    for (const y of [22, 98]) {
      const x = 22 + k * 32;
      const c = petals[(k + (y > 50 ? 1 : 0)) % petals.length]!;
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        el('circle', { cx: x + Math.cos(a) * 5, cy: y + Math.sin(a) * 5, r: 3.6, fill: c });
      }
      el('circle', { cx: x, cy: y, r: 2.6, fill: palette['rickRed']! });
      if (k < 8) el('circle', { cx: x + 16, cy: y, r: 1.8, fill: '#FFFFFF' });
    }
  }
  el('circle', { cx: 150, cy: 60, r: 30, fill: '#FFFFFF' });
  el('circle', { cx: 150, cy: 60, r: 30, fill: 'none', stroke: palette['rickYellow']!, 'stroke-width': 4 });
  const wrap = document.createElement('div');
  wrap.className = 'card-art-wrap';
  wrap.append(svg);
  const ic = icon(effect, 30, main);
  ic.setAttribute('class', 'card-icon');
  wrap.append(ic);
  return wrap;
}
