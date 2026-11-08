// Turns engine events into one line of text for the event log, in the current language.

import type { Card, GameEvent, GameState, Rules, TradeOffer } from '../engine';
import { money, num, t } from '../i18n';

export const TOKENS = ['rickshaw', 'cng', 'ilish', 'kite', 'tea_cup', 'bus'] as const;

// D-66: a player's name is their token's name in the current language.
export const playerName = (player: number) => t(`token.${TOKENS[player % TOKENS.length]}`);

export function tileName(rules: Rules, tileId: string): string {
  const tile = rules.tiles.find((x) => x.id === tileId);
  return tile ? t(tile.nameKey) : tileId;
}

// Card text with its numbers filled in from the card's effect and the config.
export function cardText(rules: Rules, card: Card): string {
  const fx = card.effect as Record<string, unknown>;
  const params: Record<string, string> = { salary: money(rules.config.goSalary) };
  if (typeof fx['amount'] === 'number') params['amount'] = money(fx['amount']);
  if (typeof fx['perHouse'] === 'number') params['perHouse'] = money(fx['perHouse']);
  if (typeof fx['perHotel'] === 'number') params['perHotel'] = money(fx['perHotel']);
  if (typeof fx['steps'] === 'number') params['steps'] = num(Math.abs(fx['steps']));
  if (typeof fx['tile'] === 'string') params['tile'] = tileName(rules, fx['tile']);
  return t(card.textKey, params);
}

export function findCard(rules: Rules, deck: 'lucky' | 'dohs', id: string): Card | undefined {
  return rules.cards[deck].find((c) => c.id === id);
}

// What one side of a trade hands over, as a short list ("Motijheel, Tk 500"), or "Nothing".
export function tradeSide(rules: Rules, ids: string[], cash: number): string {
  const items = [...ids.map((id) => tileName(rules, id)), ...(cash > 0 ? [money(cash)] : [])];
  return items.length ? items.join(', ') : t('trade.nothing');
}

// D-89: the full log shows what changed, so a trade lists both sides and a card shows its text.
export function describeLines(e: GameEvent, state: GameState, rules: Rules): string[] {
  if (e.type === 'cardDrawn') {
    const card = findCard(rules, e.deck, e.cardId);
    if (card) return [t('ev.cardDrawnText', { name: playerName(e.player), deck: t(`deck.${e.deck}`), text: cardText(rules, card) })];
  }
  const line = describeEvent(e, state, rules);
  if (e.type === 'tradeAccepted') return [line!, tradeDetail(rules, e.offer)];
  return line ? [line] : [];
}

function tradeDetail(rules: Rules, o: TradeOffer): string {
  return t('ev.tradeDetail', { name: playerName(o.from), give: tradeSide(rules, o.giveTiles, o.giveCash), other: playerName(o.to), get: tradeSide(rules, o.getTiles, o.getCash) });
}

// Returns the log line for an event, or null for events the log does not show.
export function describeEvent(e: GameEvent, state: GameState, rules: Rules): string | null {
  const tile = (id: string) => tileName(rules, id);
  switch (e.type) {
    case 'diceRolled':
      return t(e.doubles ? 'ev.doubles' : 'ev.diceRolled', { name: playerName(e.player), a: num(e.dice[0]!), b: num(e.dice[1]!) });
    case 'salary':
      return t('ev.salary', { name: playerName(e.player), amount: money(e.amount) });
    case 'purchased':
      return t('ev.purchased', { name: playerName(e.player), tile: tile(e.tileId), amount: money(e.price) });
    case 'declined':
      return t('ev.declined', { name: playerName(e.player), tile: tile(e.tileId) });
    case 'auctionWon':
      return t('ev.auctionWon', { name: playerName(e.player), tile: tile(e.tileId), amount: money(e.price) });
    case 'auctionUnsold':
      return t('ev.auctionUnsold', { tile: tile(e.tileId) });
    case 'rentPaid':
      return t('ev.rentPaid', { name: playerName(e.from), other: playerName(e.to), amount: money(e.amount) });
    case 'rentWaived':
      return t('ev.rentWaived', { tile: tile(e.tileId) });
    case 'taxPaid':
      return t('ev.taxPaid', { name: playerName(e.player), tile: tile(e.tileId), amount: money(e.amount) });
    case 'cardDrawn':
      return t('ev.cardDrawn', { name: playerName(e.player), deck: t(`deck.${e.deck}`) });
    case 'sentToJam':
      return t('ev.sentToJam', { name: playerName(e.player) });
    case 'leftJam':
      return t('ev.leftJam', { name: playerName(e.player) });
    case 'stayedInJam':
      return t('ev.stayedInJam', { name: playerName(e.player) });
    case 'jamFinePaid':
      return t('ev.jamFinePaid', { name: playerName(e.player), amount: money(e.amount) });
    case 'buildingBought':
      return t('ev.buildingBought', { name: playerName(e.player), tile: tile(e.tileId) });
    case 'buildingSold':
      return t('ev.buildingSold', { name: playerName(e.player), tile: tile(e.tileId) });
    case 'mortgaged':
      return t('ev.mortgaged', { name: playerName(e.player), tile: tile(e.tileId) });
    case 'redeemed':
      return t('ev.redeemed', { name: playerName(e.player), tile: tile(e.tileId) });
    case 'tradeProposed':
      return t('ev.tradeProposed', { name: playerName(e.offer.from), other: playerName(e.offer.to) });
    case 'tradeAccepted':
      return t('ev.tradeAccepted', { name: playerName(e.offer.from), other: playerName(e.offer.to) });
    case 'tradeRejected':
      return t('ev.tradeRejected', { name: playerName(e.offer.from), other: playerName(e.offer.to) });
    case 'debtCreated':
      return t('ev.debtCreated', { name: playerName(e.debt.debtor), amount: money(e.debt.amount) });
    case 'debtPaid':
      return t('ev.debtPaid', { name: playerName(e.debt.debtor), amount: money(e.debt.amount) });
    case 'bankrupt':
      return t('ev.bankrupt', { name: playerName(e.player) });
    case 'extraRoll':
      return t('ev.extraRoll', { name: playerName(e.player) });
    case 'turnPassed':
      return t('ev.turnPassed', { name: playerName(e.to) });
    case 'gameOver':
      return t('ev.gameOver', { name: playerName(e.winner) });
    default:
      void state;
      return null;
  }
}
