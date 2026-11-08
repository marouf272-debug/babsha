import { afterEach, describe, expect, it } from 'vitest';
import { describeLines } from '../../../src/ui/describe';
import { setLang } from '../../../src/i18n';
import { engine } from '../engine/helpers';

const state = engine.newGame({ playerIds: ['a', 'b'], seed: 1 }).state;

describe('event log lines (D-89)', () => {
  afterEach(() => setLang('en'));

  it('FR-08, D-89: an accepted trade logs both sides by player name', () => {
    const offer = { from: 0, to: 1, giveTiles: ['motijheel'], getTiles: [], giveCash: 0, getCash: 500 };
    const lines = describeLines({ type: 'tradeAccepted', offer }, state, engine.rules);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('Motijheel');
    expect(lines[1]).toContain('Rickshaw');
    expect(lines[1]).toContain('CNG');
    expect(lines[1]).not.toMatch(/\byou\b/i);
  });

  it('FR-09, D-89: a drawn card logs the card text and who drew it', () => {
    const card = engine.rules.cards.lucky[0]!;
    const [line] = describeLines({ type: 'cardDrawn', player: 1, deck: 'lucky', cardId: card.id }, state, engine.rules);
    expect(line).toContain('CNG');
    expect(line).toContain('Metro Rail');
  });

  it('FR-15: log lines follow the language toggle', () => {
    const e = { type: 'mortgaged' as const, player: 0, tileId: 'motijheel', amount: 0 };
    const en = describeLines(e, state, engine.rules)[0];
    setLang('bn');
    const bn = describeLines(e, state, engine.rules)[0];
    expect(bn).not.toBe(en);
  });
});
