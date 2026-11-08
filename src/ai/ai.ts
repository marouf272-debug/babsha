// Computer players (FR-13). Pure decisions over the engine's legal actions. See docs/AI.md.

import { nextFloat, rollDice, type Action, type Engine, type GameState, type Tile, type TradeOffer } from '../engine';
import { compensate, linear } from './curves';
import type { AiMemory, AiProfile, DecideInput, DecideResult } from './types';

export const emptyMemory = (): AiMemory => ({ proposedOnTurn: {}, lastOffer: {} });

export interface Ai {
  decide(input: DecideInput): DecideResult;
  // Who must act now, or null when nobody can (game over).
  nextActor(state: GameState): number | null;
  landingFrequency: Record<string, number>;
}

const EARLY_GAME_UNOWNED = 10;

export function createAi(engine: Engine): Ai {
  const { rules } = engine;
  const { config, tiles } = rules;
  const tileById = new Map(tiles.map((t) => [t.id, t]));
  const buyable = tiles.filter((t) => t.type === 'property' || t.type === 'hub' || t.type === 'utility');
  const landingFrequency = estimateLandingFrequency();
  const avgFrequency = buyable.reduce((a, t) => a + landingFrequency[t.id]!, 0) / buyable.length;

  const priceOf = (t: Tile) => (t.type === 'property' ? t.price! : t.type === 'hub' ? config.hub.price : config.utility.price);
  const groupOf = (t: Tile) => (t.type === 'property' ? rules.groupMembers[t.group!]! : buyable.filter((x) => x.type === t.type).map((x) => x.id));
  const others = (state: GameState, pl: number) => state.players.map((_, i) => i).filter((i) => i !== pl && !state.players[i]!.bankrupt);

  // Rolls the dice through the board once, with Go to Jam and three doubles, to estimate how
  // often each tile is landed on. Cards are ignored. Fixed seed, so it is the same every run.
  function estimateLandingFrequency(): Record<string, number> {
    const counts = new Array<number>(tiles.length).fill(0);
    const goToJam = tiles.find((t) => t.corner === 'go_to_jam')?.pos ?? -1;
    let rng = 12345;
    let pos = 0;
    let doubles = 0;
    const N = 100_000;
    for (let i = 0; i < N; i++) {
      const r = rollDice(rng, config.dice.count, config.dice.sides);
      rng = r.rng;
      const isDouble = r.dice.every((d) => d === r.dice[0]);
      doubles = isDouble ? doubles + 1 : 0;
      if (doubles >= config.dice.doublesToJam) {
        pos = rules.jamPos;
        doubles = 0;
        continue;
      }
      pos = (pos + r.dice.reduce((a, b) => a + b, 0)) % tiles.length;
      counts[pos]! += 1;
      if (pos === goToJam) pos = rules.jamPos;
    }
    return Object.fromEntries(tiles.map((t) => [t.id, counts[t.pos]! / N]));
  }

  // Price times a multiplier for set progress, seen from `pl`, as if the tile were up for grabs.
  function tileValue(state: GameState, pl: number, tileId: string, profile: AiProfile): number {
    const t = tileById.get(tileId)!;
    const price = priceOf(t);
    const members = groupOf(t).filter((id) => id !== tileId);
    const ownedBy = (who: number) => members.filter((id) => state.properties[id]?.owner === who).length;
    let mult = 1;
    if (t.type === 'property') {
      const need = members.length;
      const mine = ownedBy(pl);
      if (mine === need) mult += profile.setBonus.complete;
      else if (mine > 0) mult += profile.setBonus.extend * (mine / need);
      const theirs = Math.max(0, ...others(state, pl).map(ownedBy));
      if (theirs === need) mult += profile.setBonus.block;
      else if (theirs > 0) mult += profile.setBonus.block * 0.5 * (theirs / need);
    } else if (t.type === 'hub') {
      mult += 0.25 * ownedBy(pl);
    } else {
      mult += 0.15 * ownedBy(pl);
    }
    if (profile.useLandingFrequency) mult *= Math.min(1.3, Math.max(0.8, landingFrequency[tileId]! / avgFrequency));
    return price * mult;
  }

  // Base reserve plus a share of the worst rent an opponent could charge right now.
  function reserve(state: GameState, pl: number, profile: AiProfile): number {
    let worst = 0;
    for (const [id, prop] of Object.entries(state.properties)) {
      if (prop.owner === pl || state.players[prop.owner]!.bankrupt) continue;
      worst = Math.max(worst, engine.rentFor(state, id, 7));
    }
    return profile.reserve.base + profile.reserve.threatShare * worst;
  }

  const completesSet = (state: GameState, pl: number, t: Tile) =>
    t.type === 'property' && groupOf(t).every((id) => id === t.id || state.properties[id]?.owner === pl);

  function nextActor(state: GameState): number | null {
    if (state.turn.phase === 'GAME_OVER') return null;
    if (state.trade) return state.trade.to;
    if (state.turn.phase === 'DEBT') return state.debts[0]!.debtor;
    if (state.turn.phase === 'AUCTION') {
      const a = state.auction!;
      const anchor = a.highBidder ?? state.turn.active;
      const n = state.players.length;
      const candidates = a.inPlayers.filter((p) => p !== a.highBidder);
      if (candidates.length === 0) return null;
      // Bidders are asked in seat order, starting after the high bidder (or the active player).
      return candidates.reduce((best, p) => (((p - anchor - 1 + n) % n) < ((best - anchor - 1 + n) % n) ? p : best));
    }
    return state.turn.active;
  }

  function decide(input: DecideInput): DecideResult {
    const { state, player: pl, profile } = input;
    let rng = input.rng;
    let memory = input.memory;
    const noise = () => {
      if (profile.noise === 0) return 0;
      const [v, next] = nextFloat(rng);
      rng = next;
      return (v - 0.5) * 2 * profile.noise;
    };
    const me = state.players[pl]!;
    const legal = engine.legalActions(state).filter((a) => a.player === pl);
    const has = (type: Action['type']) => legal.find((a) => a.type === type);
    const done = (action: Action): DecideResult => ({ action, memory, rng });

    // A trade waiting for this player's answer.
    if (state.trade && state.trade.to === pl) return done(answerTrade(state, pl, profile, state.trade, noise()));

    switch (state.turn.phase) {
      case 'START_TURN':
        return done({ type: 'BEGIN_TURN', player: pl });

      case 'ROLL': {
        if (me.inJam) {
          const early = buyable.filter((t) => !state.properties[t.id]).length >= EARLY_GAME_UNOWNED;
          const card = has('USE_JAM_CARD');
          if (card && (early || !profile.jam.stayLate)) return done(card);
          const fine = has('PAY_JAM_FINE');
          const r = reserve(state, pl, profile);
          if (fine && early && profile.jam.payFineEarly && me.cash - config.jam.fine >= r) return done(fine);
          if (fine && !early && !profile.jam.stayLate && profile.jam.payFineEarly && me.cash - config.jam.fine >= 2 * r) return done(fine);
        }
        return done({ type: 'ROLL', player: pl });
      }

      case 'BUY_DECISION': {
        const t = tileById.get(state.turn.pendingTile!)!;
        const price = priceOf(t);
        if (!has('BUY')) return done({ type: 'DECLINE', player: pl });
        const after = me.cash - price;
        if (completesSet(state, pl, t) && after >= 0) return done({ type: 'BUY', player: pl });
        // Auctions are only cheap head to head (balance report), so this applies with one opponent.
        if (profile.declineToAuction && others(state, pl).length === 1) {
          // An opponent is only expected to bid above list if they already own part of the group.
          const contested = others(state, pl).some((o) => groupOf(t).some((id) => id !== t.id && state.properties[id]?.owner === o));
          if (!contested) return done({ type: 'DECLINE', player: pl });
        }
        const affordability = linear(after, 0, reserve(state, pl, profile));
        const desirability = linear(tileValue(state, pl, t.id, profile) / price, 0.5, 1.5);
        const score = compensate(affordability * desirability, 2) + noise();
        return done({ type: score >= profile.buyThreshold ? 'BUY' : 'DECLINE', player: pl });
      }

      case 'AUCTION': {
        const bid = legal.find((a) => a.type === 'BID') as Extract<Action, { type: 'BID' }> | undefined;
        if (bid) {
          const a = state.auction!;
          const value = tileValue(state, pl, a.tileId, profile) * (profile.bidFactor + noise());
          const cashCap = me.cash - 0.5 * reserve(state, pl, profile);
          if (bid.amount <= Math.min(value, cashCap)) return done(bid);
        }
        return done({ type: 'FOLD', player: pl });
      }

      case 'MANAGE': {
        const choice = manage(state, pl, profile, memory, noise);
        if (choice.type === 'PROPOSE_TRADE') {
          const lastOffer = { ...memory.lastOffer };
          for (const id of choice.offer.getTiles) lastOffer[id] = choice.offer.giveCash;
          memory = { proposedOnTurn: { ...memory.proposedOnTurn, [pl]: state.turnCount }, lastOffer };
        }
        return done(choice);
      }

      case 'DEBT':
        return done(settleDebt(state, pl, profile, legal));

      default:
        throw new Error(`AI has no move in phase ${state.turn.phase}`);
    }
  }

  function manage(state: GameState, pl: number, profile: AiProfile, memory: AiMemory, noise: () => number): Action {
    const me = state.players[pl]!;
    const legal = engine.legalActions(state).filter((a) => a.player === pl);
    const r = reserve(state, pl, profile);
    const ofType = <T extends Action['type']>(type: T) => legal.filter((a): a is Extract<Action, { type: T }> => a.type === type);
    const redeemCost = (t: Tile) => Math.round(priceOf(t) * config.mortgage.rate * (1 + config.mortgage.redeemInterest));
    const ownsSet = (t: Tile) => t.type === 'property' && groupOf(t).every((id) => state.properties[id]?.owner === pl);

    // 1. Redeem set properties first, since a mortgage in a set blocks building.
    const redeems = ofType('REDEEM').map((a) => ({ a, t: tileById.get(a.tileId)! }));
    const setRedeem = redeems.filter(({ t }) => ownsSet(t)).find(({ t }) => me.cash - redeemCost(t) >= r);
    if (setRedeem) return setRedeem.a;

    // 2. Build where the rent gain per Taka is best, keeping the reserve.
    let bestBuild: { a: Action; score: number } | null = null;
    for (const a of ofType('BUILD')) {
      const t = tileById.get(a.tileId)!;
      const prop = state.properties[t.id]!;
      const cost = prop.houses < config.building.maxHouses ? t.houseCost! : t.hotelCost!;
      if (me.cash - cost < r) continue;
      const gain = t.rent![prop.houses + 1]! - (prop.houses === 0 ? t.rent![0]! * config.rent.unbuiltFullSetMultiplier : t.rent![prop.houses]!);
      const score = (gain / cost) * (1 + noise());
      if (!bestBuild || score > bestBuild.score) bestBuild = { a, score };
    }
    if (bestBuild) return bestBuild.a;

    // 3. Redeem anything else when cash is well above the reserve.
    const otherRedeem = redeems.find(({ t }) => me.cash - redeemCost(t) >= r * profile.redeemSpareFactor);
    if (otherRedeem) return otherRedeem.a;

    // 4. Offer cash for the one tile that completes a set, once per turn.
    if (profile.trade.propose && memory.proposedOnTurn[pl] !== state.turnCount) {
      const offer = setCompletingOffer(state, pl, profile, r, memory);
      if (offer && engine.tradeProblem(state, offer) === null) return { type: 'PROPOSE_TRADE', player: pl, offer };
    }

    return { type: 'END_TURN', player: pl };
  }

  // The one tile `who` lacks in each set they could complete, with its current owner.
  function missingOne(state: GameState, who: number): Array<{ tile: string; owner: number }> {
    const out: Array<{ tile: string; owner: number }> = [];
    for (const members of Object.values(rules.groupMembers)) {
      const missing = members.filter((id) => state.properties[id]?.owner !== who);
      if (missing.length !== 1) continue;
      const owner = state.properties[missing[0]!]?.owner;
      if (owner !== undefined && owner !== who && !state.players[owner]!.bankrupt) out.push({ tile: missing[0]!, owner });
    }
    return out;
  }

  const roundTen = (x: number) => Math.round(x / 10) * 10;

  // Trade ideas in order: a swap that completes a set for both players, cash for the tile that
  // completes my set, then cash for another player's lone tile in a group I have started.
  function setCompletingOffer(state: GameState, pl: number, profile: AiProfile, r: number, memory: AiMemory): Omit<TradeOffer, 'from'> | null {
    const me = state.players[pl]!;
    const spare = Math.floor(me.cash - r);
    const wants = missingOne(state, pl);
    for (const w of wants) {
      const myGroup = tileById.get(w.tile)!.group;
      const theirNeed = missingOne(state, w.owner).find((x) => x.owner === pl && tileById.get(x.tile)!.group !== myGroup);
      if (!theirNeed) continue;
      const diff = roundTen((priceOf(tileById.get(w.tile)!) - priceOf(tileById.get(theirNeed.tile)!)) / 2);
      const giveCash = Math.max(0, Math.min(diff, spare));
      const getCash = Math.max(0, Math.min(-diff, state.players[w.owner]!.cash));
      return { to: w.owner, giveTiles: [theirNeed.tile], giveCash, getTiles: [w.tile], getCash };
    }
    for (const w of wants) {
      const price = priceOf(tileById.get(w.tile)!);
      // Start at 1.5 times the price and rise 25 percent after each refusal, up to a ceiling that
      // grows with spare cash (a richer player values cash less), never more than half the spare.
      const wealth = 1 + Math.min(2, Math.max(0, spare) / (20 * price));
      const ceiling = Math.min(roundTen(price * profile.trade.offerPremium * wealth), Math.floor(spare / 2));
      const last = memory.lastOffer[w.tile];
      const cash = Math.min(last === undefined ? roundTen(price * 1.5) : roundTen(last * 1.25), ceiling);
      if (cash > price) return { to: w.owner, giveTiles: [], giveCash: cash, getTiles: [w.tile], getCash: 0 };
    }
    if (profile.trade.consolidatePremium > 0) {
      for (const members of Object.values(rules.groupMembers)) {
        if (!members.some((id) => state.properties[id]?.owner === pl)) continue;
        for (const id of members) {
          const owner = state.properties[id]?.owner;
          if (owner === undefined || owner === pl || state.players[owner]!.bankrupt) continue;
          if (members.filter((m) => state.properties[m]?.owner === owner).length !== 1) continue;
          const price = priceOf(tileById.get(id)!);
          const cash = Math.min(roundTen(price * profile.trade.consolidatePremium), spare);
          if (cash > price) return { to: owner, giveTiles: [], giveCash: cash, getTiles: [id], getCash: 0 };
        }
      }
    }
    return null;
  }

  // Accept when the value gained beats the margin, after charging a premium for handing over a set.
  function answerTrade(state: GameState, pl: number, profile: AiProfile, o: TradeOffer, jitter: number): Action {
    const iAmTo = o.to === pl;
    const other = iAmTo ? o.from : o.to;
    const receive = iAmTo ? o.giveTiles : o.getTiles;
    const give = iAmTo ? o.getTiles : o.giveTiles;
    const cashIn = iAmTo ? o.giveCash : o.getCash;
    const cashOut = iAmTo ? o.getCash : o.giveCash;
    const giveValue = give.reduce((a, id) => a + tileValue(state, pl, id, profile), 0);
    const gain = cashIn - cashOut + receive.reduce((a, id) => a + tileValue(state, pl, id, profile), 0) - giveValue;
    // Premium for handing the other player a set, offset when the trade also completes one of mine.
    const ownerAfter = (x: string) => (give.includes(x) ? other : receive.includes(x) ? pl : state.properties[x]?.owner);
    const setsCompleted = (who: number, tilesMoved: string[]) => tilesMoved.reduce((a, id) => {
      const t = tileById.get(id)!;
      return t.type === 'property' && groupOf(t).every((m) => ownerAfter(m) === who) ? a + priceOf(t) : a;
    }, 0);
    const danger = Math.max(0, profile.trade.setPremium * (setsCompleted(other, give) - setsCompleted(pl, receive)));
    const r = reserve(state, pl, profile);
    const cashAfter = state.players[pl]!.cash + cashIn - cashOut;
    const accept = gain - danger > profile.trade.acceptMargin * Math.max(giveValue, 100) * (1 + jitter) && cashAfter >= 0.5 * r;
    return { type: accept ? 'ACCEPT_TRADE' : 'REJECT_TRADE', player: pl };
  }

  // Pay if possible; otherwise give up the least valuable asset first; bankruptcy last.
  function settleDebt(state: GameState, pl: number, profile: AiProfile, legal: Action[]): Action {
    const pay = legal.find((a) => a.type === 'PAY_DEBT');
    if (pay) return pay;
    const ownsSet = (t: Tile) => t.type === 'property' && groupOf(t).every((id) => state.properties[id]?.owner === pl);
    const value = (a: Action) => ('tileId' in a ? tileValue(state, pl, a.tileId, profile) : 0);
    const cheapest = (list: Action[]) => list.sort((x, y) => value(x) - value(y))[0];
    const mortgages = legal.filter((a) => a.type === 'MORTGAGE').map((a) => ({ a, t: tileById.get((a as { tileId: string }).tileId)! }));
    const lone = mortgages.filter(({ t }) => t.type === 'property' && !ownsSet(t)).map((x) => x.a);
    if (lone.length) return cheapest(lone)!;
    const utilityLike = mortgages.filter(({ t }) => t.type !== 'property').map((x) => x.a);
    if (utilityLike.length) return cheapest(utilityLike)!;
    const sells = legal.filter((a) => a.type === 'SELL_BUILDING');
    if (sells.length) return cheapest(sells)!;
    const setProps = mortgages.map((x) => x.a);
    if (setProps.length) return cheapest(setProps)!;
    return { type: 'DECLARE_BANKRUPTCY', player: pl };
  }

  return { decide, nextActor, landingFrequency };
}
