import { describe, expect, it } from 'vitest';
import tilesDoc from '../data/tiles.json';
import config from '../data/config.json';
import cardsDoc from '../data/cards.json';
import profilesDoc from '../data/ai-profiles.json';
import { createEngine, makeRules } from '../src/engine';
import { createAi, type AiProfile } from '../src/ai';
import { playAiGame } from './ai-games';

const engine = createEngine(makeRules(tilesDoc, config, cardsDoc));
const ai = createAi(engine);
const P = profilesDoc.profiles as Record<'easy' | 'medium' | 'hard', AiProfile>;
const seat = (id: 'easy' | 'medium' | 'hard') => ({ id, profile: P[id] });

describe('computer-only games (FR-13, plan 1.5 success criterion 2)', () => {
  it('FR-13: games of every difficulty and 2 to 6 players run to a winner with no broken invariant', () => {
    const ids = ['easy', 'medium', 'hard'] as const;
    for (let g = 0; g < 30; g++) {
      const n = 2 + (g % 5);
      const r = playAiGame(engine, ai, { seed: 5000 + g, profiles: Array.from({ length: n }, (_, i) => seat(ids[(g + i) % 3]!)), maxTurns: 4000, checkInvariants: true });
      expect(r.violations.slice(0, 5), `seed ${r.seed}`).toEqual([]);
      expect(r.finished, `seed ${r.seed} with ${n} players`).toBe(true);
    }
  }, 120_000);

  it('FR-13: Hard beats Easy in head-to-head games, with seats swapped half the time', () => {
    let hard = 0;
    const games = 60;
    for (let g = 0; g < games; g++) {
      const hardFirst = g % 2 === 0;
      const r = playAiGame(engine, ai, { seed: 7000 + g, profiles: hardFirst ? [seat('hard'), seat('easy')] : [seat('easy'), seat('hard')], maxTurns: 4000, checkInvariants: false });
      if (r.winner === (hardFirst ? 0 : 1)) hard++;
    }
    expect(hard / games).toBeGreaterThan(0.6);
  }, 120_000);
});
