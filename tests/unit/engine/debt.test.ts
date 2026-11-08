import { describe, expect, it } from 'vitest';
import type { GameState } from '../../../src/engine';
import { actionTypes, edit, engine, legalOf, newGame, ofType, ready, rollAs, step } from './helpers';

// Two or three players. The active player lands on Chawk Bazar (pos 3) owned by `owner`, with a hotel set.
function owesRent(players = 2, cash = 1000, extra: (s: GameState) => void = () => {}) {
  const s0 = edit(ready(newGame(players, 51).state), (s) => {
    const owner = (s.turn.active + 1) % players;
    s.properties['puran_dhaka'] = { owner, houses: 5, mortgaged: false };
    s.properties['chawk_bazar'] = { owner, houses: 5, mortgaged: false };
    s.players[s.turn.active]!.cash = cash;
    extra(s);
  });
  const me = s0.turn.active;
  return { me, owner: (me + 1) % players, ...rollAs(s0, 1, 2) }; // rent 3000
}

describe('debt (FR-11, R-53, D-49)', () => {
  it('FR-11: owing more than you hold enters DEBT for the full amount, with no cash taken yet', () => {
    const { state, events, me, owner } = owesRent();
    expect(state.turn.phase).toBe('DEBT');
    expect(state.debts).toEqual([{ debtor: me, creditor: { kind: 'player', player: owner }, amount: 3000, reason: 'rent' }]);
    expect(ofType(events, 'debtCreated')).toHaveLength(1);
    expect(ofType(events, 'rentPaid')).toHaveLength(0);
    expect(state.players[me]!.cash).toBe(1000);
  });

  it('FR-11, D-39: in DEBT the debtor may sell, mortgage or declare bankruptcy, but not pay yet, build or redeem', () => {
    const { state } = owesRent(2, 1000, (s) => {
      s.properties['kamalapur'] = { owner: s.turn.active, houses: 0, mortgaged: false };
      s.properties['basabo'] = { owner: s.turn.active, houses: 0, mortgaged: true };
    });
    expect(actionTypes(engine.legalActions(state))).toEqual(['MORTGAGE', 'DECLARE_BANKRUPTCY']);
  });

  it('FR-11: after raising enough cash the debtor pays and the turn continues in MANAGE', () => {
    const { state, me, owner } = owesRent(2, 2500, (s) => {
      s.properties['kamalapur'] = { owner: s.turn.active, houses: 0, mortgaged: false };
    });
    let r = step(state, { type: 'MORTGAGE', tileId: 'kamalapur' });
    expect(actionTypes(engine.legalActions(r.state))).toContain('PAY_DEBT');
    r = step(r.state, { type: 'PAY_DEBT' });
    expect(r.state.players[me]!.cash).toBe(2500 + 1000 - 3000);
    expect(r.state.players[owner]!.cash).toBe(10000 + 3000);
    expect(ofType(r.events, 'debtPaid')[0]!.transfers).toEqual([{ to: owner, amount: 3000 }]);
    expect(r.state.debts).toEqual([]);
    expect(r.state.turn).toMatchObject({ phase: 'MANAGE', active: me });
  });

  it('FR-11: a tax the player cannot pay is a debt to the bank', () => {
    const s0 = edit(ready(newGame(2, 51).state), (s) => { s.players[s.turn.active]!.cash = 900; });
    const { state } = rollAs(s0, 1, 3); // Super Tax 1000
    expect(state.debts[0]).toMatchObject({ creditor: { kind: 'bank' }, amount: 1000, reason: 'tax' });
  });

  it('D-50: a forced Jam fine the player cannot pay is settled in DEBT, then the player moves', () => {
    const s0 = edit(ready(newGame(2, 51).state), (s) => {
      const p = s.players[s.turn.active]!;
      Object.assign(p, { position: 10, inJam: true, jamFailedRolls: 2, cash: 100 });
      s.properties['kamalapur'] = { owner: s.turn.active, houses: 0, mortgaged: false };
    });
    const me = s0.turn.active;
    let r = rollAs(s0, 1, 2);
    expect(r.state.turn.phase).toBe('DEBT');
    expect(r.state.players[me]!.position).toBe(10);
    r = step(r.state, { type: 'MORTGAGE', tileId: 'kamalapur' });
    r = step(r.state, { type: 'PAY_DEBT' });
    expect(r.state.players[me]).toMatchObject({ position: 13, inJam: false, cash: 100 + 1000 - 500 });
  });

  it('FR-11: cash never goes below zero', () => {
    const { state } = owesRent(2, 10);
    expect(state.players.every((p) => p.cash >= 0)).toBe(true);
  });
});

