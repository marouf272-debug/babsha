import { describe, expect, it } from 'vitest';
import type { GameState } from '../../../src/engine';
import { edit, engine, legalOf, managing, newGame, ofType, ready, rollAs, step } from './helpers';

describe('mortgage and redeem (FR-07, R-43, R-44, D-30, D-32, D-35)', () => {
  it('FR-07: mortgaging pays 50 percent of face value', () => {
    const s0 = managing({ chawk_bazar: {} });
    const me = s0.turn.active;
    const r = step(s0, { type: 'MORTGAGE', tileId: 'chawk_bazar' });
    expect(r.state.properties['chawk_bazar']!.mortgaged).toBe(true);
    expect(r.state.players[me]!.cash).toBe(10000 + 300);
    expect(ofType(r.events, 'mortgaged')).toEqual([{ type: 'mortgaged', player: me, tileId: 'chawk_bazar', amount: 300 }]);
  });

  it('FR-07: hubs and utilities mortgage at 50 percent of their price', () => {
    const r1 = step(managing({ kamalapur: {} }), { type: 'MORTGAGE', tileId: 'kamalapur' });
    expect(ofType(r1.events, 'mortgaged')[0]!.amount).toBe(1000);
    const r2 = step(managing({ desco: {} }), { type: 'MORTGAGE', tileId: 'desco' });
    expect(ofType(r2.events, 'mortgaged')[0]!.amount).toBe(750);
  });

  it('FR-07, D-30: a property can be mortgaged only when its whole set has no buildings', () => {
    const s0 = managing({ puran_dhaka: { houses: 1 }, chawk_bazar: { houses: 0 } });
    expect(legalOf(s0, 'MORTGAGE')).toEqual([]);
    expect(() => step(s0, { type: 'MORTGAGE', tileId: 'chawk_bazar' })).toThrow(/not legal/);
  });

  it('FR-07: a mortgaged property cannot be mortgaged again, and only the owner may mortgage', () => {
    expect(legalOf(managing({ chawk_bazar: { mortgaged: true } }), 'MORTGAGE')).toEqual([]);
    expect(legalOf(managing({ chawk_bazar: { owner: 99 } }), 'MORTGAGE')).toEqual([]);
  });

  it('FR-07: redeeming costs the principal plus 10 percent', () => {
    const s0 = managing({ chawk_bazar: { mortgaged: true } });
    const me = s0.turn.active;
    const r = step(s0, { type: 'REDEEM', tileId: 'chawk_bazar' });
    expect(r.state.properties['chawk_bazar']!.mortgaged).toBe(false);
    expect(r.state.players[me]!.cash).toBe(10000 - 330);
    expect(ofType(r.events, 'redeemed')).toEqual([{ type: 'redeemed', player: me, tileId: 'chawk_bazar', cost: 330 }]);
  });

  it('FR-07: redeeming needs enough cash', () => {
    const s0 = edit(managing({ chawk_bazar: { mortgaged: true } }), (s) => { s.players[s.turn.active]!.cash = 329; });
    expect(legalOf(s0, 'REDEEM')).toEqual([]);
  });

  it('D-87: mortgage and redeem are allowed on your turn before the roll', () => {
    const s0 = edit(ready(newGame(2, 41).state), (s) => {
      s.properties['chawk_bazar'] = { owner: s.turn.active, houses: 0, mortgaged: false };
      s.properties['basabo'] = { owner: s.turn.active, houses: 0, mortgaged: true };
    });
    expect(legalOf(s0, 'MORTGAGE')).toEqual(['chawk_bazar']);
    expect(legalOf(s0, 'REDEEM')).toEqual(['basabo']);
  });

  it('D-87: a player may mortgage to raise cash while deciding whether to buy', () => {
    const s0 = edit(ready(newGame(2, 41).state), (s) => {
      s.properties['kamalapur'] = { owner: s.turn.active, houses: 0, mortgaged: false };
      s.players[s.turn.active]!.cash = 100;
    });
    let r = rollAs(s0, 1, 2); // Chawk Bazar, 600
    expect(r.state.turn.phase).toBe('BUY_DECISION');
    expect(legalOf(r.state, 'BUY')).toEqual([]);
    r = step(r.state, { type: 'MORTGAGE', tileId: 'kamalapur' });
    expect(legalOf(r.state, 'BUY')).toEqual(['BUY']);
  });

  it('D-42: a player in Jam may mortgage and redeem', () => {
    const s0 = edit(managing({ chawk_bazar: {}, basabo: { mortgaged: true } }), (s) => { const p = s.players[s.turn.active]!; p.inJam = true; p.position = 10; });
    expect(legalOf(s0, 'MORTGAGE')).toEqual(['chawk_bazar']);
    expect(legalOf(s0, 'REDEEM')).toEqual(['basabo']);
  });

  it('FR-05, D-32: unbuilt rent still doubles when the owner holds the full set and one member is mortgaged', () => {
    const s0 = edit(ready(newGame(2, 5).state), (s: GameState) => {
      const o = (s.turn.active + 1) % 2;
      s.properties['puran_dhaka'] = { owner: o, houses: 0, mortgaged: true };
      s.properties['chawk_bazar'] = { owner: o, houses: 0, mortgaged: false };
    });
    expect(ofType(rollAs(s0, 1, 2).events, 'rentPaid')[0]!.amount).toBe(40);
  });

  it('FR-05, D-35: mortgaged hubs still count toward the number of hubs owned', () => {
    const s0 = edit(ready(newGame(2, 5).state), (s: GameState) => {
      const o = (s.turn.active + 1) % 2;
      s.properties['kamalapur'] = { owner: o, houses: 0, mortgaged: false };
      s.properties['sadarghat'] = { owner: o, houses: 0, mortgaged: true };
    });
    expect(ofType(rollAs(s0, 2, 3).events, 'rentPaid')[0]!.amount).toBe(500);
    expect(engine.rentFor(s0, 'sadarghat', 7)).toBe(0);
  });
});
