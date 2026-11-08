// Save and resume on the same device (FR-19, D-92): one autosave slot in local storage with a
// versioned schema. A save that does not fit the current rules or schema is refused, never
// patched, so a new build can never load a game into a broken state.

import type { AiMemory } from '../ai';
import type { Engine, GameEvent, GameState } from '../engine';
import type { SeatKind } from './session';

export const SAVE_KEY = 'babsha.save';
export const SAVE_SCHEMA = 1;
const STATE_VERSION: GameState['version'] = 2;
const SEAT_KINDS: SeatKind[] = ['human', 'easy', 'medium', 'hard'];

export interface GameSettings {
  // FR-14: the optional turn timer (D-34).
  timer: boolean;
}

export interface SaveGame {
  schema: typeof SAVE_SCHEMA;
  savedAt: number;
  seed: number;
  seats: SeatKind[];
  settings: GameSettings;
  state: GameState;
  memories: AiMemory[];
  aiRng: number;
  // D-89: the log, so it survives a resume.
  events: GameEvent[];
}

// The part of the browser's Storage the save needs, so tests can pass their own.
export type SaveStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function encodeSave(save: SaveGame): string {
  return JSON.stringify(save);
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function decodeSave(raw: string, engine: Engine): SaveGame | null {
  let v: unknown;
  try { v = JSON.parse(raw); } catch { return null; }
  if (!isObject(v) || v['schema'] !== SAVE_SCHEMA) return null;
  const { seats, state, memories, settings, events } = v;
  if (!Array.isArray(seats) || !seats.every((s) => SEAT_KINDS.includes(s as SeatKind))) return null;
  if (!isObject(settings) || typeof settings['timer'] !== 'boolean') return null;
  if (typeof v['seed'] !== 'number' || typeof v['aiRng'] !== 'number' || typeof v['savedAt'] !== 'number') return null;
  if (!Array.isArray(memories) || memories.length !== seats.length || !Array.isArray(events)) return null;
  if (!isObject(state) || state['version'] !== STATE_VERSION || typeof state['rng'] !== 'number') return null;
  const players = state['players'];
  const properties = state['properties'];
  const turn = state['turn'];
  if (!Array.isArray(players) || players.length !== seats.length) return null;
  if (!isObject(properties) || !isObject(turn) || turn['phase'] === 'GAME_OVER') return null;
  // Every owned tile in the save must be a buyable tile on the current board.
  const buyable = new Set(engine.rules.tiles.filter((t) => t.type === 'property' || t.type === 'hub' || t.type === 'utility').map((t) => t.id));
  if (!Object.keys(properties).every((id) => buyable.has(id))) return null;
  if (!players.every((p) => isObject(p) && typeof p['cash'] === 'number' && typeof p['position'] === 'number')) return null;
  // Last check: the engine can list moves for this state without throwing.
  try { engine.legalActions(state as unknown as GameState); } catch { return null; }
  return v as unknown as SaveGame;
}

export function writeSave(storage: SaveStorage | null, save: SaveGame): void {
  try { storage?.setItem(SAVE_KEY, encodeSave(save)); } catch { /* storage may be blocked or full */ }
}

export function loadSave(storage: SaveStorage | null, engine: Engine): SaveGame | null {
  let raw: string | null;
  try { raw = storage?.getItem(SAVE_KEY) ?? null; } catch { return null; }
  return raw === null ? null : decodeSave(raw, engine);
}

export function clearSave(storage: SaveStorage | null): void {
  try { storage?.removeItem(SAVE_KEY); } catch { /* storage may be blocked */ }
}

// The browser's local storage, or null where it is blocked.
export function deviceStorage(): SaveStorage | null {
  try { return window.localStorage; } catch { return null; }
}
