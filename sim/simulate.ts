// Headless simulation harness (plan 3.4 /sim). Plays random legal actions and checks invariants
// after every step. Random agents only; AI profiles arrive in S3.

import { nextFloat, type Action, type Engine, type GameEvent, type GameState, type TradeOffer } from '../src/engine';

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
  gamesWon: number;
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
    else if (e.type === 'buildingBought') flow -= e.cost;
    else if (e.type === 'buildingSold') flow += e.refund;
    else if (e.type === 'mortgaged') flow += e.amount;
    else if (e.type === 'redeemed') flow -= e.cost;
    else if (e.type === 'cardCollected') flow += e.amount;
    else if (e.type === 'cardPaid' && e.to === 'bank') flow -= e.amount;
    else if (e.type === 'debtPaid' || e.type === 'bankrupt') {
      for (const t of e.transfers) if (t.to === 'bank') flow -= t.amount;
    }
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
    if (p.cash < 0) v.push(`player ${i} cash below zero: ${p.cash}`);
    if (p.bankrupt && (p.cash !== 0 || p.jamCards.length > 0)) v.push(`bankrupt player ${i} still holds cash or cards`);
    if (p.bankrupt && Object.values(after.properties).some((x) => x.owner === i)) v.push(`bankrupt player ${i} still owns property`);
  });
  if (after.turn.phase === 'DEBT' && after.debts.length === 0) v.push('DEBT phase with no debt');
  if (after.turn.phase !== 'DEBT' && after.turn.phase !== 'GAME_OVER' && after.debts.length > 0) v.push(`debts left open in ${after.turn.phase}`);
  if (after.turn.phase === 'AUCTION' && !after.auction) v.push('AUCTION phase with no auction');
  if (after.turn.phase !== 'AUCTION' && after.auction) v.push(`auction left open in ${after.turn.phase}`);
  const aliveCount = after.players.filter((p) => !p.bankrupt).length;
  if (after.turn.phase === 'GAME_OVER') {
    if (aliveCount !== 1 || after.winner === null || after.players[after.winner]!.bankrupt) v.push('GAME_OVER without exactly one solvent winner');
  } else if (aliveCount < 2) v.push(`only ${aliveCount} solvent players but game not over`);
  // D-50: a bankrupt active player's properties are auctioned before the turn passes, so the turn
  // may still point at them during AUCTION or a queued DEBT, but never anywhere else.
  if (!['GAME_OVER', 'AUCTION', 'DEBT'].includes(after.turn.phase) && after.players[after.turn.active]!.bankrupt) v.push(`a bankrupt player is active in ${after.turn.phase}`);
  for (const a of engine.legalActions(after)) {
    if (a.player !== undefined && after.players[a.player]!.bankrupt) v.push(`bankrupt player ${a.player} has a legal action ${a.type}`);
  }
  for (const [id, prop] of Object.entries(after.properties)) {
    const t = rules.tiles.find((x) => x.id === id);
    if (!t || !['property', 'hub', 'utility'].includes(t.type)) v.push(`owned tile ${id} is not buyable`);
    if (prop.owner < 0 || prop.owner >= n) v.push(`tile ${id} owner ${prop.owner} out of range`);
    if (prop.houses > 0 && t?.type !== 'property') v.push(`tile ${id} has buildings but is not a property`);
  }
  // Plan 4.3 S2 invariants: buildings only on a full set with nothing mortgaged, built evenly.
  for (const members of Object.values(rules.groupMembers)) {
    const props = members.map((id) => after.properties[id]);
    const houses = props.map((x) => x?.houses ?? 0);
    if (Math.max(...houses) === 0) continue;
    if (props.some((x) => !x || x.owner !== props[0]!.owner)) v.push(`buildings on an incomplete set ${members.join(',')}`);
    if (props.some((x) => x?.mortgaged)) v.push(`buildings on a mortgaged set ${members.join(',')}`);
    if (Math.max(...houses) - Math.min(...houses) > 1) v.push(`uneven buildings on ${members.join(',')}: ${houses.join(',')}`);
  }
  const transferred = events.some((e) => e.type === 'bankrupt' || e.type === 'tradeAccepted');
  for (const [id, prop] of Object.entries(before.properties)) {
    if (after.properties[id]?.owner !== prop.owner && !transferred) v.push(`tile ${id} changed owner without a trade or bankruptcy`);
  }
  // card-game skill: every card is in exactly one place, its deck or one player's hand (D-40).
  for (const deck of ['lucky', 'dohs'] as const) {
    const held = after.players.flatMap((p) => p.jamCards.filter((c) => c.deck === deck).map((c) => c.cardId));
    const all = [...after.decks[deck], ...held].sort();
    const expected = rules.cards[deck].map((c) => c.id).sort();
    if (JSON.stringify(all) !== JSON.stringify(expected)) v.push(`deck ${deck} lost or duplicated a card`);
  }
  if (after.trade && after.turn.phase !== 'MANAGE' && after.turn.phase !== 'DEBT') v.push(`trade waiting in ${after.turn.phase}`);
  if (after.turn.phase === 'BUY_DECISION') {
    const id = after.turn.pendingTile;
    if (!id || after.properties[id]) v.push(`buy decision on ${id} which is missing or owned`);
  }
  const cash = (s: GameState) => s.players.reduce((a, p) => a + p.cash, 0);
  if (cash(after) !== cash(before) + bankFlow(events)) v.push(`money not conserved: ${cash(before)} + ${bankFlow(events)} != ${cash(after)}`);
  return v;
}

