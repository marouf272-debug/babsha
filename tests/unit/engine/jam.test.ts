import { describe, expect, it } from 'vitest';
import type { GameState } from '../../../src/engine';
import { edit, engine, newGame, ofType, ready, rollAs, step, actionTypes } from './helpers';

const start = () => ready(newGame(2, 21).state);
const jailed = (extra: (s: GameState) => void = () => {}) =>
  edit(start(), (s) => { const p = s.players[s.turn.active]!; p.position = 10; p.inJam = true; extra(s); });

describe('Jam (FR-02, FR-10 entry and exit, R-35, R-36, R-49 to R-52)', () => {
  it('R-35, D-23: landing on Go to Jam sends the player to Jam with no salary', () => {
    const s0 = edit(start(), (s) => { s.players[s.turn.active]!.position = 25; });
    const { state, events } = rollAs(s0, 2, 3);
    const p = state.players[s0.turn.active]!;
    expect(p.position).toBe(10);
    expect(p.inJam).toBe(true);
    expect(ofType(events, 'sentToJam')).toEqual([{ type: 'sentToJam', player: s0.turn.active, reason: 'goToJamTile' }]);
    expect(p.cash).toBe(10000);
  });

  it('R-52, D-26: reaching Go to Jam on doubles gives no extra roll', () => {
    const s0 = edit(start(), (s) => { s.players[s.turn.active]!.position = 26; });
    const r = step(rollAs(s0, 2, 2).state, { type: 'END_TURN' });
    expect(r.state.turn.active).not.toBe(s0.turn.active);
  });

  it('R-36: landing on Jam by a normal move is just passing', () => {
    const s0 = edit(start(), (s) => { s.players[s.turn.active]!.position = 5; });
    expect(rollAs(s0, 2, 3).state.players[s0.turn.active]!.inJam).toBe(false);
  });

  it('R-50: a player in Jam may roll or pay the fine before rolling', () => {
    expect(actionTypes(engine.legalActions(jailed()))).toEqual(['ROLL', 'PAY_JAM_FINE']);
  });

  it('R-50, R-51, D-21: paying the fine costs 500, then the player rolls and moves normally', () => {
    const s0 = jailed();
    const me = s0.turn.active;
    let r = step(s0, { type: 'PAY_JAM_FINE' });
    expect(r.state.players[me]!.cash).toBe(9500);
    expect(r.state.players[me]!.inJam).toBe(false);
    expect(ofType(r.events, 'jamFinePaid')).toEqual([{ type: 'jamFinePaid', player: me, amount: 500, forced: false }]);
    expect(ofType(r.events, 'leftJam')).toEqual([{ type: 'leftJam', player: me, by: 'fine' }]);
    r = rollAs(r.state, 1, 2);
    expect(r.state.players[me]!.position).toBe(13);
  });

  it('D-25: after paying the fine, doubles give the usual extra roll', () => {
    const s0 = jailed();
    let r = step(s0, { type: 'PAY_JAM_FINE' });
    r = rollAs(r.state, 2, 2); // Shyamoli at 14, unowned
    r = step(r.state, { type: 'DECLINE' });
    r = step(r.state, { type: 'END_TURN' });
    expect(r.state.turn.active).toBe(s0.turn.active);
    expect(r.state.turn.phase).toBe('ROLL');
  });

  it('R-50: paying the fine is not offered without 500 in cash', () => {
    const s0 = jailed((s) => { s.players[s.turn.active]!.cash = 499; });
    expect(actionTypes(engine.legalActions(s0))).toEqual(['ROLL']);
  });

  it('R-51, R-52, D-21: rolling doubles leaves Jam, moves by that roll, with no extra roll', () => {
    const s0 = jailed();
    const me = s0.turn.active;
    let r = rollAs(s0, 3, 3);
    expect(r.state.players[me]!.inJam).toBe(false);
    expect(r.state.players[me]!.position).toBe(16);
    expect(ofType(r.events, 'leftJam')).toEqual([{ type: 'leftJam', player: me, by: 'doubles' }]);
    if (r.state.turn.phase === 'BUY_DECISION') r = step(r.state, { type: 'DECLINE' });
    r = step(r.state, { type: 'END_TURN' });
    expect(r.state.turn.active).not.toBe(me);
  });

  it('R-51: a failed roll keeps the player in Jam and counts the attempt', () => {
    const s0 = jailed();
    const me = s0.turn.active;
    const r = rollAs(s0, 1, 2);
    expect(r.state.players[me]).toMatchObject({ position: 10, inJam: true, jamFailedRolls: 1 });
    expect(ofType(r.events, 'stayedInJam')).toEqual([{ type: 'stayedInJam', player: me, failedRolls: 1 }]);
    expect(r.state.turn.phase).toBe('MANAGE');
  });

  it('R-51, D-21: on the third failed roll the fine is forced and the player moves by that roll', () => {
    const s0 = jailed((s) => { s.players[s.turn.active]!.jamFailedRolls = 2; });
    const me = s0.turn.active;
    const r = rollAs(s0, 1, 2);
    expect(r.state.players[me]).toMatchObject({ position: 13, inJam: false, jamFailedRolls: 0, cash: 9500 });
    expect(ofType(r.events, 'jamFinePaid')).toEqual([{ type: 'jamFinePaid', player: me, amount: 500, forced: true }]);
    expect(ofType(r.events, 'leftJam')).toEqual([{ type: 'leftJam', player: me, by: 'forcedFine' }]);
  });

  it('S1 STUB (D-24): a forced fine may take cash below zero until DEBT arrives in S2', () => {
    const s0 = jailed((s) => { const p = s.players[s.turn.active]!; p.jamFailedRolls = 2; p.cash = 100; });
    expect(rollAs(s0, 1, 2).state.players[s0.turn.active]!.cash).toBe(-400);
  });
});
