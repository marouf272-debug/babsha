import { describe, expect, it } from 'vitest';
import { checkParity, parityErrors } from '../../src/i18n/parity';
import en from '../../data/en.json';
import bn from '../../data/bn.json';
import review from '../../data/bn-review.json';
import tilesDoc from '../../data/tiles.json';
import cardsDoc from '../../data/cards.json';

describe('language files (FR-15, plan 3.3)', () => {
  it('FR-15: en.json and bn.json have exactly the same keys and no empty strings', () => {
    expect(parityErrors(checkParity(en, bn))).toEqual([]);
  });

  it('FR-15: the parity check reports keys missing from either file', () => {
    const r = checkParity({ a: 'A', b: 'B' }, { a: 'ক', c: 'গ' });
    expect(r.missingInBn).toEqual(['b']);
    expect(r.missingInEn).toEqual(['c']);
    expect(parityErrors(r)).toHaveLength(2);
  });

  it('FR-15: every tile name, group name and card text key exists in both files', () => {
    const keys = [
      ...tilesDoc.tiles.map((t) => t.nameKey),
      ...tilesDoc.groups.map((g) => g.nameKey),
      ...Object.values(cardsDoc.decks).flatMap((d) => d.map((c) => c.textKey)),
    ];
    for (const k of keys) {
      expect(en, k).toHaveProperty([k]);
      expect(bn, k).toHaveProperty([k]);
    }
  });

  it('FR-15, D-99: every Bangla string is either waiting for native review or approved exactly as it reads now', () => {
    const approved: Record<string, string> = review.approved;
    const bnStrings: Record<string, string> = bn;
    const unreviewed = Object.keys(bnStrings).filter((k) => !(k in review.keys) && approved[k] !== bnStrings[k]);
    expect(unreviewed).toEqual([]);
    for (const k of [...Object.keys(review.keys), ...Object.keys(approved)]) expect(bn, `stale review key ${k}`).toHaveProperty([k]);
  });
});
