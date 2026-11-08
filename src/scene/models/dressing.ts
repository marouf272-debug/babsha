// Tile dressing: one Dhaka anchor per tile (plan 3.7, style guide 7). S5 dresses the Dark Blue
// group only; other tiles stay greybox until S6.

import * as THREE from 'three';
import { at, building, nouka, rickshaw, scaled, sign, tree, water, type KitContext, type TileFrame } from './kit';

export type Dresser = (ctx: KitContext, f: TileFrame, signText: string) => THREE.Group;

// The scene goes between the text area (outer) and the house lane (inner edge). Returns the
// middle of that band and its depth, in the tile frame.
const inner = (f: TileFrame, textShare: number, lane: number) => {
  const depth = f.depth * (1 - textShare) - lane;
  return { mid: f.depth / 2 - lane - depth / 2, depth };
};

export function dressers(textShare: number, lane: number): Record<string, Dresser> {
  return {
    // Gulshan: a modern glass office tower beside Gulshan Lake, a nouka on the water.
    gulshan: (ctx, f, signText) => {
      const g = new THREE.Group();
      const { mid, depth } = inner(f, textShare, lane);
      const p = ctx.palette;
      g.add(water(ctx, f, 0.28, mid, 0.36, depth * 0.9));
      g.add(scaled(nouka(ctx, f, 0.28, mid - depth * 0.1), at(f, 0.28, mid - depth * 0.1), 1.4));
      g.add(building(ctx, f, -0.17, mid + depth * 0.08, 0.42, 0.42, 1.15, p['glass']!, p['rickBlue']!, 12));
      g.add(sign(ctx, f, -0.17, mid + depth * 0.08, 0.42, 0.42, 0.95, signText, p['rickBlue']!));
      g.add(tree(ctx, f, 0.3, mid + depth * 0.36, 0.9));
      g.add(tree(ctx, f, -0.38, mid - depth * 0.33, 0.8));
      return g;
    },
    // Baridhara: a quiet low white block by the lake, trees, a parked rickshaw.
    baridhara: (ctx, f, signText) => {
      const g = new THREE.Group();
      const { mid, depth } = inner(f, textShare, lane);
      const p = ctx.palette;
      g.add(water(ctx, f, 0, mid + depth * 0.38, 0.9, depth * 0.22));
      g.add(building(ctx, f, -0.12, mid - depth * 0.02, 0.5, 0.34, 0.62, p['concrete']!, p['tinRoof']!, 6));
      g.add(sign(ctx, f, -0.12, mid - depth * 0.02, 0.5, 0.34, 0.5, signText, p['boardGreenDark']!));
      g.add(scaled(rickshaw(ctx, f, 0.28, mid - depth * 0.08), at(f, 0.28, mid - depth * 0.08), 1.4));
      g.add(tree(ctx, f, 0.32, mid + depth * 0.2, 0.9));
      g.add(tree(ctx, f, -0.4, mid + depth * 0.2, 0.75));
      return g;
    },
  };
}