describe('bankruptcy and winner (FR-11, R-54 to R-57, D-38)', () => {
  it('FR-11, D-38: bankrupt to a player: buildings sold at 50 percent, then cash and properties pass on, mortgages kept', () => {
    const { state, me, owner } = owesRent(3, 1000, (s) => {
      const a = s.turn.active;
      s.properties['mirpur'] = { owner: a, houses: 1, mortgaged: false };
      s.properties['mohammadpur'] = { owner: a, houses: 1, mortgaged: false };
      s.properties['shyamoli'] = { owner: a, houses: 1, mortgaged: false };
      s.properties['kamalapur'] = { owner: a, houses: 0, mortgaged: true };
    });
    const r = step(state, { type: 'DECLARE_BANKRUPTCY' });
    expect(ofType(r.events, 'buildingSold')).toHaveLength(3);
    expect(r.state.players[me]).toMatchObject({ bankrupt: true, cash: 0 });
    expect(r.state.players[owner]!.cash).toBe(10000 + 1000 + 3 * 500);
    expect(r.state.properties['mirpur']).toEqual({ owner, houses: 0, mortgaged: false });
    expect(r.state.properties['kamalapur']).toEqual({ owner, houses: 0, mortgaged: true });
    expect(ofType(r.events, 'bankrupt')[0]).toMatchObject({ player: me, tilesTo: owner });
  });

  it('FR-11: after a bankruptcy the turn passes to the next player still in the game', () => {
    const { state, me } = owesRent(3);
    const r = step(state, { type: 'DECLARE_BANKRUPTCY' });
    expect(r.state.turn).toMatchObject({ phase: 'START_TURN', active: (me + 1) % 3 });
  });

  it('FR-11: bankrupt players are skipped in turn order', () => {
    const s0 = edit(ready(newGame(3, 51).state), (s) => {
      s.turn.phase = 'MANAGE';
      s.players[(s.turn.active + 1) % 3]!.bankrupt = true;
    });
    const r = step(s0, { type: 'END_TURN' });
    expect(r.state.turn.active).toBe((s0.turn.active + 2) % 3);
  });

  it('FR-11, D-38, D-50: bankrupt to the bank: mortgages cleared and properties auctioned one at a time in board order', () => {
    const s0 = edit(ready(newGame(3, 51).state), (s) => {
      const a = s.turn.active;
      s.players[a]!.cash = 300;
      s.properties['basabo'] = { owner: a, houses: 0, mortgaged: true };
      s.properties['chawk_bazar'] = { owner: a, houses: 0, mortgaged: false };
    });
    const me = s0.turn.active;
    let r = rollAs(s0, 1, 3); // Super Tax
    r = step(r.state, { type: 'DECLARE_BANKRUPTCY' });
    expect(ofType(r.events, 'bankrupt')[0]).toMatchObject({ player: me, tilesTo: 'auction', transfers: [{ to: 'bank', amount: 300 }] });
    expect(r.state.turn.phase).toBe('AUCTION');
    expect(r.state.auction).toMatchObject({ tileId: 'chawk_bazar', inPlayers: [0, 1, 2].filter((p) => p !== me) });
    expect(r.state.auctionQueue).toEqual(['basabo']);
    expect(r.state.properties['basabo']).toBeUndefined();
    for (const p of [...r.state.auction!.inPlayers]) r = step(r.state, { type: 'FOLD', player: p });
    expect(r.state.auction?.tileId).toBe('basabo');
    for (const p of [...r.state.auction!.inPlayers]) r = step(r.state, { type: 'FOLD', player: p });
    expect(r.state.turn).toMatchObject({ phase: 'START_TURN', active: (me + 1) % 3 });
  });

  it('FR-11, R-56: when one solvent player remains, the game is over and that player wins', () => {
    const { state, owner } = owesRent(2);
    const r = step(state, { type: 'DECLARE_BANKRUPTCY' });
    expect(r.state.turn.phase).toBe('GAME_OVER');
    expect(r.state.winner).toBe(owner);
    expect(ofType(r.events, 'gameOver')).toEqual([{ type: 'gameOver', winner: owner }]);
    expect(engine.legalActions(r.state)).toEqual([]);
  });

  it('D-49: bankruptcy may be declared in DEBT even while the player still has assets', () => {
    const { state } = owesRent(2, 1000, (s) => { s.properties['kamalapur'] = { owner: s.turn.active, houses: 0, mortgaged: false }; });
    expect(legalOf(state, 'DECLARE_BANKRUPTCY')).toEqual(['DECLARE_BANKRUPTCY']);
  });
});
