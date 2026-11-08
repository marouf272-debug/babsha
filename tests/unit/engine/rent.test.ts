import { describe, expect, it } from 'vitest';
import type { GameState } from '../../../src/engine';
import { edit, newGame, ofType, ready, rollAs } from './helpers';

const start = () => ready(newGame(2, 5).state);
const other = (s: GameState) => (s.turn.active + 1) % 2;
const own = (s: GameState, ids: string[], houses = 0, mortgaged = false) => {
  for (const id of ids) s.properties[id] = { owner: other(s), houses, mortgaged };
};
const at = (p: number) => (s: GameState) => { s.players[s.turn.active]!.position = p; };

describe('rent and tax (FR-05, R-23 to R-29)', () => {
  it('FR-05: unbuilt property rent is the first step of its schedule', () => {
    const s0 = edit(start(), (s) => own(s, ['chawk_bazar']));
    const { state, events } = rollAs(s0, 1, 2);
    expect(ofType(events, 'rentPaid')).toEqual([{ type: 'rentPaid', from: s0.turn.active, to: other(s0), tileId: 'chawk_bazar', amount: 20 }]);
    expect(state.players[s0.turn.active]!.cash).toBe(9980);
    expect(state.players[other(s0)]!.cash).toBe(10020);
  });

  it('FR-05: unbuilt rent doubles when the owner holds the full color set', () => {
    const s0 = edit(start(), (s) => own(s, ['puran_dhaka', 'chawk_bazar']));
    expect(ofType(rollAs(s0, 1, 2).events, 'rentPaid')[0]!.amount).toBe(40);
  });

  it('FR-05: rent with houses follows the schedule and is not doubled', () => {
    for (const [houses, rent] of [[1, 100], [2, 300], [3, 1800], [4, 2400]] as const) {
      const s0 = edit(start(), (s) => own(s, ['puran_dhaka', 'chawk_bazar'], houses));
      expect(ofType(rollAs(s0, 1, 2).events, 'rentPaid')[0]!.amount).toBe(rent);
    }
  });

  it('FR-05: hotel rent is the last step of the schedule', () => {
    const s0 = edit(start(), (s) => own(s, ['puran_dhaka', 'chawk_bazar'], 5));
    expect(ofType(rollAs(s0, 1, 2).events, 'rentPaid')[0]!.amount).toBe(3000);
  });

  it('FR-05: hub rent is 250, 500, 1000 and 2000 for 1, 2, 3 and 4 hubs owned', () => {
    const hubs = ['kamalapur', 'sadarghat', 'gabtoli', 'airport'];
    [250, 500, 1000, 2000].forEach((rent, i) => {
      const s0 = edit(start(), (s) => own(s, hubs.slice(0, i + 1)));
      expect(ofType(rollAs(s0, 2, 3).events, 'rentPaid')[0]!.amount).toBe(rent);
    });
  });

  it('FR-05: utility rent is the dice total times 40 with one utility, times 100 with both', () => {
    const one = edit(start(), (s) => { own(s, ['desco']); at(1)(s); });
    expect(ofType(rollAs(one, 5, 6).events, 'rentPaid')[0]!.amount).toBe(11 * 40);
    const both = edit(start(), (s) => { own(s, ['desco', 'wasa']); at(1)(s); });
    expect(ofType(rollAs(both, 5, 6).events, 'rentPaid')[0]!.amount).toBe(11 * 100);
  });

  it('FR-05, D-16: a mortgaged property collects no rent', () => {
    const s0 = edit(start(), (s) => own(s, ['chawk_bazar'], 0, true));
    const { state, events } = rollAs(s0, 1, 2);
    expect(ofType(events, 'rentPaid')).toHaveLength(0);
    expect(ofType(events, 'rentWaived')).toEqual([{ type: 'rentWaived', tileId: 'chawk_bazar', reason: 'mortgaged' }]);
    expect(state.players[s0.turn.active]!.cash).toBe(10000);
  });

  it('FR-05, D-22: an owner in Jam still collects rent', () => {
    const s0 = edit(start(), (s) => { own(s, ['chawk_bazar']); s.players[other(s)]!.inJam = true; s.players[other(s)]!.position = 10; });
    expect(ofType(rollAs(s0, 1, 2).events, 'rentPaid')[0]!.amount).toBe(20);
  });

  it('R-28: Super Tax charges 1,000', () => {
    const { state, events } = rollAs(start(), 1, 3);
    expect(ofType(events, 'taxPaid')).toEqual([{ type: 'taxPaid', player: state.turn.active, tileId: 'super_tax', amount: 1000 }]);
  });

  it('R-29: City Tax charges 1,000', () => {
    const { events } = rollAs(edit(start(), at(35)), 1, 2);
    expect(ofType(events, 'taxPaid')[0]!.amount).toBe(1000);
  });
});
