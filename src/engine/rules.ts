import type { Config, Group, Rules, Tile, TileType } from './types';

const TILE_TYPES: ReadonlySet<string> = new Set<TileType>(['corner', 'property', 'hub', 'utility', 'tax', 'lucky', 'dohs']);

// Tile as read from JSON, before its type field is checked.
export type RawTile = Omit<Tile, 'type'> & { type: string };

// Builds the rules object from the content data (data/tiles.json and data/config.json),
// checking the shape the engine relies on.
export function makeRules(tilesDoc: { tiles: RawTile[]; groups: Group[] }, config: Config): Rules {
  const tiles: Tile[] = [...tilesDoc.tiles]
    .sort((a, b) => a.pos - b.pos)
    .map((t) => {
      if (!TILE_TYPES.has(t.type)) throw new Error(`Tile ${t.id} has unknown type ${t.type}`);
      if (t.type === 'property' && (t.price === undefined || t.rent?.length !== config.building.maxHouses + 2 || !t.group)) {
        throw new Error(`Property ${t.id} needs a price, a group and ${config.building.maxHouses + 2} rent steps`);
      }
      return { ...t, type: t.type as TileType };
    });
  if (tiles.length !== config.board.tiles) throw new Error(`Expected ${config.board.tiles} tiles, got ${tiles.length}`);
  tiles.forEach((t, i) => {
    if (t.pos !== i) throw new Error(`Tile positions must run 0 to ${tiles.length - 1}`);
  });
  const groupMembers: Record<string, string[]> = {};
  for (const g of tilesDoc.groups) groupMembers[g.id] = tiles.filter((t) => t.group === g.id).map((t) => t.id);
  const jam = tiles.find((t) => t.type === 'corner' && t.corner === 'jam');
  if (!jam) throw new Error('Board has no Jam corner');
  return { tiles, groups: tilesDoc.groups, config, groupMembers, jamPos: jam.pos };
}
