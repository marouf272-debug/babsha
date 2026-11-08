import { describe, expect, it } from 'vitest';
import { edit, engine, managing, newGame, ready, rollAs, step } from './helpers';

describe('turn timer passive choices (FR-14, D-34, D-52)', () => {
  it('FR-14, D-34: an expired buy decision declines', () => {
    const { state } = rollAs(ready(newGame(2, 71).state), 1, 2);
    expect(engine.passiveAction(state)).toEqual({ type: 'DECLINE', player: state.turn.active });
  });

  it('FR-14, D-34: an expired bid folds that player, but never the high bidder', () => {
    let r = rollAs(ready(newGame(2, 71).state), 1, 2);
    r = step(r.state, { type: 'DECLINE' });
    const me = r.state.turn.active;
    const them = (me + 1) % 2;
    r = step(r.state, { type: 'BID', player: me, amount: 0 });
    expect(engine.passiveAction(r.state, them)).toEqual({ type: 'FOLD', player: them });
    expect(engine.passiveAction(r.state, me)).toBeNull();
  });

  it('FR-14, D-34: an expired manage step ends the turn', () => {
    const s = managing();
    expect(engine.passiveAction(s)).toEqual({ type: 'END_TURN', player: s.turn.active });
  });

  it('D-52: an expired trade answer rejects the trade', () => {
    const s = managing({}, 2);
    const them = (s.turn.active + 1) % 2;
    const r = step(s, { type: 'PROPOSE_TRADE', offer: { to: them, giveTiles: [], giveCash: 10, getTiles: [], getCash: 0 } });
    expect(engine.passiveAction(r.state)).toEqual({ type: 'REJECT_TRADE', player: them });
  });

  it('D-34, D-52: there is no timer in DEBT, before the roll, or after the game', () => {
    const debt = edit(managing(), (s) => {
      s.turn.phase = 'DEBT';
      s.debts = [{ debtor: s.turn.active, creditor: { kind: 'bank' }, amount: 99999, reason: 'tax' }];
    });
    expect(engine.passiveAction(debt)).toBeNull();
    expect(engine.passiveAction(ready(newGame(2, 71).state))).toBeNull();
    expect(engine.passiveAction(newGame(2, 71).state)).toBeNull();
  });
});
