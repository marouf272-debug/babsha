// Rules engine: (state, action) -> (new state, events). No drawing, no randomness outside state.rng.
// Rule IDs (R-xx, D-xx) refer to docs/RULES.md and docs/DECISIONS.md.

import { nextFloat, rollDice } from './rng';
import type { Action, Card, CashTarget, Creditor, DebtReason, DeckId, GameEvent, GameState, NewGameOptions, Rules, StepResult, Tile, TradeOffer } from './types';

export class IllegalActionError extends Error {}

export interface Engine {
  rules: Rules;
  newGame(opts: NewGameOptions): StepResult;
  legalActions(state: GameState): Action[];
  step(state: GameState, action: Action): StepResult;
  rentFor(state: GameState, tileId: string, diceTotal: number): number;
  // Why a trade offer from the current manager would be refused, or null if it is valid.
  tradeProblem(state: GameState, offer: Omit<TradeOffer, 'from'>): string | null;
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

  const cardById = new Map<string, Card>([...rules.cards.lucky, ...rules.cards.dohs].map((c) => [c.id, c]));

  const isBuyable = (t: Tile) => t.type === 'property' || t.type === 'hub' || t.type === 'utility';
  const alive = (state: GameState) => state.players.map((_, i) => i).filter((i) => !state.players[i]!.bankrupt);

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

    // D-40: each deck is shuffled once at game start (Fisher-Yates with the seeded generator).
    const decks = {} as Record<DeckId, string[]>;
    for (const deck of ['lucky', 'dohs'] as const) {
      const ids = rules.cards[deck].map((c) => c.id);
      for (let i = ids.length - 1; i > 0; i--) {
        const [v, next] = nextFloat(rng);
        rng = next;
        const j = Math.floor(v * (i + 1));
        [ids[i], ids[j]] = [ids[j]!, ids[i]!];
      }
      decks[deck] = ids;
    }
    events.push({ type: 'decksShuffled', decks: { lucky: [...decks.lucky], dohs: [...decks.dohs] } });

