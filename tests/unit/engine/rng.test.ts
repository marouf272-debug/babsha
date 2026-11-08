import { describe, expect, it } from 'vitest';
import { nextFloat, rollDice } from '../../../src/engine';

describe('seeded random numbers (plan 3.1, D-27)', () => {
  it('pins the first outputs of the generator for seed 1, so replays survive refactors', () => {
    let s = 1;
    const out: number[] = [];
    for (let i = 0; i < 4; i++) {
      const [v, next] = nextFloat(s);
      out.push(Math.floor(v * 1e9));
      s = next;
    }
    // Pinned once from the Mulberry32 reference algorithm. A change here breaks every saved replay.
    expect(out).toEqual(PINNED);
  });

  it('is deterministic: the same state gives the same value and the same next state', () => {
    expect(nextFloat(12345)).toEqual(nextFloat(12345));
  });

  it('FR-01: two six-sided dice give faces 1 to 6 with a roughly even spread', () => {
    const counts = new Array(7).fill(0);
    let s = 42;
    for (let i = 0; i < 60_000; i++) {
      const r = rollDice(s, 2, 6);
      s = r.rng;
      for (const d of r.dice) counts[d]++;
    }
    expect(counts[0]).toBe(0);
    for (let f = 1; f <= 6; f++) expect(Math.abs(counts[f] / 120_000 - 1 / 6)).toBeLessThan(0.01);
  });
});

const PINNED = [627073940, 2735721, 527447039, 981050967];
