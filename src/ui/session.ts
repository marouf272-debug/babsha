// A game in progress: the engine state, which seats are human or computer, and the computer
// players' turns. The screen subscribes to updates and sends human actions through act().

import type { Ai, AiMemory, AiProfile } from '../ai';
import { emptyMemory } from '../ai';
import type { Action, Engine, GameEvent, GameState, TradeOffer } from '../engine';
import { SAVE_SCHEMA, type GameSettings, type SaveGame } from './save';

export type SeatKind = 'human' | 'easy' | 'medium' | 'hard';

export interface Update {
  state: GameState;
  events: GameEvent[];
}

export interface SessionOptions {
  engine: Engine;
  ai: Ai;
  profiles: Record<'easy' | 'medium' | 'hard', AiProfile>;
  seats: SeatKind[];
  seed: number;
  // How computer moves are delayed so people can follow them. Defaults to setTimeout.
  schedule?: (fn: () => void, ms: number) => void;
  aiDelayMs?: number;
  // FR-19: continue a saved game instead of starting a new one.
  resume?: Pick<SaveGame, 'state' | 'memories' | 'aiRng'>;
  // FR-14: start cash from the game settings, when it differs from config.json.
  startCash?: number;
}

export class Session {
  readonly engine: Engine;
  readonly seats: SeatKind[];
  state: GameState;
  private readonly ai: Ai;
  private readonly profiles: SessionOptions['profiles'];
  private readonly schedule: (fn: () => void, ms: number) => void;
  private readonly aiDelayMs: number;
  private readonly startEvents: GameEvent[];
  private readonly seed: number;
  private readonly memories: AiMemory[];
  private aiRng: number;
  private pending = false;
  private listeners = new Set<(u: Update) => void>();

  constructor(o: SessionOptions) {
    this.engine = o.engine;
    this.ai = o.ai;
    this.profiles = o.profiles;
    this.seats = [...o.seats];
    this.schedule = o.schedule ?? ((fn, ms) => void setTimeout(fn, ms));
    this.aiDelayMs = o.aiDelayMs ?? 700;
    this.seed = o.seed;
    if (o.resume) {
      this.state = structuredClone(o.resume.state);
      this.startEvents = [];
      this.memories = structuredClone(o.resume.memories);
      this.aiRng = o.resume.aiRng;
      return;
    }
    const created = o.engine.newGame({ playerIds: o.seats.map((_, i) => `p${i}`), seed: o.seed, startCash: o.startCash });
    this.state = created.state;
    this.startEvents = created.events;
    this.memories = o.seats.map(() => emptyMemory());
    this.aiRng = (o.seed * 2654435761) | 0; // D-55: computer randomness apart from the dice
  }

  // FR-19: everything needed to continue this game later, exactly where it is.
  snapshot(settings: GameSettings, events: GameEvent[]): SaveGame {
    return {
      schema: SAVE_SCHEMA, savedAt: Date.now(), seed: this.seed, seats: [...this.seats], settings: { ...settings },
      state: structuredClone(this.state), memories: structuredClone(this.memories), aiRng: this.aiRng, events: [...events],
    };
  }

  subscribe(fn: (u: Update) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  start(): void {
    this.emit(this.startEvents);
    this.continue();
  }

  get humanCount(): number {
    return this.seats.filter((s) => s === 'human').length;
  }

  isHuman(player: number): boolean {
    return this.seats[player] === 'human';
  }

  // Who must act now (same rotation the computer players use), or null when the game is over.
  actor(): number | null {
    return this.ai.nextActor(this.state);
  }

  legalFor(player: number): Action[] {
    return this.engine.legalActions(this.state).filter((a) => a.player === player);
  }

  tradeProblem(offer: Omit<TradeOffer, 'from'>): string | null {
    return this.engine.tradeProblem(this.state, offer);
  }

  // A human action. Throws if it is not that human's move or not legal.
  act(action: Action): void {
    const who = this.actor();
    if (who === null || !this.isHuman(who)) throw new Error('It is not a human move');
    if (action.player !== undefined && action.player !== who) throw new Error(`Player ${action.player} cannot act now`);
    this.apply({ ...action, player: who } as Action);
  }

  private apply(action: Action): void {
    const r = this.engine.step(this.state, action);
    this.state = r.state;
    this.emit(r.events);
    this.continue();
  }

  private emit(events: GameEvent[]): void {
    const u = { state: this.state, events };
    for (const fn of this.listeners) fn(u);
  }

  // After every change: start a lone human's turn without a hand-off, or schedule a computer move.
  private continue(): void {
    const who = this.actor();
    if (who === null) return;
    if (this.isHuman(who)) {
      if (this.state.turn.phase === 'START_TURN' && this.humanCount <= 1) this.apply({ type: 'BEGIN_TURN', player: who });
      return;
    }
    if (this.pending) return;
    this.pending = true;
    this.schedule(() => {
      this.pending = false;
      const now = this.actor();
      if (now === null || this.isHuman(now)) return;
      const seat = this.seats[now] as 'easy' | 'medium' | 'hard';
      const d = this.ai.decide({ state: this.state, player: now, profile: this.profiles[seat], memory: this.memories[now]!, rng: this.aiRng });
      this.memories[now] = d.memory;
      this.aiRng = d.rng;
      this.apply(d.action);
    }, this.aiDelayMs);
  }
}