    const state: GameState = {
      version: 2,
      rng,
      players: opts.playerIds.map((id) => ({
        id, cash: opts.startCash ?? config.startCash, position: 0, inJam: false, jamFailedRolls: 0, bankrupt: false, jamCards: [],
      })),
      properties: {},
      turn: { active: first, phase: 'START_TURN', doublesThisTurn: 0, extraRoll: false, lastDice: null, pendingTile: null },
      turnCount: 0,
      decks,
      auction: null,
      auctionQueue: [],
      trade: null,
      debts: [],
      pendingMove: null,
      winner: null,
    };
    return { state, events };
  }

  // ---------- legality ----------

  function legalActions(state: GameState): Action[] {
    if (state.trade) {
      const to = state.trade.to; // FR-08: only the other player may answer a waiting offer
      return [{ type: 'ACCEPT_TRADE', player: to }, { type: 'REJECT_TRADE', player: to }];
    }
    const me = state.turn.active;
    const p = state.players[me]!;
    switch (state.turn.phase) {
      case 'START_TURN':
        return [{ type: 'BEGIN_TURN', player: me }];
      case 'ROLL': {
        const actions: Action[] = [{ type: 'ROLL', player: me }];
        if (p.inJam && p.cash >= config.jam.fine) actions.push({ type: 'PAY_JAM_FINE', player: me });
        if (p.inJam && p.jamCards.length > 0) actions.push({ type: 'USE_JAM_CARD', player: me }); // R-50, D-47
        return actions;
      }
      case 'BUY_DECISION': {
        const t = tile(state.turn.pendingTile!);
        const actions: Action[] = [];
        if (p.cash >= priceOf(t)) actions.push({ type: 'BUY', player: me });
        actions.push({ type: 'DECLINE', player: me });
        return actions;
      }
      case 'AUCTION': {
        const a = state.auction!;
        const min = minBid(state);
        const actions: Action[] = [];
        for (const pl of a.inPlayers) {
          if (pl === a.highBidder) continue; // D-43: the high bidder cannot fold
          if (state.players[pl]!.cash >= min) actions.push({ type: 'BID', player: pl, amount: min });
          actions.push({ type: 'FOLD', player: pl });
        }
        return actions;
      }
      case 'MANAGE':
        return [...manageActions(state, me, 'MANAGE'), { type: 'END_TURN', player: me }];
      case 'DEBT': {
        const d = state.debts[0]!;
        const actions = manageActions(state, d.debtor, 'DEBT');
        if (state.players[d.debtor]!.cash >= d.amount) actions.push({ type: 'PAY_DEBT', player: d.debtor });
        actions.push({ type: 'DECLARE_BANKRUPTCY', player: d.debtor }); // D-49: allowed at any time in DEBT
        return actions;
      }
      default:
        return [];
    }
  }

  // ---------- building (FR-06) ----------

  const setOf = (t: Tile) => rules.groupMembers[t.group!]!;

  function buildCost(t: Tile, houses: number): number {
    return houses < config.building.maxHouses ? t.houseCost! : t.hotelCost!; // D-29
  }

  // R-37, R-38, R-41, D-29, D-31: full set owned, nothing mortgaged in it, even rule, cash for it.
  function canBuild(state: GameState, pl: number, t: Tile): boolean {
    if (t.type !== 'property') return false;
    const members = setOf(t);
    const props = members.map((id) => state.properties[id]);
    if (props.some((x) => !x || x.owner !== pl || x.mortgaged)) return false;
    const mine = state.properties[t.id]!;
    if (mine.houses >= hotelLevel) return false;
    if (mine.houses !== Math.min(...props.map((x) => x!.houses))) return false;
    return state.players[pl]!.cash >= buildCost(t, mine.houses);
  }

  // R-39: sell back following the even rule in reverse.
  function canSell(state: GameState, pl: number, t: Tile): boolean {
    if (t.type !== 'property') return false;
    const mine = state.properties[t.id];
    if (!mine || mine.owner !== pl || mine.houses === 0) return false;
    return mine.houses === Math.max(...setOf(t).map((id) => state.properties[id]?.houses ?? 0));
  }

  // ---------- mortgage (FR-07) ----------

  const mortgageValue = (t: Tile) => priceOf(t) * config.mortgage.rate;
  const redeemCost = (t: Tile) => Math.round(mortgageValue(t) * (1 + config.mortgage.redeemInterest));

  // R-43, D-30: owned, not mortgaged, and for a property the whole set has no buildings.
  function canMortgage(state: GameState, pl: number, t: Tile): boolean {
    if (!isBuyable(t)) return false;
    const mine = state.properties[t.id];
    if (!mine || mine.owner !== pl || mine.mortgaged) return false;
    if (t.type === 'property' && setOf(t).some((id) => (state.properties[id]?.houses ?? 0) > 0)) return false;
    return true;
  }

  // R-44: principal plus 10 percent.
  function canRedeem(state: GameState, pl: number, t: Tile): boolean {
    const mine = state.properties[t.id];
    return !!mine && mine.owner === pl && mine.mortgaged && state.players[pl]!.cash >= redeemCost(t);
  }

  // ---------- trade (FR-08) ----------

  // R-45, R-46, D-44, D-46, D-51.
  function tradeProblem(state: GameState, offer: Omit<TradeOffer, 'from'>): string | null {
    const phase = state.turn.phase;
    if ((phase !== 'MANAGE' && phase !== 'DEBT') || state.trade) return 'Trading is not now';
    const from = actor(state);
    const to = offer.to;
    if (!Number.isInteger(to) || to < 0 || to >= state.players.length || to === from || state.players[to]!.bankrupt) {
      return 'A trade must be with another player still in the game';
    }
    if (offer.giveTiles.length + offer.getTiles.length === 0 && offer.giveCash === 0 && offer.getCash === 0) return 'The offer is empty';
    for (const [cash, who] of [[offer.giveCash, from], [offer.getCash, to]] as const) {
      if (!Number.isInteger(cash) || cash < 0 || cash > state.players[who]!.cash) return 'The cash in the offer is not available';
    }
    const all = [...offer.giveTiles, ...offer.getTiles];
    if (new Set(all).size !== all.length) return 'A tile appears twice';
    for (const [ids, who] of [[offer.giveTiles, from], [offer.getTiles, to]] as const) {
      for (const id of ids) {
        const t = tileById.get(id);
        if (!t || state.properties[id]?.owner !== who) return `Player ${who} does not own ${id}`;
        if (t.type === 'property' && setOf(t).some((m) => (state.properties[m]?.houses ?? 0) > 0)) return `${id} is in a set with buildings`;
      }
    }
    return null;
  }

  // D-46: management actions for the active player in MANAGE, or the debtor in DEBT (D-39).
  function manageActions(state: GameState, pl: number, phase: 'MANAGE' | 'DEBT'): Action[] {
    const actions: Action[] = [];
    for (const t of tiles) {
      if (phase === 'MANAGE' && canBuild(state, pl, t)) actions.push({ type: 'BUILD', player: pl, tileId: t.id });
    }
    for (const t of tiles) {
      if (canSell(state, pl, t)) actions.push({ type: 'SELL_BUILDING', player: pl, tileId: t.id });
    }
    for (const t of tiles) {
      if (canMortgage(state, pl, t)) actions.push({ type: 'MORTGAGE', player: pl, tileId: t.id });
    }
    for (const t of tiles) {
      if (phase === 'MANAGE' && canRedeem(state, pl, t)) actions.push({ type: 'REDEEM', player: pl, tileId: t.id });
    }
    return actions;
  }

  // D-43: first bid may be the opening bid (0), each later bid at least the minimum raise more.
  const minBid = (state: GameState) => {
    const a = state.auction!;
    return a.highBid === null ? config.auction.openingBid : a.highBid + config.auction.minRaise;
  };

  // Matches a requested action against the legal list: same type, same actor, same target.
  // A bid may be any whole amount from the minimum up to the bidder's cash (D-33).
  function isLegal(state: GameState, action: Action): boolean {
    if (action.type === 'PROPOSE_TRADE') {
      if (action.player !== undefined && action.player !== actor(state)) return false;
      return tradeProblem(state, action.offer) === null;
    }
    if (action.type === 'BID') {
      if (!Number.isInteger(action.amount) || action.amount < minBid(state) || action.amount > state.players[action.player]!.cash) return false;
    }
    return legalActions(state).some((a) => {
      if (a.type !== action.type) return false;
      if (action.player !== undefined && a.player !== action.player) return false;
      if ('tileId' in a && 'tileId' in action && a.tileId !== action.tileId) return false;
      return true;
    });
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
      // R-24, D-32: owning the full set doubles unbuilt rent, even if a member is mortgaged.
      const fullSet = ownerHolds(members) === members.length;
      return fullSet ? rent[0]! * config.rent.unbuiltFullSetMultiplier : rent[0]!;
    }
    // D-35: mortgaged hubs and utilities still count toward the number owned.
    if (t.type === 'hub') return config.hub.rentByHubsOwned[ownerHolds(hubIds) - 1]!;
    if (t.type === 'utility') return diceTotal * config.utility.diceMultiplierByUtilitiesOwned[ownerHolds(utilityIds) - 1]!;
    return 0;
  }

  // ---------- step ----------

  function step(input: GameState, action: Action): StepResult {
    if (!isLegal(input, action)) {
      throw new IllegalActionError(`Action ${action.type}${action.player !== undefined ? ` by player ${action.player}` : ''} is not legal in phase ${input.turn.phase}`);
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

      case 'USE_JAM_CARD': {
        // R-50, D-40, D-47: card goes to the bottom of its deck, then the player rolls normally.
        const held = player.jamCards.shift()!;
        state.decks[held.deck].push(held.cardId);
        player.inJam = false;
        player.jamFailedRolls = 0;
        events.push({ type: 'jamCardUsed', player: me, deck: held.deck, cardId: held.cardId });
        events.push({ type: 'leftJam', player: me, by: 'card' });
        break;
      }

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
        state.turn.pendingTile = null;
        startAuction(state, events, id); // FR-04, R-18
        break;
      }

      case 'BID': {
        const a = state.auction!;
        a.highBid = action.amount;
        a.highBidder = action.player;
        events.push({ type: 'bid', player: action.player, tileId: a.tileId, amount: action.amount });
        checkAuctionEnd(state, events);
        break;
      }

      case 'FOLD': {
        const a = state.auction!;
        a.inPlayers = a.inPlayers.filter((pl) => pl !== action.player);
        events.push({ type: 'folded', player: action.player, tileId: a.tileId });
        checkAuctionEnd(state, events);
        break;
      }

      case 'BUILD': {
        const t = tile(action.tileId);
        const prop = state.properties[t.id]!;
        const cost = buildCost(t, prop.houses);
        state.players[actor(state)]!.cash -= cost;
        prop.houses += 1;
        events.push({ type: 'buildingBought', player: actor(state), tileId: t.id, cost, houses: prop.houses });
        break;
      }

      case 'SELL_BUILDING': {
        const pl = actor(state);
        sellBuilding(state, events, pl, action.tileId);
        break;
      }

      case 'MORTGAGE': {
        const pl = actor(state);
        const t = tile(action.tileId);
        const amount = mortgageValue(t);
        state.properties[t.id]!.mortgaged = true;
        state.players[pl]!.cash += amount;
        events.push({ type: 'mortgaged', player: pl, tileId: t.id, amount });
        break;
      }

      case 'REDEEM': {
        const pl = actor(state);
        const t = tile(action.tileId);
        const cost = redeemCost(t);
        state.properties[t.id]!.mortgaged = false;
        state.players[pl]!.cash -= cost;
        events.push({ type: 'redeemed', player: pl, tileId: t.id, cost });
        break;
      }

      case 'PROPOSE_TRADE': {
        const offer: TradeOffer = { from: actor(state), ...action.offer, giveTiles: [...action.offer.giveTiles], getTiles: [...action.offer.getTiles] };
        state.trade = offer;
        events.push({ type: 'tradeProposed', offer });
        break;
      }

      case 'ACCEPT_TRADE': {
        const o = state.trade!;
        const a = state.players[o.from]!;
        const b = state.players[o.to]!;
        a.cash += o.getCash - o.giveCash;
        b.cash += o.giveCash - o.getCash;
        for (const id of o.giveTiles) state.properties[id]!.owner = o.to; // mortgages stay (D-37)
        for (const id of o.getTiles) state.properties[id]!.owner = o.from;
        events.push({ type: 'tradeAccepted', offer: o });
        state.trade = null;
        break;
      }

      case 'REJECT_TRADE':
        events.push({ type: 'tradeRejected', offer: state.trade! });
        state.trade = null;
        break;

      case 'PAY_DEBT': {
        const debt = state.debts.shift()!;
        const transfers = transfer(state, debt.debtor, debt.creditor, debt.amount);
        events.push({ type: 'debtPaid', debt, transfers });
        if (debt.reason === 'jamFine') events.push({ type: 'leftJam', player: debt.debtor, by: 'forcedFine' });
        break;
      }

      case 'DECLARE_BANKRUPTCY':
        bankrupt(state, events);
        break;

      case 'END_TURN':
        endTurn(state, events);
        break;

      default: {
        const unhandled: never = action;
        throw new IllegalActionError(`Unknown action ${JSON.stringify(unhandled)}`);
      }
    }
    settle(state, events);
    return { state, events };
  }

  // Who may manage right now: the active player in MANAGE, the debtor in DEBT.
  function actor(state: GameState): number {
    return state.turn.phase === 'DEBT' ? state.debts[0]!.debtor : state.turn.active;
  }

  // R-39, D-29: refund 50 percent; a hotel goes back to 4 houses.
  function sellBuilding(state: GameState, events: GameEvent[], pl: number, tileId: string): void {
    const t = tile(tileId);
    const prop = state.properties[tileId]!;
    const refund = buildCost(t, prop.houses - 1) * config.building.sellBackRate;
    prop.houses -= 1;
    state.players[pl]!.cash += refund;
    events.push({ type: 'buildingSold', player: pl, tileId, refund, houses: prop.houses });
  }

  // Decides what happens next after any action: debts first, then auctions, then the normal turn.
  function settle(state: GameState, events: GameEvent[]): void {
    if (state.turn.phase === 'GAME_OVER') return;
    if (state.debts.length > 0) {
      state.turn.phase = 'DEBT'; // D-49: debts first, one debtor at a time
      return;
    }
    if (state.auction) {
      state.turn.phase = 'AUCTION';
      return;
    }
    if (state.auctionQueue.length > 0) {
      startAuction(state, events, state.auctionQueue.shift()!);
      return;
    }
    if (state.players[state.turn.active]!.bankrupt) {
      passTurn(state, events);
      return;
    }
    if (state.pendingMove !== null) {
      // D-50: the forced Jam fine is paid, now move by that roll.
      const steps = state.pendingMove;
      state.pendingMove = null;
      move(state, events, steps);
      settle(state, events);
      return;
    }
    if (state.turn.phase === 'AUCTION' || state.turn.phase === 'DEBT') state.turn.phase = 'MANAGE';
  }

  // ---------- debt and bankruptcy (FR-11) ----------

  // Moves cash to a creditor. For a split creditor, each player gets an equal whole share and any
  // remainder goes to the bank (D-48).
  function transfer(state: GameState, from: number, creditor: Creditor, amount: number): Array<{ to: CashTarget; amount: number }> {
    state.players[from]!.cash -= amount;
    if (creditor.kind === 'player') {
      state.players[creditor.player]!.cash += amount;
      return [{ to: creditor.player, amount }];
    }
    if (creditor.kind === 'bank') return [{ to: 'bank', amount }];
    const share = Math.floor(amount / creditor.players.length);
    const out: Array<{ to: CashTarget; amount: number }> = creditor.players.map((pl) => {
      state.players[pl]!.cash += share;
      return { to: pl, amount: share };
    });
    const rest = amount - share * creditor.players.length;
    if (rest > 0) out.push({ to: 'bank', amount: rest });
    return out;
  }

  // R-54 to R-57, D-38, D-45, D-50.
  function bankrupt(state: GameState, events: GameEvent[]): void {
    const debt = state.debts.shift()!;
    const d = debt.debtor;
    const p = state.players[d]!;
    // Buildings are sold to the bank at 50 percent first.
    for (const t of tiles) {
      while (state.properties[t.id]?.owner === d && state.properties[t.id]!.houses > 0) sellBuilding(state, events, d, t.id);
    }
    const mine = tiles.filter((t) => state.properties[t.id]?.owner === d).map((t) => t.id);
    let transfers: Array<{ to: CashTarget; amount: number }>;
    let tilesTo: CashTarget | 'auction';
    if (debt.creditor.kind === 'player') {
      const c = debt.creditor.player;
      transfers = transfer(state, d, debt.creditor, p.cash);
      for (const id of mine) state.properties[id]!.owner = c; // mortgages stay (D-38)
      tilesTo = c;
    } else {
      const creditor: Creditor = debt.creditor.kind === 'split'
        ? { kind: 'split', players: debt.creditor.players.filter((pl) => !state.players[pl]!.bankrupt && pl !== d) }
        : { kind: 'bank' };
      transfers = creditor.kind === 'split' && creditor.players.length === 0 ? transfer(state, d, { kind: 'bank' }, p.cash) : transfer(state, d, creditor, p.cash);
      for (const id of mine) delete state.properties[id]; // mortgages cleared, back to auction
      state.auctionQueue.push(...mine);
      tilesTo = 'auction';
    }
    for (const held of p.jamCards) state.decks[held.deck].push(held.cardId); // D-40
    p.jamCards = [];
    p.bankrupt = true;
    p.inJam = false;
    p.jamFailedRolls = 0;
    if (state.trade && (state.trade.from === d || state.trade.to === d)) state.trade = null;
    if (d === state.turn.active) {
      state.pendingMove = null;
      state.turn.extraRoll = false;
    }
    events.push({ type: 'bankrupt', player: d, creditor: debt.creditor, transfers, tilesTo });

    const left = alive(state);
    if (left.length === 1) {
      // R-56: the last solvent player wins.
      state.winner = left[0]!;
      state.turn.phase = 'GAME_OVER';
      state.debts = [];
      state.auction = null;
      state.auctionQueue = [];
      state.pendingMove = null;
      events.push({ type: 'gameOver', winner: left[0]! });
    }
  }

  // ---------- auction (FR-04) ----------

  function startAuction(state: GameState, events: GameEvent[], tileId: string): void {
    const players = alive(state); // D-33: every active player, including the one who declined
    state.auction = { tileId, highBid: null, highBidder: null, inPlayers: players };
    state.turn.phase = 'AUCTION';
    events.push({ type: 'auctionStarted', tileId, players: [...players] });
  }

  // R-19, R-21, D-43: ends when only the high bidder is left, or when everyone has folded.
  function checkAuctionEnd(state: GameState, events: GameEvent[]): void {
    const a = state.auction!;
    if (a.inPlayers.length === 0) {
      events.push({ type: 'auctionUnsold', tileId: a.tileId });
      state.auction = null;
      return;
    }
    if (a.inPlayers.length === 1 && a.inPlayers[0] === a.highBidder) {
      const winner = a.highBidder;
      const price = a.highBid!;
      state.players[winner]!.cash -= price; // D-33: never more than the winner holds
      state.properties[a.tileId] = { owner: winner, houses: 0, mortgaged: false };
      events.push({ type: 'auctionWon', player: winner, tileId: a.tileId, price });
      state.auction = null;
    }
  }

  // Pays a creditor if the payer can. Otherwise records a debt for the full amount (D-49) and
  // returns false; settle() then enters DEBT.
  function pay(state: GameState, events: GameEvent[], from: number, creditor: Creditor, amount: number, reason: DebtReason): boolean {
    if (state.players[from]!.cash >= amount) {
      transfer(state, from, creditor, amount);
      return true;
    }
    const debt = { debtor: from, creditor, amount, reason };
    state.debts.push(debt);
    events.push({ type: 'debtCreated', debt });
    return false;
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
        // R-51, D-21: forced fine, then move by this roll.
        p.inJam = false;
        p.jamFailedRolls = 0;
        state.turn.extraRoll = false;
        if (pay(state, events, me, { kind: 'bank' }, config.jam.fine, 'jamFine')) {
          events.push({ type: 'jamFinePaid', player: me, amount: config.jam.fine, forced: true });
          events.push({ type: 'leftJam', player: me, by: 'forcedFine' });
          move(state, events, total);
        } else {
          // D-50: settle the fine in DEBT, then move. The player stays on the Jam tile until then.
          state.pendingMove = total;
          state.turn.phase = 'MANAGE';
        }
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
    p.position = ((raw % tiles.length) + tiles.length) % tiles.length;
    events.push({ type: 'moved', player: me, from, to: p.position, steps });
    if (steps > 0 && raw >= tiles.length) {
      // R-16, D-15: passing or landing on GO pays once per move. Backward moves never pay.
      p.cash += config.goSalary;
      events.push({ type: 'salary', player: me, amount: config.goSalary });
    }
    resolve(state, events);
  }

  function resolve(state: GameState, events: GameEvent[]): void {
    const me = state.turn.active;
    const t = tiles[state.players[me]!.position]!;
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
      if (pay(state, events, me, { kind: 'player', player: owned.owner }, amount, 'rent')) {
        events.push({ type: 'rentPaid', from: me, to: owned.owner, tileId: t.id, amount });
      }
      return;
    }

    if (t.type === 'tax') {
      const amount = config.tax[t.tax!];
      if (amount === undefined) throw new Error(`No tax amount for ${t.tax}`);
      if (pay(state, events, me, { kind: 'bank' }, amount, 'tax')) events.push({ type: 'taxPaid', player: me, tileId: t.id, amount });
      return;
    }

    if (t.type === 'lucky' || t.type === 'dohs') {
      drawCard(state, events, t.type); // FR-09
      return;
    }

    if (t.type === 'corner' && t.corner === 'go_to_jam') sendToJam(state, events, 'goToJamTile');
  }

  // ---------- cards (FR-09) ----------

  // R-30, R-33, D-40: draw the top card; it goes to the bottom unless it is held.
  function drawCard(state: GameState, events: GameEvent[], deck: DeckId): void {
    const me = state.turn.active;
    const p = state.players[me]!;
    const id = state.decks[deck].shift()!;
    const card = cardById.get(id)!;
    events.push({ type: 'cardDrawn', player: me, deck, cardId: id });
    const fx = card.effect;
    if (fx.type === 'jamFreeCard') {
      p.jamCards.push({ deck, cardId: id }); // R-32
      events.push({ type: 'cardHeld', player: me, deck, cardId: id });
      return;
    }
    state.decks[deck].push(id);
    const others = alive(state).filter((i) => i !== me);
    const seatOrder = others.sort((a, b) => ((a - me + state.players.length) % state.players.length) - ((b - me + state.players.length) % state.players.length));

    switch (fx.type) {
      case 'collect':
        p.cash += fx.amount;
        events.push({ type: 'cardCollected', player: me, cardId: id, amount: fx.amount });
        return;
      case 'pay':
        if (pay(state, events, me, { kind: 'bank' }, fx.amount, 'card')) events.push({ type: 'cardPaid', from: me, to: 'bank', cardId: id, amount: fx.amount });
        return;
      case 'collectFromEach':
        // D-49: each payer in seat order after the active player; short payers settle in DEBT.
        for (const o of seatOrder) {
          if (pay(state, events, o, { kind: 'player', player: me }, fx.amount, 'card')) events.push({ type: 'cardPaid', from: o, to: me, cardId: id, amount: fx.amount });
        }
        return;
      case 'payEach': {
        if (seatOrder.length === 0) return;
        // D-45: one debt to all of them if the player cannot pay everyone.
        if (pay(state, events, me, { kind: 'split', players: seatOrder }, fx.amount * seatOrder.length, 'card')) {
          for (const o of seatOrder) events.push({ type: 'cardPaid', from: me, to: o, cardId: id, amount: fx.amount });
        }
        return;
      }
      case 'moveTo': {
        const target = tile(fx.tile).pos;
        move(state, events, (target - p.position + tiles.length) % tiles.length || tiles.length); // D-41
        return;
      }
      case 'moveBy':
        move(state, events, fx.steps);
        return;
      case 'goToJam':
        sendToJam(state, events, 'card');
        return;
      case 'repairs': {
        let amount = 0;
        for (const prop of Object.values(state.properties)) {
          if (prop.owner !== me) continue;
          amount += prop.houses >= hotelLevel ? fx.perHotel : prop.houses * fx.perHouse;
        }
        if (amount > 0 && pay(state, events, me, { kind: 'bank' }, amount, 'card')) events.push({ type: 'cardPaid', from: me, to: 'bank', cardId: id, amount });
        return;
      }
    }
  }

  function sendToJam(state: GameState, events: GameEvent[], reason: 'threeDoubles' | 'goToJamTile' | 'card'): void {
    const me = state.turn.active;
    const p = state.players[me]!;
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
    if (state.turn.extraRoll && !state.players[me]!.inJam && !state.players[me]!.bankrupt) {
      // FR-02, D-14: extra roll after MANAGE.
      state.turn.extraRoll = false;
      state.turn.phase = 'ROLL';
      events.push({ type: 'extraRoll', player: me });
      return;
    }
    passTurn(state, events);
  }

  function passTurn(state: GameState, events: GameEvent[]): void {
    const me = state.turn.active;
    const n = state.players.length;
    let next = (me + 1) % n;
    while (state.players[next]!.bankrupt && next !== me) next = (next + 1) % n;
    state.turn = { active: next, phase: 'START_TURN', doublesThisTurn: 0, extraRoll: false, lastDice: null, pendingTile: null };
    state.turnCount += 1;
    events.push({ type: 'turnPassed', from: me, to: next });
  }

  return { rules, newGame, legalActions, step, rentFor, tradeProblem };
}
