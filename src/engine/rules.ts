import type { Card, CardEffect, Config, DeckId, Group, Rules, Tile, TileType } from './types';

const TILE_TYPES: ReadonlySet<string> = new Set<TileType>(['corner', 'property', 'hub', 'utility', 'tax', 'lucky', 'dohs']);
const EFFECT_TYPES: ReadonlySet<string> = new Set<CardEffect['type']>(['collect', 'pay', 'collectFromEach', 'payEach', 'moveTo', 'moveBy', 'goToJam', 'jamFreeCard', 'repairs']);

// Tile and card as read from JSON, before their type fields are checked.
export type RawTile = Omit<Tile, 'type'> & { type: string };
export interface RawCard {
  id: string;
  textKey: string;
  effect: { type: string; [k: string]: unknown };
}

// Builds the rules object from the content data (data/tiles.json, data/config.json, data/cards.json),
// checking the shape the engine relies on.
export function makeRules(
  tilesDoc: { tiles: RawTile[]; groups: Group[] },
  config: Config,
  cardsDoc: { decks: Record<DeckId, RawCard[]> },
): Rules {
  const tiles: Tile[] = [...tilesDoc.tiles]
    .sort((a, b) => a.pos - b.pos)
    .map((t) => {
      if (!TILE_TYPES.has(t.type)) throw new Error(`Tile ${t.id} has unknown type ${t.type}`);
      if (t.type === 'property' && (t.price === undefined || t.rent?.length !== config.building.maxHouses + 2 || !t.group || !t.houseCost || !t.hotelCost)) {
        throw new Error(`Property ${t.id} needs a price, house and hotel costs, a group and ${config.building.maxHouses + 2} rent steps`);
      }
      return { ...t, type: t.type as TileType };
    });
  if (tiles.length !== config.board.tiles) throw new Error(`Expected ${config.board.tiles} tiles, got ${tiles.length}`);
  tiles.forEach((t, i) => {
    if (t.pos !== i) throw new Error(`Tile positions must run 0 to ${tiles.length - 1}`);
  });
  const ids = new Set(tiles.map((t) => t.id));
  const groupMembers: Record<string, string[]> = {};
  for (const g of tilesDoc.groups) groupMembers[g.id] = tiles.filter((t) => t.group === g.id).map((t) => t.id);
  const jam = tiles.find((t) => t.type === 'corner' && t.corner === 'jam');
  if (!jam) throw new Error('Board has no Jam corner');

  const cards = {} as Record<DeckId, Card[]>;
  for (const deck of ['lucky', 'dohs'] as const) {
    const list = cardsDoc.decks[deck];
    if (!list || list.length === 0) throw new Error(`Deck ${deck} is missing or empty`);
    cards[deck] = list.map((c) => {
      if (!EFFECT_TYPES.has(c.effect.type)) throw new Error(`Card ${c.id} has unknown effect ${c.effect.type}`);
      if (c.effect.type === 'moveTo' && !ids.has(String(c.effect['tile']))) throw new Error(`Card ${c.id} moves to unknown tile`);
      return { id: c.id, textKey: c.textKey, effect: c.effect as unknown as CardEffect };
    });
  }
  return { tiles, groups: tilesDoc.groups, config, cards, groupMembers, jamPos: jam.pos };
}
