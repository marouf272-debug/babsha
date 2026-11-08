import { describe, expect, it } from 'vitest';
import profilesDoc from '../../../data/ai-profiles.json';
import { createAi, emptyMemory, type AiProfile } from '../../../src/ai';
import type { Action, GameState } from '../../../src/engine';
import { edit, engine, managing, newGame, ready, rollAs, step } from '../engine/helpers';

const ai = createAi(engine);
const P = profilesDoc.profiles as Record<'easy' | 'medium' | 'hard', AiProfile>;
const decide = (state: GameState, profile: AiProfile, player = ai.nextActor(state)!, rng = 1) =>
  ai.decide({ state, player, profile, memory: emptyMemory(), rng }).action;
const isLegal = (state: GameState, a: Action) => {
  try { engine.step(state, a); return true; } catch { return false; }
};

// Active player standing on an unowned tile: `land(1, 2)` lands on Chawk Bazar (600).
const landOn = (a: number, b: number, more: (s: GameState) => void = () => {}) =>
  rollAs(edit(ready(newGame(2, 81).state), more), a, b).state;

describe('computer players (FR-13)', () => {
  it('FR-13: every profile always returns a legal action, through whole AI games', () => {
    for (const id of ['easy', 'medium', 'hard'] as const) {
      for (let g = 0; g < 5; g++) {
        let state = newGame(3, 900 + g).state;
        let memory = emptyMemory();
        let rng = g + 1;
        for (let n = 0; n < 1500 && state.turn.phase !== 'GAME_OVER'; n++) {
          const player = ai.nextActor(state)!;
          const r = ai.decide({ state, player, profile: P[id], memory, rng });
          expect(isLegal(state, r.action), `${id} ${r.action.type} in ${state.turn.phase}`).toBe(true);
          ({ memory, rng } = r);
          state = engine.step(state, r.action).state;
        }
      }
    }
  });

  it('FR-13: buys a property when it can afford it comfortably', () => {
    expect(decide(landOn(1, 2), P.medium).type).toBe('BUY');
    expect(decide(landOn(1, 2), P.easy).type).toBe('BUY');
  });

  it('FR-13: Hard declines an uncontested tile to win it cheaper at auction, but buys a contested one', () => {
    expect(decide(landOn(1, 2), P.hard).type).toBe('DECLINE');
    const contested = landOn(1, 2, (s) => { s.properties['puran_dhaka'] = { owner: (s.turn.active + 1) % 2, houses: 0, mortgaged: false }; });
    expect(decide(contested, P.hard).type).toBe('BUY');
  });

  it('FR-13: declines when buying would leave cash below its reserve', () => {
    expect(decide(landOn(1, 2, (s) => { s.players[s.turn.active]!.cash = 1100; }), P.medium).type).toBe('DECLINE');
  });

  it('FR-13: buys a set completion even below its reserve', () => {
    const s = landOn(1, 2, (x) => {
      x.players[x.turn.active]!.cash = 700;
      x.properties['puran_dhaka'] = { owner: x.turn.active, houses: 0, mortgaged: false };
    });
    expect(decide(s, P.medium).type).toBe('BUY');
  });

  it('FR-13: bids the minimum while the price is below its value, and folds above it', () => {
    const declined = step(landOn(1, 2), { type: 'DECLINE' }).state;
    const other = (declined.turn.active + 1) % 2;
    expect(decide(declined, P.medium, other)).toEqual({ type: 'BID', player: other, amount: 0 });
    const pricey = edit(declined, (s) => { s.auction!.highBid = 1500; s.auction!.highBidder = s.turn.active; });
    expect(decide(pricey, P.medium, other)).toEqual({ type: 'FOLD', player: other });
  });

  it('FR-13: builds on a full set while cash stays above the reserve', () => {
    const s = managing({ puran_dhaka: {}, chawk_bazar: {} });
    expect(decide(s, P.medium)).toMatchObject({ type: 'BUILD' });
    const poor = edit(s, (x) => { x.players[x.turn.active]!.cash = 1200; });
    expect(decide(poor, P.medium).type).toBe('END_TURN');
  });

  it('FR-13: redeems a mortgaged property when cash is well above the reserve', () => {
    expect(decide(managing({ kamalapur: { mortgaged: true } }), P.medium)).toMatchObject({ type: 'REDEEM', tileId: 'kamalapur' });
  });

  it('FR-13: every profile offers cash for the tile that completes its set', () => {
    const s = managing({ puran_dhaka: {}, chawk_bazar: { owner: -1 } });
    const fixed = edit(s, (x) => { x.properties['chawk_bazar']!.owner = (x.turn.active + 1) % 2; });
    const m = decide(fixed, P.medium);
    expect(m).toMatchObject({ type: 'PROPOSE_TRADE', offer: { getTiles: ['chawk_bazar'], giveTiles: [] } });
    expect((m as { offer: { giveCash: number } }).offer.giveCash).toBeGreaterThan(600);
    expect(decide(fixed, P.hard).type).toBe('PROPOSE_TRADE');
    expect(decide(fixed, P.easy).type).toBe('PROPOSE_TRADE');
  });

  it('FR-13: offers a swap that completes a set for both players, and the other side accepts it', () => {
    const s = edit(managing({ puran_dhaka: {}, basabo: {} }), (x) => {
      const o = (x.turn.active + 1) % 2;
      for (const id of ['chawk_bazar', 'jatrabari', 'motijheel']) x.properties[id] = { owner: o, houses: 0, mortgaged: false };
    });
    const o = (s.turn.active + 1) % 2;
    const offer = decide(s, P.medium);
    expect(offer).toMatchObject({ type: 'PROPOSE_TRADE', offer: { to: o, giveTiles: ['basabo'], getTiles: ['chawk_bazar'] } });
    const waiting = step(s, offer).state;
    expect(decide(waiting, P.medium, o).type).toBe('ACCEPT_TRADE');
  });

  it('FR-13: proposes at most one trade per turn', () => {
    const s = edit(managing({ puran_dhaka: {}, chawk_bazar: {} }), (x) => { x.properties['chawk_bazar']!.owner = (x.turn.active + 1) % 2; });
    const first = ai.decide({ state: s, player: s.turn.active, profile: P.medium, memory: emptyMemory(), rng: 1 });
    expect(first.action.type).toBe('PROPOSE_TRADE');
    const again = ai.decide({ state: s, player: s.turn.active, profile: P.medium, memory: first.memory, rng: first.rng });
    expect(again.action.type).not.toBe('PROPOSE_TRADE');
  });

  it('FR-13: answers trades by value: rejects a lowball for its set piece, accepts a generous offer for a lone tile', () => {
    const base = edit(managing({ kamalapur: {} }), (x) => {
      const o = (x.turn.active + 1) % 2;
      x.properties['puran_dhaka'] = { owner: x.turn.active, houses: 0, mortgaged: false };
      x.properties['chawk_bazar'] = { owner: o, houses: 0, mortgaged: false };
      x.properties['basabo'] = { owner: o, houses: 0, mortgaged: false };
    });
    const o = (base.turn.active + 1) % 2;
    const low = step(base, { type: 'PROPOSE_TRADE', offer: { to: o, giveTiles: [], giveCash: 700, getTiles: ['chawk_bazar'], getCash: 0 } }).state;
    expect(decide(low, P.medium, o).type).toBe('REJECT_TRADE');
    const rich = step(base, { type: 'PROPOSE_TRADE', offer: { to: o, giveTiles: [], giveCash: 2500, getTiles: ['basabo'], getCash: 0 } }).state;
    expect(decide(rich, P.medium, o).type).toBe('ACCEPT_TRADE');
  });

  it('FR-13: in DEBT pays when it can, raises cash from the least valuable asset first, and goes bankrupt only as a last resort', () => {
    const owes = (cash: number, props: Record<string, { houses?: number; mortgaged?: boolean }>) =>
      edit(managing(props), (s) => {
        s.turn.phase = 'DEBT';
        s.players[s.turn.active]!.cash = cash;
        s.debts = [{ debtor: s.turn.active, creditor: { kind: 'bank' }, amount: 1000, reason: 'tax' }];
      });
    expect(decide(owes(1500, {}), P.medium).type).toBe('PAY_DEBT');
    const choose = decide(owes(100, { kamalapur: {}, mirpur: { houses: 1 }, mohammadpur: { houses: 1 }, shyamoli: { houses: 1 }, gulshan: {} }), P.medium);
    expect(choose).toMatchObject({ type: 'MORTGAGE', tileId: 'gulshan' });
    expect(decide(owes(100, {}), P.medium).type).toBe('DECLARE_BANKRUPTCY');
  });

  it('FR-13: leaves Jam early in the game; Hard stays in Jam once the board is mostly owned', () => {
    const jailed = (owned: number) => edit(ready(newGame(2, 81).state), (s) => {
      Object.assign(s.players[s.turn.active]!, { position: 10, inJam: true });
      engine.rules.tiles.filter((t) => ['property', 'hub', 'utility'].includes(t.type)).slice(0, owned)
        .forEach((t) => { s.properties[t.id] = { owner: (s.turn.active + 1) % 2, houses: 0, mortgaged: false }; });
    });
    expect(decide(jailed(0), P.medium).type).toBe('PAY_JAM_FINE');
    expect(decide(jailed(26), P.hard).type).toBe('ROLL');
  });

  it('D-55: the same state, profile, memory and seed always give the same action', () => {
    const s = newGame(4, 77).state;
    expect(decide(s, P.easy, s.turn.active, 5)).toEqual(decide(s, P.easy, s.turn.active, 5));
  });

  it('FR-13: the driver asks the right player: auction bidders in rotation, the trade responder, the debtor', () => {
    const auction = step(landOn(1, 2), { type: 'DECLINE' }).state;
    const me = auction.turn.active;
    expect(ai.nextActor(auction)).toBe((me + 1) % 2);
    const afterBid = step(auction, { type: 'BID', player: (me + 1) % 2, amount: 0 }).state;
    expect(ai.nextActor(afterBid)).toBe(me);
    const m = managing();
    const them = (m.turn.active + 1) % 2;
    expect(ai.nextActor(step(m, { type: 'PROPOSE_TRADE', offer: { to: them, giveTiles: [], giveCash: 10, getTiles: [], getCash: 0 } }).state)).toBe(them);
    const debt = edit(m, (s) => { s.turn.phase = 'DEBT'; s.debts = [{ debtor: them, creditor: { kind: 'bank' }, amount: 1, reason: 'card' }]; });
    expect(ai.nextActor(debt)).toBe(them);
    expect(ai.nextActor(edit(m, (s) => { s.turn.phase = 'GAME_OVER'; }))).toBeNull();
  });
});
