import { describe, expect, it } from 'vitest';
import { edit, legalOf, managing, ofType, ready, newGame, step } from './helpers';

const browns = (h1 = 0, h2 = 0, extra: Record<string, { houses?: number; mortgaged?: boolean }> = {}) =>
  managing({ puran_dhaka: { houses: h1 }, chawk_bazar: { houses: h2 }, ...extra });

describe('building and selling (FR-06, R-37 to R-42, D-29, D-31, D-46)', () => {
  it('FR-06: building is offered only on a full color set the player owns', () => {
    expect(legalOf(browns(), 'BUILD')).toEqual(['puran_dhaka', 'chawk_bazar']);
    expect(legalOf(managing({ puran_dhaka: {} }), 'BUILD')).toEqual([]);
    expect(legalOf(managing({ kamalapur: {}, sadarghat: {}, gabtoli: {}, airport: {} }), 'BUILD')).toEqual([]);
  });

  it('FR-06: building a house costs the house cost', () => {
    const s0 = browns();
    const me = s0.turn.active;
    const r = step(s0, { type: 'BUILD', tileId: 'puran_dhaka' });
    expect(r.state.properties['puran_dhaka']!.houses).toBe(1);
    expect(r.state.players[me]!.cash).toBe(10000 - 500);
    expect(ofType(r.events, 'buildingBought')).toEqual([{ type: 'buildingBought', player: me, tileId: 'puran_dhaka', cost: 500, houses: 1 }]);
  });

  it('FR-06: houses go on evenly, so the next house must go on the property with fewer', () => {
    const r = step(browns(), { type: 'BUILD', tileId: 'puran_dhaka' });
    expect(legalOf(r.state, 'BUILD')).toEqual(['chawk_bazar']);
    expect(() => step(r.state, { type: 'BUILD', tileId: 'puran_dhaka' })).toThrow(/not legal/);
  });

  it('FR-06, D-29: after 4 houses on every property, a hotel costs one more house cost', () => {
    const s0 = browns(4, 4);
    const r = step(s0, { type: 'BUILD', tileId: 'puran_dhaka' });
    expect(r.state.properties['puran_dhaka']!.houses).toBe(5);
    expect(r.state.players[s0.turn.active]!.cash).toBe(10000 - 500);
    expect(legalOf(r.state, 'BUILD')).toEqual(['chawk_bazar']);
  });

  it('FR-06: nothing can be built on a hotel', () => {
    expect(legalOf(browns(5, 5), 'BUILD')).toEqual([]);
  });

  it('FR-06, D-31: no building anywhere in a set while any member is mortgaged', () => {
    const s0 = managing({ jatrabari: {}, motijheel: {}, basabo: { mortgaged: true } });
    expect(legalOf(s0, 'BUILD')).toEqual([]);
  });

  it('FR-06: building needs enough cash', () => {
    const s0 = edit(browns(), (s) => { s.players[s.turn.active]!.cash = 499; });
    expect(legalOf(s0, 'BUILD')).toEqual([]);
  });

  it('FR-06: a house sells back for 50 percent of its cost', () => {
    const s0 = browns(1, 1);
    const r = step(s0, { type: 'SELL_BUILDING', tileId: 'chawk_bazar' });
    expect(r.state.properties['chawk_bazar']!.houses).toBe(0);
    expect(r.state.players[s0.turn.active]!.cash).toBe(10000 + 250);
    expect(ofType(r.events, 'buildingSold')).toEqual([{ type: 'buildingSold', player: s0.turn.active, tileId: 'chawk_bazar', refund: 250, houses: 0 }]);
  });

  it('FR-06: selling follows the even rule in reverse, from the property with the most', () => {
    expect(legalOf(browns(2, 1), 'SELL_BUILDING')).toEqual(['puran_dhaka']);
    expect(legalOf(browns(0, 0), 'SELL_BUILDING')).toEqual([]);
  });

  it('FR-06, D-29: selling a hotel returns 50 percent of its cost and leaves 4 houses', () => {
    const s0 = browns(5, 4);
    const r = step(s0, { type: 'SELL_BUILDING', tileId: 'puran_dhaka' });
    expect(r.state.properties['puran_dhaka']!.houses).toBe(4);
    expect(r.state.players[s0.turn.active]!.cash).toBe(10000 + 250);
  });

  it('D-46: building and selling happen only in MANAGE, not before the roll', () => {
    const s0 = edit(ready(newGame(2, 41).state), (s) => {
      s.properties['puran_dhaka'] = { owner: s.turn.active, houses: 1, mortgaged: false };
      s.properties['chawk_bazar'] = { owner: s.turn.active, houses: 0, mortgaged: false };
    });
    expect(s0.turn.phase).toBe('ROLL');
    expect(legalOf(s0, 'BUILD')).toEqual([]);
    expect(legalOf(s0, 'SELL_BUILDING')).toEqual([]);
  });

  it('D-42: a player in Jam may build', () => {
    const s0 = edit(browns(), (s) => { const p = s.players[s.turn.active]!; p.inJam = true; p.position = 10; });
    expect(legalOf(s0, 'BUILD')).toEqual(['puran_dhaka', 'chawk_bazar']);
  });

  it('FR-06: only the owner may build on their set', () => {
    const s0 = managing({ puran_dhaka: { owner: 99 }, chawk_bazar: { owner: 99 } });
    expect(legalOf(s0, 'BUILD')).toEqual([]);
  });
});
