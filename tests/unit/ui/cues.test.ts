import { describe, expect, it } from 'vitest';
import { CUES, cueFor } from '../../../src/audio/cues';
import type { GameEvent } from '../../../src/engine';

describe('sound cues (plan 3.10 audio set)', () => {
  it('the planned sounds exist: dice, buy, rent, card, auction bell, jam horn', () => {
    for (const c of ['dice', 'buy', 'rent', 'card', 'bell', 'horn'] as const) expect(CUES).toContain(c);
  });
  it('maps events to sounds by importance, and quiet events to nothing', () => {
    expect(cueFor({ type: 'diceRolled', player: 0, dice: [1, 2], total: 3, doubles: false })).toBe('dice');
    expect(cueFor({ type: 'auctionStarted', tileId: 'x', players: [0] })).toBe('bell');
    expect(cueFor({ type: 'sentToJam', player: 0, reason: 'goToJamTile' })).toBe('horn');
    expect(cueFor({ type: 'gameOver', winner: 0 })).toBe('fanfare');
    expect(cueFor({ type: 'turnStarted', player: 0 } as GameEvent)).toBeNull();
  });
});
