import { describe, expect, it } from 'vitest';
import type { GameState } from '../../../src/engine';
import { actionTypes, edit, engine, newGame, ofType, ready, rollAs, step } from './helpers';

// Three players; the active player lands on Chawk Bazar (600) and declines.
function declined(cashEdit: (s: GameState) => void = () => {}) {
  const s0 = edit(ready(newGame(3, 31).state), cashEdit);
  const r = rollAs(s0, 1, 2);
  return { me: s0.turn.active, ...step(r.state, { type: 'DECLINE' }) };
}
const others = (s: GameState, me: number) => [0, 1, 2].filter((p) => p !== me);

describe('auction (FR-04, R-18 to R-22, D-33, D-43)', () => {
  it('FR-04: declining starts a live auction for every active player, in seat order', () => {
    const { state, events } = declined();
    expect(state.turn.phase).toBe('AUCTION');
    expect(state.auction).toEqual({ tileId: 'chawk_bazar', highBid: null, highBidder: null, inPlayers: [0, 1, 2] });
    expect(ofType(events, 'auctionStarted')).toEqual([{ type: 'auctionStarted', tileId: 'chawk_bazar', players: [0, 1, 2] }]);
  });

  it('FR-04, D-43: the first bid may be 0 and every later bid must be at least 100 more', () => {
    const { state, me } = declined();
    const [a, b] = others(state, me);
    expect(engine.legalActions(state).filter((x) => x.type === 'BID').map((x) => (x as { amount: number }).amount)).toEqual([0, 0, 0]);
    let r = step(state, { type: 'BID', player: a!, amount: 0 });
    expect(r.state.auction).toMatchObject({ highBid: 0, highBidder: a });
    expect(() => step(r.state, { type: 'BID', player: b!, amount: 50 })).toThrow(/not legal/);
    r = step(r.state, { type: 'BID', player: b!, amount: 100 });
    expect(r.state.auction).toMatchObject({ highBid: 100, highBidder: b });
  });

  it('FR-04, D-33: the player who declined may bid', () => {
    const { state, me } = declined();
    const r = step(state, { type: 'BID', player: me, amount: 300 });
    expect(r.state.auction).toMatchObject({ highBid: 300, highBidder: me });
  });

  it('FR-04, D-33: a bid cannot exceed the bidder cash, and a player who cannot meet the minimum can only fold', () => {
    const { state, me } = declined((s) => { s.players[(s.turn.active + 1) % 3]!.cash = 250; });
    const poor = (me + 1) % 3;
    expect(() => step(state, { type: 'BID', player: poor, amount: 300 })).toThrow(/not legal/);
    const r = step(state, { type: 'BID', player: me, amount: 300 });
    expect(actionTypes(engine.legalActions(r.state).filter((x) => x.player === poor))).toEqual(['FOLD']);
  });

  it('D-43: the high bidder cannot fold', () => {
    const { state, me } = declined();
    const r = step(state, { type: 'BID', player: me, amount: 0 });
    expect(engine.legalActions(r.state).filter((x) => x.player === me)).toEqual([]);
    expect(() => step(r.state, { type: 'FOLD', player: me })).toThrow(/not legal/);
  });

  it('FR-04: when everyone else folds, the high bidder pays the bid and owns the property', () => {
    const { state, me } = declined();
    const [a, b] = others(state, me);
    let r = step(state, { type: 'BID', player: a!, amount: 400 });
    r = step(r.state, { type: 'FOLD', player: me });
    r = step(r.state, { type: 'FOLD', player: b! });
    expect(r.state.properties['chawk_bazar']).toEqual({ owner: a, houses: 0, mortgaged: false });
    expect(r.state.players[a!]!.cash).toBe(10000 - 400);
    expect(ofType(r.events, 'auctionWon')).toEqual([{ type: 'auctionWon', player: a, tileId: 'chawk_bazar', price: 400 }]);
    expect(r.state.auction).toBeNull();
    expect(r.state.turn).toMatchObject({ phase: 'MANAGE', active: me });
  });

  it('FR-04, R-21: if everyone folds without a bid, the property stays unowned', () => {
    const { state, me } = declined();
    let r = { state, events: [] as ReturnType<typeof step>['events'] };
    for (const p of [0, 1, 2]) r = step(r.state, { type: 'FOLD', player: p });
    expect(r.state.properties['chawk_bazar']).toBeUndefined();
    expect(ofType(r.events, 'auctionUnsold')).toHaveLength(1);
    expect(r.state.turn).toMatchObject({ phase: 'MANAGE', active: me });
  });

  it('D-43: the last player left with no bid on the table may still bid 0 and win', () => {
    const { state, me } = declined();
    const [a, b] = others(state, me);
    let r = step(state, { type: 'FOLD', player: a! });
    r = step(r.state, { type: 'FOLD', player: b! });
    expect(r.state.turn.phase).toBe('AUCTION');
    r = step(r.state, { type: 'BID', player: me, amount: 0 });
    expect(r.state.properties['chawk_bazar']?.owner).toBe(me);
    expect(r.state.players[me]!.cash).toBe(10000);
  });

  it('FR-04: only players still in the auction may act', () => {
    const { state, me } = declined();
    const [a] = others(state, me);
    const r = step(state, { type: 'FOLD', player: a! });
    expect(() => step(r.state, { type: 'BID', player: a!, amount: 100 })).toThrow(/not legal/);
  });
});
