import { describe, expect, it } from 'vitest';
import cardsDoc from '../../data/cards.json';
import tilesDoc from '../../data/tiles.json';
import en from '../../data/en.json';
import bn from '../../data/bn.json';

const strings = { en: en as Record<string, string>, bn: bn as Record<string, string> };
const tileIds = new Set(tilesDoc.tiles.map((t) => t.id));
const effectTypes = new Set(Object.keys(cardsDoc.effectTypes));

// Placeholders each effect type fills. {salary} is filled from config by any card.
const PLACEHOLDERS: Record<string, string[]> = {
  collect: ['amount'], pay: ['amount'], collectFromEach: ['amount'], payEach: ['amount'],
  moveTo: ['tile'], moveBy: ['steps'], goToJam: [], jamFreeCard: [], repairs: ['perHouse', 'perHotel'],
};

describe('cards.json (FR-09, plan 3.8)', () => {
  const decks = Object.entries(cardsDoc.decks);

  it('FR-09: has exactly two decks, Lucky and DOHS, with 16 cards each', () => {
    expect(Object.keys(cardsDoc.decks)).toEqual(['lucky', 'dohs']);
    for (const [, cards] of decks) expect(cards).toHaveLength(16);
  });

  it('FR-09: card ids are unique and every effect type is a declared type', () => {
    const ids = decks.flatMap(([, c]) => c.map((x) => x.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const [, cards] of decks) for (const c of cards) expect(effectTypes.has(c.effect.type), c.id).toBe(true);
  });

  it('FR-09: moveTo cards point at real tiles', () => {
    for (const [, cards] of decks)
      for (const c of cards) if (c.effect.type === 'moveTo') expect(tileIds.has((c.effect as { tile: string }).tile), c.id).toBe(true);
  });

  it('FR-15: every card text exists in both languages and uses only the placeholders its effect fills', () => {
    for (const [, cards] of decks)
      for (const c of cards)
        for (const lang of ['en', 'bn'] as const) {
          const text = strings[lang][c.textKey];
          expect(text, `${lang} ${c.textKey}`).toBeTruthy();
          const used = [...text!.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
          const allowed = new Set([...(PLACEHOLDERS[c.effect.type] ?? []), 'salary']);
          for (const u of used) expect(allowed.has(u!), `${lang} ${c.textKey} uses {${u}}`).toBe(true);
          for (const need of PLACEHOLDERS[c.effect.type] ?? []) expect(used, `${lang} ${c.textKey} needs {${need}}`).toContain(need);
        }
  });
});
