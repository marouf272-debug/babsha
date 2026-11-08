import tilesDoc from '../../../data/tiles.json';
import config from '../../../data/config.json';
import cardsDoc from '../../../data/cards.json';
import { createEngine, makeRules, rollDice, type Action, type GameEvent, type GameState } from '../../../src/engine';

export const rules = makeRules(tilesDoc, config, cardsDoc);
export const engine = createEngine(rules);

export function newGame(players = 2, seed = 1) {
  return engine.newGame({ playerIds: Array.from({ length: players }, (_, i) => `p${i + 1}`), seed });
}

// Returns an RNG state whose next roll of two dice is exactly [a, b]. Brute force over seeds.
export function rngForRoll(a: number, b: number, start = 1): number {
  for (let s = start; s < start + 1_000_000; s++) {
    const { dice } = rollDice(s, 2, 6);
    if (dice[0] === a && dice[1] === b) return s;
  }
  throw new Error(`No seed found for roll ${a},${b}`);
}

// Sets the next roll, then applies ROLL.
export function rollAs(state: GameState, a: number, b: number) {
  return engine.step({ ...state, rng: rngForRoll(a, b) }, { type: 'ROLL' });
}

export function step(state: GameState, action: Action) {
  return engine.step(state, action);
}

// Applies BEGIN_TURN if needed so the active player is ready to roll.
export function ready(state: GameState): GameState {
  return state.turn.phase === 'START_TURN' ? engine.step(state, { type: 'BEGIN_TURN' }).state : state;
}

// Returns a deep copy of state with edits applied by a callback, for building test positions.
export function edit(state: GameState, fn: (s: GameState) => void): GameState {
  const copy = structuredClone(state);
  fn(copy);
  return copy;
}

export function ofType<T extends GameEvent['type']>(events: GameEvent[], type: T) {
  return events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
}

export const pos = (id: string) => {
  const t = rules.tiles.find((x) => x.id === id);
  if (!t) throw new Error(`no tile ${id}`);
  return t.pos;
};

export const actionTypes = (actions: Action[]) => actions.map((a) => a.type);
