import { describe, expect, it } from 'vitest';
import tilesDoc from '../../data/tiles.json';

// Expected board from plan 3.9. This list is the spec; the data file must match it.
const EXPECTED: Array<[number, string, string]> = [
  [0, 'go', 'corner'], [1, 'puran_dhaka', 'brown'], [2, 'dohs_1', 'dohs'], [3, 'chawk_bazar', 'brown'],
  [4, 'super_tax', 'tax'], [5, 'kamalapur', 'hub'], [6, 'jatrabari', 'light_blue'], [7, 'lucky_1', 'lucky'],
  [8, 'motijheel', 'light_blue'], [9, 'basabo', 'light_blue'], [10, 'jam', 'corner'], [11, 'mirpur', 'pink'],
  [12, 'desco', 'utility'], [13, 'mohammadpur', 'pink'], [14, 'shyamoli', 'pink'], [15, 'sadarghat', 'hub'],
  [16, 'farmgate', 'orange'], [17, 'dohs_2', 'dohs'], [18, 'karwan_bazar', 'orange'], [19, 'tejgaon', 'orange'],
  [20, 'cha_adda', 'corner'], [21, 'tsc', 'red'], [22, 'lucky_2', 'lucky'], [23, 'paltan', 'red'],
  [24, 'shahbag', 'red'], [25, 'gabtoli', 'hub'], [26, 'mohakhali', 'yellow'], [27, 'bashundhara', 'yellow'],
  [28, 'wasa', 'utility'], [29, 'lalmatia', 'yellow'], [30, 'go_to_jam', 'corner'], [31, 'dhanmondi', 'green'],
  [32, 'banani', 'green'], [33, 'dohs_3', 'dohs'], [34, 'uttara', 'green'], [35, 'airport', 'hub'],
  [36, 'lucky_3', 'lucky'], [37, 'gulshan', 'dark_blue'], [38, 'city_tax', 'tax'], [39, 'baridhara', 'dark_blue'],
];

type Tile = (typeof tilesDoc.tiles)[number] & { group?: string; price?: number; rent?: number[]; houseCost?: number; hotelCost?: number };
const tiles = tilesDoc.tiles as Tile[];
const props = tiles.filter((t) => t.type === 'property');

describe('tiles.json (FR-01 board, plan 2.3 and 3.9)', () => {
  it('FR-01: has 40 tiles in position order 0 to 39', () => {
    expect(tiles).toHaveLength(40);
    tiles.forEach((t, i) => expect(t.pos).toBe(i));
  });

  it('FR-01: matches the plan 3.9 board, tile by tile', () => {
    for (const [pos, id, kind] of EXPECTED) {
      const t = tiles[pos]!;
      expect(t.id, `pos ${pos}`).toBe(id);
      if (t.type === 'property') expect(t.group, `pos ${pos}`).toBe(kind);
      else expect(t.type, `pos ${pos}`).toBe(kind);
    }
  });

  it('FR-01: corners sit at 0, 10, 20 and 30 with 9 tiles between them', () => {
    expect(tiles.filter((t) => t.type === 'corner').map((t) => t.pos)).toEqual([0, 10, 20, 30]);
  });

  it('plan 2.3 tile inventory: 22 properties, 4 hubs, 2 utilities, 2 taxes, 3 Lucky, 3 DOHS, 4 corners', () => {
    const count = (type: string) => tiles.filter((t) => t.type === type).length;
    expect(count('property')).toBe(22);
    expect(count('hub')).toBe(4);
    expect(count('utility')).toBe(2);
    expect(count('tax')).toBe(2);
    expect(count('lucky')).toBe(3);
    expect(count('dohs')).toBe(3);
    expect(count('corner')).toBe(4);
  });

  it('plan 3.9: groups hold 2, 3, 3, 3, 3, 3, 3 and 2 properties in board order', () => {
    const sizes = tilesDoc.groups.map((g) => props.filter((p) => p.group === g.id).length);
    expect(sizes).toEqual([2, 3, 3, 3, 3, 3, 3, 2]);
  });

  it('FR-03, FR-05: every property has a price, house cost, hotel cost and a 6-step rising rent table', () => {
    for (const p of props) {
      expect(p.price, p.id).toBeGreaterThan(0);
      expect(p.houseCost, p.id).toBeGreaterThan(0);
      expect(p.hotelCost, p.id).toBeGreaterThan(0);
      expect(p.rent, p.id).toHaveLength(6);
      const r = p.rent!;
      for (let i = 1; i < r.length; i++) expect(r[i]!, `${p.id} step ${i}`).toBeGreaterThan(r[i - 1]!);
    }
  });

  it('proposal: the most expensive property costs 4,000 Taka and prices never fall along the board', () => {
    const prices = props.map((p) => p.price!);
    expect(Math.max(...prices)).toBe(4000);
    for (let i = 1; i < prices.length; i++) expect(prices[i]!).toBeGreaterThanOrEqual(prices[i - 1]!);
  });

  it('proposal numbers are marked as proposals, not final', () => {
    expect(tilesDoc.status).toMatch(/^PROPOSAL/);
  });
});
