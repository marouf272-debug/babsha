import { describe, expect, it } from 'vitest';
import type { GameState, TradeOffer } from '../../../src/engine';
import { actionTypes, edit, engine, managing, newGame, ofType, ready, rollAs, step } from './helpers';

const offer = (s: GameState, o: Partial<Omit<TradeOffer, 'from'>> = {}): Omit<TradeOffer, 'from'> => ({
  to: (s.turn.active + 1) % s.players.length, giveTiles: [], giveCash: 0, getTiles: [], getCash: 0, ...o,
});
const base = () => managing({ chawk_bazar: {}, kamalapur: { mortgaged: true }, basabo: { owner: -1 } }, 3);
// basabo is given to the next player below
const s0 = () => edit(base(), (s) => { s.properties['basabo']!.owner = (s.turn.active + 1) % 3; });

describe('trading (FR-08, R-45 to R-48, D-37, D-44, D-46, D-51)', () => {
  it('FR-08: the active player proposes a trade and only the other player may answer', () => {
    const s = s0();
    const r = step(s, { type: 'PROPOSE_TRADE', offer: offer(s, { giveTiles: ['chawk_bazar'], getCash: 700 }) });
    expect(r.state.trade).toMatchObject({ from: s.turn.active, to: (s.turn.active + 1) % 3, giveTiles: ['chawk_bazar'], getCash: 700 });
    expect(ofType(r.events, 'tradeProposed')).toHaveLength(1);
    expect(engine.legalActions(r.state)).toEqual([
      { type: 'ACCEPT_TRADE', player: (s.turn.active + 1) % 3 },
      { type: 'REJECT_TRADE', player: (s.turn.active + 1) % 3 },
    ]);
  });

  it('FR-08: accepting swaps properties and cash in both directions', () => {
    const s = s0();
    const me = s.turn.active;
    const them = (me + 1) % 3;
    let r = step(s, { type: 'PROPOSE_TRADE', offer: offer(s, { giveTiles: ['chawk_bazar'], giveCash: 100, getTiles: ['basabo'], getCash: 50 }) });
    r = step(r.state, { type: 'ACCEPT_TRADE', player: them });
    expect(r.state.properties['chawk_bazar']!.owner).toBe(them);
    expect(r.state.properties['basabo']!.owner).toBe(me);
    expect(r.state.players[me]!.cash).toBe(10000 - 100 + 50);
    expect(r.state.players[them]!.cash).toBe(10000 + 100 - 50);
    expect(r.state.trade).toBeNull();
    expect(r.state.turn).toMatchObject({ phase: 'MANAGE', active: me });
  });

  it('FR-08: rejecting leaves everything as it was', () => {
    const s = s0();
    let r = step(s, { type: 'PROPOSE_TRADE', offer: offer(s, { giveTiles: ['chawk_bazar'] }) });
    r = step(r.state, { type: 'REJECT_TRADE', player: (s.turn.active + 1) % 3 });
    expect(r.state.properties).toEqual(s.properties);
    expect(r.state.trade).toBeNull();
    expect(ofType(r.events, 'tradeRejected')).toHaveLength(1);
  });

  it('FR-08, D-37: a mortgaged property can be traded, stays mortgaged, and redeems at the normal cost', () => {
    const s = s0();
    const them = (s.turn.active + 1) % 3;
    let r = step(s, { type: 'PROPOSE_TRADE', offer: offer(s, { giveTiles: ['kamalapur'] }) });
    r = step(r.state, { type: 'ACCEPT_TRADE', player: them });
    expect(r.state.properties['kamalapur']).toEqual({ owner: them, houses: 0, mortgaged: true });
    expect(r.state.players[them]!.cash).toBe(10000);
  });

  it('FR-08, R-46, D-44: a property cannot be traded while any property in its set has buildings', () => {
    const s = managing({ puran_dhaka: { houses: 1 }, chawk_bazar: { houses: 0 } }, 3);
    expect(engine.tradeProblem(s, offer(s, { giveTiles: ['chawk_bazar'] }))).toMatch(/buildings/);
    expect(() => step(s, { type: 'PROPOSE_TRADE', offer: offer(s, { giveTiles: ['chawk_bazar'] }) })).toThrow(/not legal/);
  });

  it('FR-08: invalid offers are refused', () => {
    const s = s0();
    const me = s.turn.active;
    expect(engine.tradeProblem(s, offer(s))).toMatch(/empty/);
    expect(engine.tradeProblem(s, offer(s, { to: me, giveCash: 10 }))).toMatch(/another player/);
    expect(engine.tradeProblem(s, offer(s, { giveTiles: ['basabo'] }))).toMatch(/does not own/);
    expect(engine.tradeProblem(s, offer(s, { getTiles: ['chawk_bazar'] }))).toMatch(/does not own/);
    expect(engine.tradeProblem(s, offer(s, { giveCash: 10001 }))).toMatch(/cash/);
    expect(engine.tradeProblem(s, offer(s, { getCash: 10001 }))).toMatch(/cash/);
    expect(engine.tradeProblem(s, offer(s, { giveCash: -5 }))).toMatch(/cash/);
    expect(engine.tradeProblem(s, offer(s, { giveTiles: ['chawk_bazar', 'chawk_bazar'] }))).toMatch(/twice/);
    const dead = edit(s, (x) => { x.players[(me + 1) % 3]!.bankrupt = true; });
    expect(engine.tradeProblem(dead, offer(dead, { giveCash: 10 }))).toMatch(/another player/);
  });

  it('D-87: trading is allowed on your turn before the roll, and the turn returns to ROLL', () => {
    const s = ready(newGame(3, 41).state);
    expect(engine.tradeProblem(s, offer(s, { giveCash: 10 }))).toBeNull();
    let r = step(s, { type: 'PROPOSE_TRADE', offer: offer(s, { giveCash: 10 }) });
    r = step(r.state, { type: 'REJECT_TRADE', player: (s.turn.active + 1) % 3 });
    expect(r.state.turn.phase).toBe('ROLL');
  });

  it('D-87: trading is not allowed at the hand-off, before the turn has started', () => {
    const s = newGame(3, 41).state;
    expect(s.turn.phase).toBe('START_TURN');
    expect(engine.tradeProblem(s, offer(s, { giveCash: 10 }))).toMatch(/not now/);
  });

  it('FR-08: while a trade is waiting, the proposer cannot end the turn', () => {
    const s = s0();
    const r = step(s, { type: 'PROPOSE_TRADE', offer: offer(s, { giveCash: 10 }) });
    expect(() => step(r.state, { type: 'END_TURN' })).toThrow(/not legal/);
  });

  it('D-39: a debtor in DEBT may trade to raise cash, then pay', () => {
    const start = edit(ready(newGame(2, 51).state), (s) => {
      const owner = (s.turn.active + 1) % 2;
      s.properties['puran_dhaka'] = { owner, houses: 5, mortgaged: false };
      s.properties['chawk_bazar'] = { owner, houses: 5, mortgaged: false };
      s.properties['kamalapur'] = { owner: s.turn.active, houses: 0, mortgaged: false };
      s.players[s.turn.active]!.cash = 1000;
    });
    const me = start.turn.active;
    const them = (me + 1) % 2;
    let r = rollAs(start, 1, 2);
    expect(r.state.turn.phase).toBe('DEBT');
    r = step(r.state, { type: 'PROPOSE_TRADE', offer: { to: them, giveTiles: ['kamalapur'], giveCash: 0, getTiles: [], getCash: 2500 } });
    r = step(r.state, { type: 'ACCEPT_TRADE', player: them });
    expect(actionTypes(engine.legalActions(r.state))).toContain('PAY_DEBT');
  });
});
