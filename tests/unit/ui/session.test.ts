import { describe, expect, it } from 'vitest';
import profilesDoc from '../../../data/ai-profiles.json';
import { createAi, type AiProfile } from '../../../src/ai';
import { Session, type SeatKind } from '../../../src/ui/session';
import { describeEvent } from '../../../src/ui/describe';
import { setLang } from '../../../src/i18n';
import { engine } from '../engine/helpers';

const ai = createAi(engine);
const profiles = profilesDoc.profiles as Record<'easy' | 'medium' | 'hard', AiProfile>;

// Runs scheduled computer moves immediately, in order, like timers with zero delay.
function makeSession(seats: SeatKind[], seed = 3) {
  const queue: Array<() => void> = [];
  const s = new Session({ engine, ai, profiles, seats, seed, schedule: (fn) => queue.push(fn), aiDelayMs: 0 });
  const drain = (max = 100_000) => { for (let i = 0; i < max && queue.length; i++) queue.shift()!(); };
  return { s, drain, queue };
}

describe('game session (FR-12, FR-13)', () => {
  it('FR-13: a game of computer players runs to a winner through the session', () => {
    const { s, drain } = makeSession(['medium', 'hard', 'easy']);
    let updates = 0;
    s.subscribe(() => updates++);
    s.start();
    drain();
    expect(s.state.turn.phase).toBe('GAME_OVER');
    expect(updates).toBeGreaterThan(100);
  });

  it('FR-12: with two or more humans the turn waits at the hand-off', () => {
    const { s, drain } = makeSession(['human', 'human']);
    s.start();
    drain();
    expect(s.state.turn.phase).toBe('START_TURN');
    expect(s.isHuman(s.actor()!)).toBe(true);
  });

  it('FR-13: with one human against computers there is no hand-off, the human starts ready to roll', () => {
    const { s, drain } = makeSession(['human', 'medium']);
    s.start();
    drain();
    // Either it is the human's turn at ROLL, or the computer is waiting on the human somewhere.
    expect(s.isHuman(s.actor()!)).toBe(true);
    expect(s.state.turn.phase).not.toBe('START_TURN');
  });

  it('FR-12: a human cannot act for another player', () => {
    const { s, drain } = makeSession(['human', 'human']);
    s.start();
    drain();
    const other = (s.state.turn.active + 1) % 2;
    expect(() => s.act({ type: 'BEGIN_TURN', player: other })).toThrow();
    expect(() => s.act({ type: 'BEGIN_TURN' })).not.toThrow();
  });

  it('FR-12: humans act only through legal actions, and every update reaches subscribers', () => {
    const { s, drain } = makeSession(['human', 'human']);
    const seen: string[] = [];
    s.subscribe((u) => seen.push(...u.events.map((e) => e.type)));
    s.start();
    drain();
    s.act({ type: 'BEGIN_TURN' });
    s.act({ type: 'ROLL' });
    expect(seen).toContain('diceRolled');
    expect(() => s.act({ type: 'BEGIN_TURN' })).toThrow();
  });

  it('FR-15: every event of a whole game can be described in both languages', () => {
    const { s, drain } = makeSession(['medium', 'hard', 'easy', 'medium'], 11);
    const events: Parameters<typeof describeEvent>[0][] = [];
    s.subscribe((u) => events.push(...u.events));
    s.start();
    drain();
    for (const lang of ['en', 'bn'] as const) {
      setLang(lang);
      for (const e of events) expect(() => describeEvent(e, s.state, engine.rules)).not.toThrow();
    }
    setLang('en');
    expect(new Set(events.map((e) => e.type)).size).toBeGreaterThan(15);
  });
});
