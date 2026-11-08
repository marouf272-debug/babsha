import { describe, expect, it } from 'vitest';
import profilesDoc from '../../../data/ai-profiles.json';
import { createAi, type AiProfile } from '../../../src/ai';
import { Session, type SeatKind } from '../../../src/ui/session';
import { SAVE_KEY, SAVE_SCHEMA, clearSave, decodeSave, encodeSave, loadSave, writeSave, type SaveGame, type SaveStorage } from '../../../src/ui/save';
import { engine } from '../engine/helpers';

const ai = createAi(engine);
const profiles = profilesDoc.profiles as Record<'easy' | 'medium' | 'hard', AiProfile>;

function makeSession(seats: SeatKind[], resume?: SaveGame) {
  const queue: Array<() => void> = [];
  const s = new Session({ engine, ai, profiles, seats, seed: 11, schedule: (fn) => queue.push(fn), aiDelayMs: 0, resume });
  const drain = (max = 100_000) => { for (let i = 0; i < max && queue.length; i++) queue.shift()!(); };
  return { s, drain, queue };
}

function memoryStorage(): SaveStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

const settings = { timer: false };

describe('save and resume (FR-19, D-92)', () => {
  it('FR-19: a saved game resumes and plays on exactly as if it had never stopped', () => {
    const seats: SeatKind[] = ['medium', 'hard', 'easy'];
    const full = makeSession(seats);
    full.s.start();
    full.drain();

    const part = makeSession(seats);
    part.s.start();
    part.drain(400);
    expect(part.s.state.turn.phase).not.toBe('GAME_OVER');
    const raw = encodeSave(part.s.snapshot(settings, []));

    const save = decodeSave(raw, engine)!;
    expect(save).not.toBeNull();
    const resumed = makeSession(save.seats, save);
    resumed.s.start();
    resumed.drain();
    expect(resumed.s.state.turn.phase).toBe('GAME_OVER');
    expect(resumed.s.state.winner).toBe(full.s.state.winner);
    expect(resumed.s.state.turnCount).toBe(full.s.state.turnCount);
    expect(resumed.s.state).toEqual(full.s.state);
  });

  it('FR-19: the save keeps seats, settings and the log events', () => {
    const { s, drain } = makeSession(['human', 'easy']);
    s.start();
    drain();
    const events = [{ type: 'turnPassed' as const, from: 0, to: 1 }];
    const save = decodeSave(encodeSave(s.snapshot({ timer: true }, events)), engine)!;
    expect(save.schema).toBe(SAVE_SCHEMA);
    expect(save.seats).toEqual(['human', 'easy']);
    expect(save.settings).toEqual({ timer: true });
    expect(save.events).toEqual(events);
    expect(save.state).toEqual(s.state);
  });

  it('FR-19: a resumed human game waits for the same human, with no move made for them', () => {
    const { s, drain } = makeSession(['human', 'human']);
    s.start();
    drain();
    const save = decodeSave(encodeSave(s.snapshot(settings, [])), engine)!;
    const r = makeSession(save.seats, save);
    r.s.start();
    r.drain();
    expect(r.s.state).toEqual(s.state);
    expect(r.s.actor()).toBe(s.actor());
  });

  it('FR-19: broken, foreign, old-schema, finished or mismatched saves are refused', () => {
    const { s, drain } = makeSession(['easy', 'easy']);
    s.start();
    drain(50);
    const good = s.snapshot(settings, []);
    expect(decodeSave('not json', engine)).toBeNull();
    expect(decodeSave('{"hello":1}', engine)).toBeNull();
    expect(decodeSave(JSON.stringify({ ...good, schema: SAVE_SCHEMA + 1 }), engine)).toBeNull();
    expect(decodeSave(JSON.stringify({ ...good, state: { ...good.state, version: 1 } }), engine)).toBeNull();
    expect(decodeSave(JSON.stringify({ ...good, seats: ['easy'] }), engine)).toBeNull();
    expect(decodeSave(JSON.stringify({ ...good, seats: ['easy', 'robot'] }), engine)).toBeNull();
    const foreignTile = { ...good.state.properties, old_tile_removed: { owner: 0, houses: 0, mortgaged: false } };
    expect(decodeSave(JSON.stringify({ ...good, state: { ...good.state, properties: foreignTile } }), engine)).toBeNull();
    expect(decodeSave(JSON.stringify({ ...good, state: { ...good.state, turn: { ...good.state.turn, phase: 'GAME_OVER' } } }), engine)).toBeNull();
    expect(decodeSave(JSON.stringify(good), engine)).not.toBeNull();
  });

  it('FR-19: the save lives in device storage under one key and can be cleared', () => {
    const storage = memoryStorage();
    const { s, drain } = makeSession(['easy', 'medium']);
    s.start();
    drain(30);
    expect(loadSave(storage, engine)).toBeNull();
    writeSave(storage, s.snapshot(settings, []));
    expect([...storage.data.keys()]).toEqual([SAVE_KEY]);
    expect(loadSave(storage, engine)!.state).toEqual(s.state);
    clearSave(storage);
    expect(loadSave(storage, engine)).toBeNull();
  });

  it('FR-19: blocked or full storage never breaks the game', () => {
    const throwing: SaveStorage = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('quota'); },
      removeItem: () => { throw new Error('blocked'); },
    };
    const { s } = makeSession(['easy', 'easy']);
    expect(() => writeSave(throwing, s.snapshot(settings, []))).not.toThrow();
    expect(loadSave(throwing, engine)).toBeNull();
    expect(() => clearSave(throwing)).not.toThrow();
    expect(loadSave(null, engine)).toBeNull();
  });
});
