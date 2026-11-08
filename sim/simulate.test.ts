import { describe, expect, it } from 'vitest';
import tilesDoc from '../data/tiles.json';
import config from '../data/config.json';
import cardsDoc from '../data/cards.json';
import { createEngine, makeRules } from '../src/engine';
import { mkdirSync, writeFileSync } from 'node:fs';
import { simulate } from './simulate';

mkdirSync(new URL('./reports/', import.meta.url), { recursive: true });

const engine = createEngine(makeRules(tilesDoc, config, cardsDoc));

describe('S1 simulation (plan 4.3 acceptance check)', () => {
  it('1,000 random games of 2 to 6 players finish with no crash, no stuck turn and no broken invariant', () => {
    const report = simulate(engine, { games: 1000, maxActions: 1000, seed: 2026 });
    expect(report.games).toBe(1000);
    expect(report.violations.slice(0, 10)).toEqual([]);
    // The run must actually exercise the S1 rules, not idle.
    for (const type of ['salary', 'purchased', 'rentPaid', 'taxPaid', 'sentToJam', 'leftJam', 'jamFinePaid', 'stayedInJam', 'extraRoll', 'auctionStub', 'cardStub']) {
      expect(report.events[type] ?? 0, type).toBeGreaterThan(0);
    }
    const summary = { ...report, finalStates: undefined }; // states are too large for the report
    writeFileSync(new URL('./reports/s1-random.json', import.meta.url), JSON.stringify(summary, null, 2) + '\n');
  }, 120_000);

  it('plan 3.1: the same seed replays the same game exactly', () => {
    const a = simulate(engine, { games: 20, maxActions: 500, seed: 7 });
    const b = simulate(engine, { games: 20, maxActions: 500, seed: 7 });
    expect(a.finalStates).toEqual(b.finalStates);
    expect(a.finalStates.every((s) => s.turnCount > 0)).toBe(true);
  });
});
