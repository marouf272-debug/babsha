import { describe, expect, it } from 'vitest';
import { edit, engine, newGame, ofType, ready, rollAs, step, actionTypes } from './helpers';

const start = () => ready(newGame(2, 11).state);

describe('buying (FR-03, R-17, R-18)', () => {
  it('FR-03: landing on an unowned property opens a deed with price, mortgage value and rent schedule', () => {
    const { state, events } = rollAs(start(), 1, 2); // Chawk Bazar at 3
    expect(state.turn.phase).toBe('BUY_DECISION');
    expect(ofType(events, 'offerPurchase')[0]).toMatchObject({
      tileId: 'chawk_bazar', price: 600, mortgageValue: 300, rentKind: 'property', rent: [20, 100, 300, 1800, 2400, 3000],
    });
    expect(actionTypes(engine.legalActions(state))).toEqual(['BUY', 'DECLINE']);
  });

  it('FR-03: BUY pays the price and takes ownership', () => {
    const s0 = start();
    const me = s0.turn.active;
    const r = step(rollAs(s0, 1, 2).state, { type: 'BUY' });
    expect(r.state.players[me]!.cash).toBe(9400);
    expect(r.state.properties['chawk_bazar']).toEqual({ owner: me, houses: 0, mortgaged: false });
    expect(ofType(r.events, 'purchased')).toEqual([{ type: 'purchased', player: me, tileId: 'chawk_bazar', price: 600 }]);
    expect(r.state.turn.phase).toBe('MANAGE');
  });

  it('FR-03: BUY is not offered when the player cannot afford the price', () => {
    const s0 = edit(start(), (s) => { s.players[s.turn.active]!.cash = 500; });
    const { state } = rollAs(s0, 1, 2);
    expect(actionTypes(engine.legalActions(state))).toEqual(['DECLINE']);
    expect(() => step(state, { type: 'BUY' })).toThrow(/not legal/);
  });

  it('FR-03, S1 STUB (D-24): DECLINE leaves the property unowned until auctions arrive in S2', () => {
    const r = step(rollAs(start(), 1, 2).state, { type: 'DECLINE' });
    expect(r.state.properties['chawk_bazar']).toBeUndefined();
    expect(ofType(r.events, 'auctionStub')).toHaveLength(1);
    expect(r.state.turn.phase).toBe('MANAGE');
  });

  it('FR-03: hubs and utilities are offered at their configured prices with their rent schedules', () => {
    const hub = rollAs(start(), 2, 3); // Kamalapur at 5
    expect(ofType(hub.events, 'offerPurchase')[0]).toMatchObject({ tileId: 'kamalapur', price: 2000, mortgageValue: 1000, rentKind: 'hub', rent: [250, 500, 1000, 2000] });
    const util = rollAs(edit(start(), (s) => { s.players[s.turn.active]!.position = 7; }), 2, 3); // DESCO at 12
    expect(ofType(util.events, 'offerPurchase')[0]).toMatchObject({ tileId: 'desco', price: 1500, mortgageValue: 750, rentKind: 'utility', rent: [40, 100] });
  });

  it('FR-03: landing on your own property offers nothing', () => {
    const s0 = edit(start(), (s) => { s.properties['chawk_bazar'] = { owner: s.turn.active, houses: 0, mortgaged: false }; });
    const { state, events } = rollAs(s0, 1, 2);
    expect(ofType(events, 'offerPurchase')).toHaveLength(0);
    expect(state.turn.phase).toBe('MANAGE');
  });
});
