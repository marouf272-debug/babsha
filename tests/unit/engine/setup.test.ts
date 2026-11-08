import { describe, expect, it } from 'vitest';
import tilesDoc from '../../../data/tiles.json';
import config from '../../../data/config.json';
import { makeRules } from '../../../src/engine';
import { engine, newGame, ofType, rules } from './helpers';

describe('game setup (FR-01, R-06 to R-09)', () => {
  it('FR-01: the board has 40 tiles', () => {
    expect(rules.tiles).toHaveLength(40);
  });

  it('FR-01: accepts 2 to 6 players and rejects 1 and 7', () => {
    for (let n = 2; n <= 6; n++) expect(newGame(n).state.players).toHaveLength(n);
    expect(() => newGame(1)).toThrow();
    expect(() => newGame(7)).toThrow();
  });

  it('R-07: every player starts on GO with the configured start cash', () => {
    const { state } = newGame(4);
    for (const p of state.players) {
      expect(p.position).toBe(0);
      expect(p.cash).toBe(10000);
      expect(p.inJam).toBe(false);
    }
  });

  it('R-07, FR-14: start cash can be set in game settings', () => {
    const { state } = engine.newGame({ playerIds: ['a', 'b'], seed: 3, startCash: 15000 });
    expect(state.players.map((p) => p.cash)).toEqual([15000, 15000]);
  });

  it('R-09, D-17: the first player is the highest order roll, and ties re-roll among the tied players', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { state, events } = newGame(4, seed);
      const rounds = ofType(events, 'orderRoll');
      expect(rounds.length).toBeGreaterThan(0);
      const last = rounds[rounds.length - 1]!;
      const best = Math.max(...last.rolls.map((r) => r.total));
      const winners = last.rolls.filter((r) => r.total === best);
      expect(winners).toHaveLength(1);
      expect(state.turn.active).toBe(winners[0]!.player);
      // Every round after the first contains only players tied at the top of the previous round.
      for (let i = 1; i < rounds.length; i++) {
        const prev = rounds[i - 1]!.rolls;
        const top = Math.max(...prev.map((r) => r.total));
        expect(rounds[i]!.rolls.map((r) => r.player)).toEqual(prev.filter((r) => r.total === top).map((r) => r.player));
      }
    }
  });

  it('plan 3.1: the same seed and players give the same starting state', () => {
    expect(newGame(5, 99)).toEqual(newGame(5, 99));
  });

  it('plan 3.2: a new game starts at START_TURN with the hand-off', () => {
    const { state } = newGame(3);
    expect(state.turn.phase).toBe('START_TURN');
    expect(engine.legalActions(state)).toEqual([{ type: 'BEGIN_TURN' }]);
  });

  it('rejects an illegal action without changing the state', () => {
    const { state } = newGame(2);
    const before = structuredClone(state);
    expect(() => engine.step(state, { type: 'ROLL' })).toThrow(/not legal/);
    expect(state).toEqual(before);
  });

  it('FR-01: the rules loader rejects an unknown tile type or a property without a full rent schedule', () => {
    const badType = structuredClone(tilesDoc);
    badType.tiles[2]!.type = 'casino';
    expect(() => makeRules(badType, config)).toThrow(/unknown type/);
    const badRent = structuredClone(tilesDoc);
    badRent.tiles[1]!.rent = [20, 100];
    expect(() => makeRules(badRent, config)).toThrow(/rent steps/);
  });
});
