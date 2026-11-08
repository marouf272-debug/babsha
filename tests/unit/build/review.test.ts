import { describe, expect, it } from 'vitest';
import { applyReview, parseCsv, reviewRows, toCsv } from '../../../src/build/review';

const en = { 'hud.turn': "{name}'s turn", 'setup.start': 'Start game', 'card.lucky_01': 'Collect {amount}.' };
const bn = { 'hud.turn': '{name}-এর পালা', 'setup.start': 'খেলা শুরু', 'card.lucky_01': '{amount} পান।' };
const pending = { status: 'x', keys: { 'hud.turn': 'needs native review', 'setup.start': 'needs native review', 'card.lucky_01': 'needs native review' } };

describe('Bangla review sheet (plan 5 Bangla review, FR-15, D-95)', () => {
  it('FR-15: the sheet lists every string still waiting for review, English beside Bangla', () => {
    const rows = reviewRows(en, bn, pending);
    expect(rows.map((r) => r.key)).toEqual(['card.lucky_01', 'hud.turn', 'setup.start']);
    expect(rows[1]).toMatchObject({ key: 'hud.turn', english: "{name}'s turn", bangla: '{name}-এর পালা', ok: '', correction: '' });
  });

  it('FR-15: the sheet survives a round trip through CSV, including commas, quotes and new lines', () => {
    const rows = reviewRows({ ...en, 'setup.start': 'Start, "now"\nplease' }, bn, pending);
    const back = parseCsv(toCsv(rows));
    expect(back).toEqual(rows.map((r) => ({ ...r })));
    expect(toCsv(rows).startsWith(String.fromCharCode(0xfeff))).toBe(true);
  });

  it('FR-15: approved rows leave the review list, corrections replace the Bangla, untouched rows stay', () => {
    const rows = reviewRows(en, bn, pending);
    rows.find((r) => r.key === 'setup.start')!.ok = 'yes';
    rows.find((r) => r.key === 'hud.turn')!.correction = '{name}র পালা';
    const r = applyReview(rows, en, bn, pending);
    expect(r.errors).toEqual([]);
    expect(r.bn['hud.turn']).toBe('{name}র পালা');
    expect(r.bn['setup.start']).toBe('খেলা শুরু');
    expect(Object.keys(r.pending.keys)).toEqual(['card.lucky_01']);
    expect(r.summary).toEqual({ approved: 1, corrected: 1, waiting: 1 });
  });

  it('FR-15: a correction that drops a placeholder, adds an em dash or names an unknown key is refused', () => {
    const rows = reviewRows(en, bn, pending);
    rows.find((r) => r.key === 'card.lucky_01')!.correction = 'টাকা পান।';
    rows.find((r) => r.key === 'hud.turn')!.correction = `{name}${String.fromCharCode(0x2014)}পালা`;
    rows.push({ key: 'no.such', english: '', bangla: '', ok: 'yes', correction: '', note: '' });
    const r = applyReview(rows, en, bn, pending);
    expect(r.errors).toHaveLength(3);
    expect(r.bn).toEqual(bn);
    expect(r.pending).toEqual(pending);
  });
});
