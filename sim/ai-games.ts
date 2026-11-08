// Plays whole games between computer players (S3). Used by the smoke test and the balance report.

import type { Ai, AiMemory, AiProfile } from '../src/ai';
import { emptyMemory } from '../src/ai';
import type { Engine, GameEvent, GameState } from '../src/engine';
import { checkInvariants } from './simulate';

export interface AiGameResult {
  seed: number;
  players: number;
  profiles: string[];
  finished: boolean;
  winner: number | null;
  turns: number;
  rounds: number;
  actions: number;
  // Seat index of each player in turn order: turnOrder[0] moved first.
  turnOrder: number[];
  // Bankruptcies in order, with the turn count when each happened.
  bankruptcies: Array<{ player: number; turn: number }>;
  events: Record<string, number>;
  rentByGroup: Record<string, number>;
  auctionPriceRatio: number[];
  violations: string[];
}

export interface AiGameOptions {
  seed: number;
  profiles: Array<{ id: string; profile: AiProfile }>;
  maxTurns: number;
  checkInvariants: boolean;
}

export function playAiGame(engine: Engine, ai: Ai, opts: AiGameOptions): AiGameResult {
  const n = opts.profiles.length;
  const created = engine.newGame({ playerIds: opts.profiles.map((p, i) => `${p.id}${i}`), seed: opts.seed });
  let state: GameState = created.state;
  const first = state.turn.active;
  const memories: AiMemory[] = opts.profiles.map(() => emptyMemory());
  let rng = (opts.seed * 2654435761) | 0;
  const result: AiGameResult = {
    seed: opts.seed, players: n, profiles: opts.profiles.map((p) => p.id), finished: false, winner: null,
    turns: 0, rounds: 0, actions: 0, turnOrder: Array.from({ length: n }, (_, i) => (first + i) % n),
    bankruptcies: [], events: {}, rentByGroup: {}, auctionPriceRatio: [], violations: [],
  };
  const groupOf = new Map(engine.rules.tiles.map((t) => [t.id, t.group ?? t.type]));
  const priceOf = new Map(engine.rules.tiles.map((t) => [t.id, t.price ?? (t.type === 'hub' ? engine.rules.config.hub.price : engine.rules.config.utility.price)]));

  const record = (events: GameEvent[]) => {
    for (const e of events) {
      result.events[e.type] = (result.events[e.type] ?? 0) + 1;
      if (e.type === 'rentPaid') result.rentByGroup[groupOf.get(e.tileId)!] = (result.rentByGroup[groupOf.get(e.tileId)!] ?? 0) + e.amount;
      if (e.type === 'bankrupt') result.bankruptcies.push({ player: e.player, turn: state.turnCount });
      if (e.type === 'auctionWon') result.auctionPriceRatio.push(e.price / priceOf.get(e.tileId)!);
    }
  };

  while (state.turn.phase !== 'GAME_OVER' && state.turnCount < opts.maxTurns) {
    const pl = ai.nextActor(state)!;
    const d = ai.decide({ state, player: pl, profile: opts.profiles[pl]!.profile, memory: memories[pl]!, rng });
    memories[pl] = d.memory;
    rng = d.rng;
    const next = engine.step(state, d.action);
    if (opts.checkInvariants) {
      const v = checkInvariants(engine, state, next.state, next.events);
      if (v.length) result.violations.push(...v.map((x) => `seed ${opts.seed} action ${result.actions}: ${x}`));
    }
    state = next.state;
    record(next.events);
    result.actions++;
  }
  result.finished = state.turn.phase === 'GAME_OVER';
  result.winner = state.winner;
  result.turns = state.turnCount;
  result.rounds = state.turnCount / n;
  return result;
}
