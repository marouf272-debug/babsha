// Headless simulation harness (plan 3.4 /sim). Plays random legal actions and checks invariants
// after every step. S1: random agents only; AI profiles arrive in S3.

import { nextFloat, type Engine, type GameEvent, type GameState } from '../src/engine';

export interface SimOptions {
  games: number;
  maxActions: number;
  seed: number;
}

export interface SimReport {
  games: number;
  actions: number;
  turns: number;
  violations: string[];
  events: Record<string, number>;
  propertiesOwnedAtEnd: number;
  playersBelowZeroAtEnd: number;
  finalStates: GameState[];
}

const RESTING = new Set(['START_TURN', 'ROLL', 'BUY_DECISION', 'AUCTION', 'MANAGE', 'DEBT', 'GAME_OVER']);

// Net money that enters (+) or leaves (-) the players' hands, from the events of one step.
function bankFlow(events: GameEvent[]): number {
  let flow = 0;
  for (const e of events) {
    if (e.type === 'salary') flow += e.amount;
    else if (e.type === 'purchased') flow -= e.price;
    else if (e.type === 'taxPaid') flow -= e.amount;
    else if (e.type === 'jamFinePaid') flow -= e.amount;
    else if (e.type === 'auctionWon') flow -= e.price;
  }
  return flow;
}

export function checkInvariants(engine: Engine, before: GameState, after: GameState, events: GameEvent[]): string[] {
  const v: string[] = [];
  const { rules } = engine;
  const n = after.players.length;
  if (after.turn.active < 0 || after.turn.active >= n) v.push(`active player ${after.turn.active} out of range`);
  if (!RESTING.has(after.turn.phase)) v.push(`phase ${after.turn.phase} is not a resting phase`);
  if (after.turn.phase !== 'GAME_OVER' && engine.legalActions(after).length === 0) v.push(`stuck: no legal action in ${after.turn.phase}`);
  after.players.forEach((p, i) => {
    if (!Number.isInteger(p.position) || p.position < 0 || p.position >= rules.tiles.length) v.push(`player ${i} position ${p.position}`);
    if (p.inJam && p.position !== rules.jamPos) v.push(`player ${i} in Jam but at ${p.position}`);
    if (!p.inJam && p.jamFailedRolls !== 0) v.push(`player ${i} has failed rolls outside Jam`);
    if (!Number.isFinite(p.cash) || !Number.isInteger(p.cash)) v.push(`player ${i} cash ${p.cash}`);
  });
  for (const [id, prop] of Object.entries(after.properties)) {
    const t = rules.tiles.find((x) => x.id === id);
    if (!t || !['property', 'hub', 'utility'].includes(t.type)) v.push(`owned tile ${id} is not buyable`);
    if (prop.owner < 0 || prop.owner >= n) v.push(`tile ${id} owner ${prop.owner} out of range`);
    // S1: nothing can build or mortgage yet.
    if (prop.houses !== 0) v.push(`tile ${id} has buildings in S1`);
    if (prop.mortgaged) v.push(`tile ${id} is mortgaged in S1`);
  }
  for (const [id, prop] of Object.entries(before.properties)) {
    if (after.properties[id]?.owner !== prop.owner) v.push(`tile ${id} changed owner without a trade`);
  }
  if (after.turn.phase === 'BUY_DECISION') {
    const id = after.turn.pendingTile;
    if (!id || after.properties[id]) v.push(`buy decision on ${id} which is missing or owned`);
  }
  const cash = (s: GameState) => s.players.reduce((a, p) => a + p.cash, 0);
  if (cash(after) !== cash(before) + bankFlow(events)) v.push(`money not conserved: ${cash(before)} + ${bankFlow(events)} != ${cash(after)}`);
  return v;
}

export function simulate(engine: Engine, opts: SimOptions): SimReport {
  const report: SimReport = { games: 0, actions: 0, turns: 0, violations: [], events: {}, propertiesOwnedAtEnd: 0, playersBelowZeroAtEnd: 0, finalStates: [] };
  let agentRng = opts.seed ^ 0x5bd1e995;
  for (let g = 0; g < opts.games; g++) {
    const players = 2 + (g % 5); // cycles 2 to 6 players
    const created = engine.newGame({ playerIds: Array.from({ length: players }, (_, i) => `p${i}`), seed: opts.seed + g });
    let state = created.state;
    for (let a = 0; a < opts.maxActions; a++) {
      const legal = engine.legalActions(state);
      if (legal.length === 0) break;
      const [r, next] = nextFloat(agentRng);
      agentRng = next;
      const action = legal[Math.floor(r * legal.length)]!;
      const result = engine.step(state, action);
      for (const e of result.events) report.events[e.type] = (report.events[e.type] ?? 0) + 1;
      const v = checkInvariants(engine, state, result.state, result.events);
      if (v.length) report.violations.push(...v.map((x) => `game ${g} action ${a}: ${x}`));
      state = result.state;
      report.actions++;
    }
    report.turns += state.turnCount;
    report.propertiesOwnedAtEnd += Object.keys(state.properties).length;
    report.playersBelowZeroAtEnd += state.players.filter((p) => p.cash < 0).length;
    report.finalStates.push(state);
    report.games++;
  }
  return report;
}
