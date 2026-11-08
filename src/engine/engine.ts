// Rules engine: (state, action) -> (new state, events). No drawing, no randomness outside state.rng.
// Rule IDs (R-xx, D-xx) refer to docs/RULES.md and docs/DECISIONS.md.

import { rollDice } from './rng';
import type { Action, GameEvent, GameState, NewGameOptions, PlayerState, Rules, StepResult, Tile } from './types';

export class IllegalActionError extends Error {}

export interface Engine {
  rules: Rules;
  newGame(opts: NewGameOptions): StepResult;
  legalActions(state: GameState): Action[];
  step(state: GameState, action: Action): StepResult;
  rentFor(state: GameState, tileId: string, diceTotal: number): number;
}

export function createEngine(rules: Rules): Engine {
  const { config, tiles } = rules;
  const tileById = new Map(tiles.map((t) => [t.id, t]));
  const hubIds = tiles.filter((t) => t.type === 'hub').map((t) => t.id);
  const utilityIds = tiles.filter((t) => t.type === 'utility').map((t) => t.id);
  const hotelLevel = config.building.maxHouses + 1;

  const tile = (id: string): Tile => {
    const t = tileById.get(id);
    if (!t) throw new Error(`Unknown tile ${id}`);
    return t;
  };

  const priceOf = (t: Tile): number => {
    if (t.type === 'property') return t.price!;
    if (t.type === 'hub') return config.hub.price;
    if (t.type === 'utility') return config.utility.price;
    throw new Error(`Tile ${t.id} cannot be bought`);
  };

  const isBuyable = (t: Tile) => t.type === 'property' || t.type === 'hub' || t.type === 'utility';

  // ---------- setup ----------

  function newGame(opts: NewGameOptions): StepResult {
    const n = opts.playerIds.length;
    if (n < config.players.min || n > config.players.max) {
      throw new Error(`A game needs ${config.players.min} to ${config.players.max} players (FR-01), got ${n}`);
    }
    const events: GameEvent[] = [{ type: 'gameCreated', players: [...opts.playerIds], seed: opts.seed }];
    let rng = opts.seed | 0;

    // R-09, D-17: everyone rolls, the highest total starts, tied players re-roll among themselves.
    let contenders = opts.playerIds.map((_, i) => i);
    while (contenders.length > 1) {
      const rolls = contenders.map((player) => {
        const r = rollDice(rng, config.dice.count, config.dice.sides);
        rng = r.rng;
        return { player, dice: r.dice, total: r.dice.reduce((a, b) => a + b, 0) };
      });
      events.push({ type: 'orderRoll', rolls });
      const best = Math.max(...rolls.map((r) => r.total));
      contenders = rolls.filter((r) => r.total === best).map((r) => r.player);
    }
    const first = contenders[0]!;
    events.push({ type: 'firstPlayer', player: first });

    const state: GameState = {
      version: 1,
      rng,
      players: opts.playerIds.map((id) => ({ id, cash: opts.startCash ?? config.startCash, position: 0, inJam: false, jamFailedRolls: 0 })),
      properties: {},
      turn: { active: first, phase: 'START_TURN', doublesThisTurn: 0, extraRoll: false, lastDice: null, pendingTile: null },
      turnCount: 0,
    };
    return { state, events };
  }

  // ---------- legality ----------

  function legalActions(state: GameState): Action[] {
    const p = state.players[state.turn.active]!;
    switch (state.turn.phase) {
      case 'START_TURN':
        return [{ type: 'BEGIN_TURN' }];
      case 'ROLL': {
        const actions: Action[] = [{ type: 'ROLL' }];
        if (p.inJam && p.cash >= config.jam.fine) actions.push({ type: 'PAY_JAM_FINE' });
        return actions;
      }
      case 'BUY_DECISION': {
        const t = tile(state.turn.pendingTile!);
        const actions: Action[] = [];
        if (p.cash >= priceOf(t)) actions.push({ type: 'BUY' });
        actions.push({ type: 'DECLINE' });
        return actions;
      }
      case 'MANAGE':
        return [{ type: 'END_TURN' }];
      default:
        return [];
    }
  }

  // ---------- rent (FR-05) ----------

  function rentFor(state: GameState, tileId: string, diceTotal: number): number {
    const t = tile(tileId);
    const owned = state.properties[tileId];
    if (!owned || owned.mortgaged) return 0; // D-16
    const ownerHolds = (ids: string[]) => ids.filter((id) => state.properties[id]?.owner === owned.owner).length;

    if (t.type === 'property') {
      const rent = t.rent!;
      if (owned.houses > 0) return rent[Math.min(owned.houses, hotelLevel)]!;
      const members = rules.groupMembers[t.group!]!;
      // R-24. Q-10 (set doubling while one member is mortgaged) is open; mortgages arrive in S2.
      const fullSet = ownerHolds(members) === members.length;
      return fullSet ? rent[0]! * config.rent.unbuiltFullSetMultiplier : rent[0]!;
    }
    // Q-25 (do mortgaged hubs and utilities count?) is open; mortgages arrive in S2.
    if (t.type === 'hub') return config.hub.rentByHubsOwned[ownerHolds(hubIds) - 1]!;
    if (t.type === 'utility') return diceTotal * config.utility.diceMultiplierByUtilitiesOwned[ownerHolds(utilityIds) - 1]!;
    return 0;
  }

  // ---------- step ----------

  function step(input: GameState, action: Action): StepResult {
    const legal = legalActions(input);
    if (!legal.some((a) => a.type === action.type)) {
      throw new IllegalActionError(`Action ${action.type} is not legal in phase ${input.turn.phase}`);
    }
    const state = structuredClone(input);
    const events: GameEvent[] = [];
    const me = state.turn.active;
    const player = state.players[me]!;

    switch (action.type) {
      case 'BEGIN_TURN':
        state.turn.phase = 'ROLL';
        events.push({ type: 'turnStarted', player: me });
        break;

      case 'PAY_JAM_FINE':
        // R-50, D-21: pay before rolling, then roll normally.
        player.cash -= config.jam.fine;
        player.inJam = false;
        player.jamFailedRolls = 0;
        events.push({ type: 'jamFinePaid', player: me, amount: config.jam.fine, forced: false });
        events.push({ type: 'leftJam', player: me, by: 'fine' });
        break;

      case 'ROLL':
        roll(state, events);
        break;

      case 'BUY': {
        const id = state.turn.pendingTile!;
        const price = priceOf(tile(id));
        player.cash -= price;
        state.properties[id] = { owner: me, houses: 0, mortgaged: false };
        events.push({ type: 'purchased', player: me, tileId: id, price });
        state.turn.pendingTile = null;
        state.turn.phase = 'MANAGE';
        break;
      }

      case 'DECLINE': {
        const id = state.turn.pendingTile!;
        events.push({ type: 'declined', player: me, tileId: id });
        // S1 STUB (D-24): FR-04 auction arrives in S2. Until then the property stays unowned.
        events.push({ type: 'auctionStub', tileId: id });
        state.turn.pendingTile = null;
        state.turn.phase = 'MANAGE';
        break;
      }

      case 'END_TURN':
        endTurn(state, events);
        break;
    }
    return { state, events };
  }

  function roll(state: GameState, events: GameEvent[]): void {
    const me = state.turn.active;
    const p = state.players[me]!;
    const r = rollDice(state.rng, config.dice.count, config.dice.sides);
    state.rng = r.rng;
    const total = r.dice.reduce((a, b) => a + b, 0);
    const doubles = r.dice.every((d) => d === r.dice[0]);
    state.turn.lastDice = r.dice;
    events.push({ type: 'diceRolled', player: me, dice: r.dice, total, doubles });

    if (p.inJam) {
      if (doubles) {
        // R-51, D-21: leave Jam and move by this roll, no extra roll.
        p.inJam = false;
        p.jamFailedRolls = 0;
        events.push({ type: 'leftJam', player: me, by: 'doubles' });
        state.turn.extraRoll = false;
        move(state, events, total);
        return;
      }
      p.jamFailedRolls += 1;
      if (p.jamFailedRolls >= config.jam.maxFailedTurns) {
        // R-51, D-21: forced fine, then move by this roll. S1 STUB (D-24): cash may go below zero.
        p.cash -= config.jam.fine;
        p.inJam = false;
        p.jamFailedRolls = 0;
        events.push({ type: 'jamFinePaid', player: me, amount: config.jam.fine, forced: true });
        events.push({ type: 'leftJam', player: me, by: 'forcedFine' });
        state.turn.extraRoll = false;
        move(state, events, total);
        return;
      }
      events.push({ type: 'stayedInJam', player: me, failedRolls: p.jamFailedRolls });
      state.turn.extraRoll = false;
      state.turn.phase = 'MANAGE';
      return;
    }

    if (doubles) state.turn.doublesThisTurn += 1;
    if (doubles && state.turn.doublesThisTurn >= config.dice.doublesToJam) {
      sendToJam(state, events, 'threeDoubles'); // FR-02
      return;
    }
    state.turn.extraRoll = doubles; // FR-02, D-14: taken at END_TURN
    move(state, events, total);
  }

  function move(state: GameState, events: GameEvent[], steps: number): void {
    const me = state.turn.active;
    const p = state.players[me]!;
    const from = p.position;
    const raw = from + steps;
    p.position = raw % tiles.length;
    events.push({ type: 'moved', player: me, from, to: p.position, steps });
    if (raw >= tiles.length) {
      // R-16, D-15: passing or landing on GO pays once per move.
      p.cash += config.goSalary;
      events.push({ type: 'salary', player: me, amount: config.goSalary });
    }
    resolve(state, events);
  }

  function resolve(state: GameState, events: GameEvent[]): void {
    const me = state.turn.active;
    const p = state.players[me]!;
    const t = tiles[p.position]!;
    events.push({ type: 'landed', player: me, tileId: t.id });
    state.turn.phase = 'MANAGE';

    if (isBuyable(t)) {
      const owned = state.properties[t.id];
      if (!owned) {
        // FR-03: title deed with price, mortgage value and rent schedule.
        const price = priceOf(t);
        const rentKind = t.type as 'property' | 'hub' | 'utility';
        const rent = t.type === 'property' ? [...t.rent!] : t.type === 'hub' ? [...config.hub.rentByHubsOwned] : [...config.utility.diceMultiplierByUtilitiesOwned];
        events.push({ type: 'offerPurchase', player: me, tileId: t.id, price, mortgageValue: price * config.mortgage.rate, rentKind, rent });
        state.turn.pendingTile = t.id;
        state.turn.phase = 'BUY_DECISION';
        return;
      }
      if (owned.owner === me) return;
      if (owned.mortgaged) {
        events.push({ type: 'rentWaived', tileId: t.id, reason: 'mortgaged' });
        return;
      }
      const total = (state.turn.lastDice ?? []).reduce((a, b) => a + b, 0);
      const amount = rentFor(state, t.id, total);
      // S1 STUB (D-24): no DEBT state yet, so cash may go below zero.
      p.cash -= amount;
      state.players[owned.owner]!.cash += amount;
      events.push({ type: 'rentPaid', from: me, to: owned.owner, tileId: t.id, amount });
      return;
    }

    if (t.type === 'tax') {
      const amount = config.tax[t.tax!];
      if (amount === undefined) throw new Error(`No tax amount for ${t.tax}`);
      p.cash -= amount; // S1 STUB (D-24): may go below zero.
      events.push({ type: 'taxPaid', player: me, tileId: t.id, amount });
      return;
    }

    if (t.type === 'lucky' || t.type === 'dohs') {
      // S1 STUB (D-24): FR-09 card draws arrive in S2.
      events.push({ type: 'cardStub', player: me, tileId: t.id, deck: t.type });
      return;
    }

    if (t.type === 'corner' && t.corner === 'go_to_jam') sendToJam(state, events, 'goToJamTile');
  }

  function sendToJam(state: GameState, events: GameEvent[], reason: 'threeDoubles' | 'goToJamTile'): void {
    const me = state.turn.active;
    const p: PlayerState = state.players[me]!;
    // D-23: a direct jump, never pays the salary.
    p.position = rules.jamPos;
    p.inJam = true;
    p.jamFailedRolls = 0;
    state.turn.extraRoll = false; // D-26
    state.turn.phase = 'MANAGE';
    events.push({ type: 'sentToJam', player: me, reason });
  }

  function endTurn(state: GameState, events: GameEvent[]): void {
    const me = state.turn.active;
    if (state.turn.extraRoll && !state.players[me]!.inJam) {
      // FR-02, D-14: extra roll after MANAGE.
      state.turn.extraRoll = false;
      state.turn.phase = 'ROLL';
      events.push({ type: 'extraRoll', player: me });
      return;
    }
    const next = (me + 1) % state.players.length;
    state.turn = { active: next, phase: 'START_TURN', doublesThisTurn: 0, extraRoll: false, lastDice: null, pendingTile: null };
    state.turnCount += 1;
    events.push({ type: 'turnPassed', from: me, to: next });
  }

  return { rules, newGame, legalActions, step, rentFor };
}
