import { describe, expect, it } from 'vitest';
import { edit, engine, newGame, ofType, ready, rollAs, step, actionTypes, skipBuy } from './helpers';

const start = () => ready(newGame(3, 7).state);

describe('dice, movement and GO (FR-01, FR-02, R-13 to R-16)', () => {
  it('FR-01: rolling moves the active player clockwise by the sum of two dice', () => {
    const s0 = start();
    const me = s0.turn.active;
    const { state, events } = rollAs(s0, 3, 4);
    expect(state.players[me]!.position).toBe(7);
    expect(ofType(events, 'diceRolled')[0]).toMatchObject({ player: me, dice: [3, 4], total: 7, doubles: false });
    expect(ofType(events, 'moved')[0]).toMatchObject({ player: me, from: 0, to: 7 });
  });

  it('FR-01: movement wraps from position 39 back to 0', () => {
    const s0 = edit(start(), (s) => { s.players[s.turn.active]!.position = 38; });
    const { state } = rollAs(s0, 1, 2);
    expect(state.players[s0.turn.active]!.position).toBe(1);
  });

  it('R-16: passing GO pays the salary of 2,000 once', () => {
    const s0 = edit(start(), (s) => { s.players[s.turn.active]!.position = 38; });
    const { state, events } = rollAs(s0, 1, 2);
    expect(state.players[s0.turn.active]!.cash).toBe(12000);
    expect(ofType(events, 'salary')).toEqual([{ type: 'salary', player: s0.turn.active, amount: 2000 }]);
  });

  it('R-16, D-15: landing exactly on GO pays the salary', () => {
    const s0 = edit(start(), (s) => { s.players[s.turn.active]!.position = 35; });
    const { state } = rollAs(s0, 2, 3);
    expect(state.players[s0.turn.active]!.position).toBe(0);
    expect(state.players[s0.turn.active]!.cash).toBe(12000);
  });

  it('R-16: moving off GO without coming round again pays nothing', () => {
    const { state, events } = rollAs(start(), 1, 3);
    expect(ofType(events, 'salary')).toHaveLength(0);
    expect(state.players[state.turn.active]!.cash).toBe(10000 - 1000); // landed on Super Tax
  });

  it('FR-02, D-14: doubles give an extra roll after MANAGE, to the same player', () => {
    const s0 = start();
    const me = s0.turn.active;
    let r = rollAs(s0, 1, 1); // lands on DOHS, a stub in S1
    expect(r.state.turn.phase).toBe('MANAGE');
    r = step(r.state, { type: 'END_TURN' });
    expect(r.state.turn.active).toBe(me);
    expect(r.state.turn.phase).toBe('ROLL');
    expect(actionTypes(engine.legalActions(r.state))).toEqual(['ROLL']);
    expect(ofType(r.events, 'extraRoll')).toHaveLength(1);
  });

  it('FR-02: without doubles, END_TURN passes the turn to the next seat', () => {
    const s0 = start();
    const r = step(rollAs(s0, 3, 4).state, { type: 'END_TURN' }); // Lucky at 7, no decision
    expect(r.state.turn.active).toBe((s0.turn.active + 1) % 3);
    expect(r.state.turn.phase).toBe('START_TURN');
  });

  it('FR-02: three doubles in a row send the player to Jam without moving', () => {
    const s0 = start();
    const me = s0.turn.active;
    let r = rollAs(s0, 1, 1);
    r = step(r.state, { type: 'END_TURN' });
    r = rollAs(r.state, 2, 2); // lands on Jatrabari, unowned
    r = { ...r, state: skipBuy(r.state) };
    r = step(r.state, { type: 'END_TURN' });
    r = rollAs(r.state, 3, 3);
    const p = r.state.players[me]!;
    expect(p.position).toBe(10);
    expect(p.inJam).toBe(true);
    expect(ofType(r.events, 'sentToJam')).toEqual([{ type: 'sentToJam', player: me, reason: 'threeDoubles' }]);
    expect(ofType(r.events, 'moved')).toHaveLength(0);
    expect(r.state.turn.phase).toBe('MANAGE');
  });

  it('FR-02, D-23, D-26: going to Jam on the third double pays no salary and gives no extra roll', () => {
    const s0 = edit(start(), (s) => { s.turn.doublesThisTurn = 2; s.players[s.turn.active]!.position = 35; });
    const me = s0.turn.active;
    let r = rollAs(s0, 5, 5);
    expect(r.state.players[me]!.cash).toBe(10000);
    r = step(r.state, { type: 'END_TURN' });
    expect(r.state.turn.active).not.toBe(me);
  });

  it('FR-02: the doubles count resets when the turn passes', () => {
    const s0 = edit(start(), (s) => { s.turn.doublesThisTurn = 2; });
    const r = step(rollAs(s0, 3, 4).state, { type: 'END_TURN' });
    expect(r.state.turn.doublesThisTurn).toBe(0);
  });

  it('S1 STUB (D-24): landing on a card tile draws nothing yet', () => {
    const { state, events } = rollAs(start(), 3, 4); // Lucky at 7
    expect(ofType(events, 'cardStub')).toHaveLength(1);
    expect(state.turn.phase).toBe('MANAGE');
  });
});