// Random agent with fixed weights per action type, so games do things a real player would
// (build, redeem) more often than things that stall them (mortgage, sell). Not an AI: S3 adds those.
const WEIGHTS: Partial<Record<Action['type'], number>> = {
  END_TURN: 5, BUILD: 4, REDEEM: 2, BUY: 3, SELL_BUILDING: 0.3, MORTGAGE: 0.3,
  PAY_DEBT: 50, DECLARE_BANKRUPTCY: 0.2,
};

function pickWeighted(legal: Action[], r: number): Action {
  const w = legal.map((a) => WEIGHTS[a.type] ?? 1);
  let x = r * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < legal.length; i++) {
    x -= w[i]!;
    if (x < 0) return legal[i]!;
  }
  return legal[legal.length - 1]!;
}

// Builds a random trade from the current manager to another player, or null if none is valid.
function randomOffer(engine: Engine, state: GameState, r: number): Omit<TradeOffer, 'from'> | null {
  const from = state.turn.phase === 'DEBT' ? state.debts[0]!.debtor : state.turn.active;
  const others = state.players.map((_, i) => i).filter((i) => i !== from && !state.players[i]!.bankrupt);
  if (others.length === 0) return null;
  const to = others[Math.floor(r * others.length)]!;
  const owned = (who: number) => Object.entries(state.properties).filter(([, p]) => p.owner === who).map(([id]) => id);
  const pick = (ids: string[], k: number) => (ids.length ? [ids[Math.floor(k * ids.length) % ids.length]!] : []);
  const offer = {
    to,
    giveTiles: pick(owned(from), (r * 7) % 1),
    getTiles: pick(owned(to), (r * 13) % 1),
    giveCash: Math.floor(((r * 17) % 1) * Math.min(500, state.players[from]!.cash) / 10) * 10,
    getCash: Math.floor(((r * 19) % 1) * Math.min(500, state.players[to]!.cash) / 10) * 10,
  };
  return engine.tradeProblem(state, offer) === null ? offer : null;
}

export function simulate(engine: Engine, opts: SimOptions): SimReport {
  const report: SimReport = { games: 0, actions: 0, turns: 0, violations: [], events: {}, propertiesOwnedAtEnd: 0, gamesWon: 0, finalStates: [] };
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
      let action = pickWeighted(legal, r);
      // Now and then, propose a random valid trade instead (FR-08).
      if ((state.turn.phase === 'MANAGE' || state.turn.phase === 'DEBT') && !state.trade && r < 0.04) {
        const [r2, n2] = nextFloat(agentRng);
        agentRng = n2;
        const offer = randomOffer(engine, state, r2);
        if (offer) action = { type: 'PROPOSE_TRADE', offer };
      }
      const result = engine.step(state, action);
      for (const e of result.events) report.events[e.type] = (report.events[e.type] ?? 0) + 1;
      const v = checkInvariants(engine, state, result.state, result.events);
      if (v.length) report.violations.push(...v.map((x) => `game ${g} action ${a}: ${x}`));
      state = result.state;
      report.actions++;
    }
    report.turns += state.turnCount;
    report.propertiesOwnedAtEnd += Object.keys(state.properties).length;
    if (state.turn.phase === 'GAME_OVER') report.gamesWon++;
    report.finalStates.push(state);
    report.games++;
  }
  return report;
}
