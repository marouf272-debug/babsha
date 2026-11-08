// Tile dressing (S6): one Dhaka anchor on every tile (plan 3.7, style guide 7). Anchors follow
// the plan 3.9 art hooks. No domes or minarets, no sports, religion or politics (plan 3.8).

import * as THREE from 'three';
import type { Scenery, TileFrame } from './scenery';
import {
  at, box, building, bus, cardStack, cng, coins, controlTower, cyl, deer, factory, flowerStall, flyover, footbridge,
  gableHouse, gate, kite, launch, marketShed, metro, nouka, palm, plane, pole, rickshaw, road, shapla, sign,
  teaStall, trafficLight, train, tree, truck, water, waterTower,
} from './kit';

export type Dresser = (S: Scenery, f: TileFrame, signText: string) => void;

// The scene band: between the text area (outer side) and the house lane on properties.
// Returns the middle of the band (b) and its depth, in the tile frame.
function band(f: TileFrame, textShare: number, lane: number) {
  const depth = f.depth * (1 - textShare) - lane;
  return { mid: f.depth / 2 - lane - depth / 2, depth };
}

export function dressers(textShare: number, lane: number): Record<string, Dresser> {
  const P = (f: TileFrame) => band(f, textShare, lane); // property tiles keep a house lane
  const N = (f: TileFrame) => band(f, textShare, 0); // other tiles use the full depth

  const dohs = (shift: number): Dresser => (S, f) => {
    const { mid } = N(f);
    cardStack(S, f, -0.18 + shift, mid, 'rickTeal', 1.1);
    gate(S, f, 0.24 - shift, mid + 0.05, 0.28);
    tree(S, f, 0.28 - shift, mid + 0.3, 0.8);
  };
  const lucky = (color: string): Dresser => (S, f) => {
    const { mid } = N(f);
    cardStack(S, f, -0.12, mid, 'rickPink', 1.1);
    kite(S, f, 0.22, mid + 0.1, 0.7, color, 1.3);
  };

  return {
    // ---- bottom row ----
    go: (S, f, t) => {
      const { mid } = N(f);
      gate(S, f, -0.1, mid, 0.9, 0.36);
      sign(S, f, -0.1, mid, 0.96, 0.07, 0.385, t, 'boardGreenDark');
      rickshaw(S, f, 0.35, mid - 0.2, 1.4);
      palm(S, f, -0.6, mid + 0.28, 1.1);
    },
    puran_dhaka: (S, f, t) => {
      const { mid } = P(f);
      gableHouse(S, f, -0.2, mid, 0.34, 0.3, 0.34, 'terracotta', 'rickRed');
      gableHouse(S, f, 0.2, mid + 0.04, 0.3, 0.26, 0.44, 'concrete', 'terracotta');
      sign(S, f, -0.2, mid, 0.34, 0.3, 0.2, t, 'rickBlue');
      kite(S, f, 0.12, mid - 0.12, 0.85, 'rickPink', 1.3);
      kite(S, f, -0.32, mid + 0.12, 0.95, 'rickYellow', 1.2);
    },
    dohs_1: dohs(0),
    chawk_bazar: (S, f, t) => {
      const { mid } = P(f);
      building(S, f, -0.18, mid, 0.36, 0.3, 0.42, 'terracotta', 'concreteShade');
      for (const y of [0.18, 0.32]) box(S, f, -0.18, mid - 0.17, 0.3, 0.05, 0.015, 'rickTeal', y);
      box(S, f, 0.22, mid - 0.06, 0.3, 0.12, 0.02, 'rickRed', 0.2);
      box(S, f, 0.22, mid + 0.04, 0.28, 0.2, 0.2, 'concrete');
      sign(S, f, 0.22, mid + 0.04, 0.28, 0.2, 0.13, t, 'rickRed');
    },
    super_tax: (S, f, t) => {
      const { mid } = N(f);
      building(S, f, -0.15, mid + 0.06, 0.4, 0.3, 0.36, 'concrete', 'boardGreenDark');
      sign(S, f, -0.15, mid + 0.06, 0.4, 0.3, 0.3, t, 'boardGreenDark');
      coins(S, f, 0.27, mid - 0.12, 1.2);
    },
    kamalapur: (S, f, t) => {
      const { mid } = N(f);
      // The station's row of umbrella-shaped shell roofs on columns.
      for (const a of [-0.3, 0, 0.3]) {
        box(S, f, a, mid + 0.12, 0.04, 0.04, 0.26, 'concrete');
        S.solid(new THREE.ConeGeometry(0.17, 0.08, 4), 'concrete', at(f, a, mid + 0.12, 0.3), new THREE.Euler(Math.PI, Math.PI / 4, 0));
      }
      sign(S, f, 0, mid + 0.12, 0.9, 0.04, 0.4, t, 'boardGreenDark');
      train(S, f, 0, mid - 0.18, 3, 1, '#2E9E4F');
    },
    jatrabari: (S, f) => {
      const { mid } = P(f);
      flyover(S, f, 0, mid + 0.06, 0.9, 0.3);
      cng(S, f, -0.22, mid - 0.16, 1.2);
      rickshaw(S, f, 0.22, mid - 0.16, 1.1);
    },
    lucky_1: lucky('rickYellow'),
    motijheel: (S, f, t) => {
      const { mid } = P(f);
      building(S, f, -0.24, mid + 0.06, 0.32, 0.3, 0.95, 'concrete', 'rickBlue');
      sign(S, f, -0.24, mid + 0.06, 0.32, 0.3, 0.8, t, 'rickBlue');
      shapla(S, f, 0.22, mid - 0.02, 1.15);
    },
    basabo: (S, f, t) => {
      const { mid } = P(f);
      building(S, f, -0.15, mid + 0.04, 0.4, 0.3, 0.55, 'concrete', 'tinRoof');
      cyl(S, f, -0.05, mid + 0.04, 0.05, 0.08, 'rickTeal', 0.62, 8);
      sign(S, f, -0.15, mid + 0.04, 0.4, 0.3, 0.45, t, 'rickTeal');
      rickshaw(S, f, 0.3, mid - 0.1, 1.3);
    },
    // ---- left column ----
    jam: (S, f, t) => {
      const { mid } = N(f);
      // A traffic jam, kept clear of the spot where jailed tokens stand.
      bus(S, f, -0.42, mid + 0.18, 1.1, 'rickRed', true);
      bus(S, f, -0.18, mid + 0.2, 1, 'rickBlue', true);
      cng(S, f, -0.4, mid - 0.18, 1.2);
      rickshaw(S, f, -0.1, mid - 0.2, 1.2);
      trafficLight(S, f, 0.62, mid + 0.36, 0.42);
      sign(S, f, 0.62, mid + 0.36, 0.06, 0.05, 0.62, t, 'rickRed');
    },
    mirpur: (S, f, t) => {
      const { mid } = P(f);
      deer(S, f, 0.05, mid - 0.04, 1.4);
      tree(S, f, -0.3, mid + 0.12, 1);
      tree(S, f, 0.34, mid + 0.14, 0.9);
      gate(S, f, -0.28, mid - 0.18, 0.28, 0.26);
      sign(S, f, -0.28, mid - 0.18, 0.34, 0.06, 0.285, t, 'leafDark');
    },
    desco: (S, f, t) => {
      const { mid } = N(f);
      pole(S, f, -0.1, mid, 0.72);
      box(S, f, 0.25, mid + 0.1, 0.22, 0.2, 0.18, 'tinRoof');
      sign(S, f, 0.25, mid + 0.1, 0.22, 0.2, 0.12, t, 'rickYellow');
    },
    mohammadpur: (S, f, t) => {
      const { mid } = P(f);
      building(S, f, -0.17, mid + 0.04, 0.34, 0.3, 0.5, 'concrete', 'rickRed');
      sign(S, f, -0.17, mid + 0.04, 0.34, 0.3, 0.42, t, 'rickRed');
      cng(S, f, 0.25, mid - 0.06, 1.3);
    },
    shyamoli: (S, f, t) => {
      const { mid } = P(f);
      // A cinema hall with a big painted banner.
      box(S, f, -0.08, mid + 0.04, 0.58, 0.3, 0.38, 'rickYellow');
      box(S, f, -0.08, mid - 0.12, 0.5, 0.02, 0.16, 'rickPink', 0.2);
      sign(S, f, -0.08, mid + 0.04, 0.58, 0.3, 0.3, t, 'rickBlue');
      rickshaw(S, f, 0.34, mid - 0.14, 1.1);
    },
    sadarghat: (S, f, t) => {
      const { mid } = N(f);
      water(S, f, 0, mid, 0.98, 0.86);
      launch(S, f, -0.05, mid + 0.1, 1.2);
      nouka(S, f, 0.25, mid - 0.25, 1.3);
      box(S, f, -0.32, mid - 0.3, 0.3, 0.14, 0.12, 'concrete');
      sign(S, f, -0.32, mid - 0.3, 0.3, 0.14, 0.07, t, 'rickBlue');
    },
    farmgate: (S, f, t) => {
      const { mid } = P(f);
      road(S, f, 0, mid - 0.02, 0.98, 0.22);
      footbridge(S, f, 0, mid + 0.1, 0.76, 0.3);
      bus(S, f, 0.05, mid - 0.04, 1, 'rickTeal');
      sign(S, f, 0, mid + 0.1, 0.76, 0.11, 0.33, t, 'rickTeal');
    },
    dohs_2: dohs(0.05),
    karwan_bazar: (S, f, t) => {
      const { mid } = P(f);
      marketShed(S, f, -0.1, mid + 0.04, 0.56, 0.32);
      sign(S, f, -0.1, mid + 0.04, 0.6, 0.36, 0.26, t, 'rickRed');
      truck(S, f, 0.3, mid - 0.16, 1);
    },
    tejgaon: (S, f, t) => {
      const { mid } = P(f);
      factory(S, f, -0.05, mid + 0.04, 0.6, 0.3);
      sign(S, f, -0.05, mid + 0.04, 0.6, 0.3, 0.2, t, 'ink');
      truck(S, f, 0.32, mid - 0.16, 0.8);
    },
    // ---- top row ----
    cha_adda: (S, f, t) => {
      const { mid } = N(f);
      teaStall(S, f, -0.1, mid + 0.05, 1.6);
      sign(S, f, -0.1, mid + 0.05, 0.36 * 1.6, 0.26 * 1.6, 0.48, t, 'rickRed');
      palm(S, f, 0.5, mid + 0.3, 1.1);
      tree(S, f, -0.6, mid - 0.25, 1);
    },
    tsc: (S, f, t) => {
      const { mid } = P(f);
      teaStall(S, f, -0.18, mid, 1.1);
      sign(S, f, -0.18, mid, 0.4, 0.28, 0.33, t, 'rickRed');
      tree(S, f, 0.25, mid + 0.12, 1.1);
      rickshaw(S, f, 0.2, mid - 0.16, 1.1);
    },
    lucky_2: lucky('rickPink'),
    paltan: (S, f, t) => {
      const { mid } = P(f);
      building(S, f, -0.2, mid + 0.04, 0.3, 0.3, 0.7, 'concrete', 'rickYellow');
      building(S, f, 0.18, mid + 0.06, 0.28, 0.26, 0.48, 'terracotta', 'concreteShade');
      box(S, f, 0.18, mid - 0.08, 0.26, 0.02, 0.12, 'rickPink', 0.3);
      sign(S, f, -0.2, mid + 0.04, 0.3, 0.3, 0.6, t, 'rickRed');
    },
    shahbag: (S, f, t) => {
      const { mid } = P(f);
      building(S, f, -0.12, mid + 0.08, 0.6, 0.24, 0.3, 'terracotta', 'concreteShade');
      sign(S, f, -0.12, mid + 0.08, 0.6, 0.24, 0.24, t, 'leafDark');
      flowerStall(S, f, 0.18, mid - 0.16, 1.1);
    },
    gabtoli: (S, f, t) => {
      const { mid } = N(f);
      bus(S, f, 0, mid + 0.25, 1.4, 'rickRed');
      bus(S, f, 0, mid, 1.4, 'rickTeal');
      bus(S, f, 0, mid - 0.25, 1.4, 'rickYellow');
      box(S, f, -0.4, mid, 0.04, 0.04, 0.3, 'concrete');
      sign(S, f, -0.4, mid, 0.18, 0.04, 0.32, t, 'boardGreenDark');
    },
    mohakhali: (S, f) => {
      const { mid } = P(f);
      flyover(S, f, 0, mid + 0.06, 0.9, 0.3);
      bus(S, f, 0.05, mid - 0.17, 1, 'rickBlue');
    },
    bashundhara: (S, f, t) => {
      const { mid } = P(f);
      building(S, f, 0, mid + 0.04, 0.78, 0.34, 0.6, 'glass', 'rickPink');
      sign(S, f, 0, mid + 0.04, 0.78, 0.34, 0.5, t, 'rickPink');
    },
    wasa: (S, f, t) => {
      const { mid } = N(f);
      waterTower(S, f, -0.12, mid + 0.04, 0.45);
      box(S, f, 0.28, mid - 0.06, 0.2, 0.18, 0.16, 'concrete');
      sign(S, f, 0.28, mid - 0.06, 0.2, 0.18, 0.1, t, 'water');
      box(S, f, 0.08, mid - 0.06, 0.2, 0.04, 0.04, 'waterLight', 0.04);
    },
    lalmatia: (S, f, t) => {
      const { mid } = P(f);
      gableHouse(S, f, -0.15, mid + 0.04, 0.4, 0.3, 0.34, '#FFFFFF', 'leafDark');
      sign(S, f, -0.15, mid + 0.04, 0.4, 0.3, 0.2, t, 'leafDark');
      tree(S, f, 0.28, mid + 0.1, 1.1);
      tree(S, f, 0.3, mid - 0.14, 0.8);
    },
    // ---- right column ----
    go_to_jam: (S, f, t) => {
      const { mid } = N(f);
      // A traffic police box beside a red light, traffic stopped toward Jam.
      box(S, f, -0.4, mid + 0.2, 0.2, 0.2, 0.28, '#FFFFFF');
      box(S, f, -0.4, mid + 0.2, 0.26, 0.26, 0.03, 'rickBlue', 0.28);
      sign(S, f, -0.4, mid + 0.2, 0.2, 0.2, 0.2, t, 'rickRed');
      trafficLight(S, f, -0.1, mid + 0.25, 0.45);
      bus(S, f, 0.3, mid - 0.12, 1.2, 'rickTeal', true);
      cng(S, f, 0.55, mid + 0.25, 1.2);
    },
    dhanmondi: (S, f, t) => {
      const { mid } = P(f);
      water(S, f, 0.18, mid, 0.5, 0.5);
      nouka(S, f, 0.18, mid, 1.2);
      building(S, f, -0.27, mid + 0.04, 0.26, 0.3, 0.55, 'concrete', 'leafDark');
      sign(S, f, -0.27, mid + 0.04, 0.26, 0.3, 0.45, t, 'leafDark');
      tree(S, f, 0.4, mid + 0.22, 0.8);
    },
    banani: (S, f, t) => {
      const { mid } = P(f);
      building(S, f, -0.18, mid + 0.04, 0.3, 0.3, 0.85, 'glass', 'rickTeal');
      building(S, f, 0.18, mid + 0.06, 0.26, 0.26, 0.6, 'concrete', 'rickTeal');
      sign(S, f, -0.18, mid + 0.04, 0.3, 0.3, 0.7, t, 'rickTeal');
      tree(S, f, 0.38, mid - 0.16, 0.8);
    },
    dohs_3: dohs(-0.05),
    uttara: (S, f, t) => {
      const { mid } = P(f);
      metro(S, f, 0, mid, 0.96, 0.36);
      sign(S, f, 0, mid, 0.96, 0.18, 0.31, t, '#2E9E4F');
    },
    airport: (S, f, t) => {
      const { mid } = N(f);
      road(S, f, 0, mid - 0.05, 0.96, 0.3);
      plane(S, f, 0.05, mid - 0.05, 1.15);
      controlTower(S, f, -0.36, mid + 0.3, 0.6);
      sign(S, f, -0.36, mid + 0.3, 0.26, 0.26, 0.66, t, 'rickBlue');
    },
    lucky_3: lucky('rickTeal'),
    gulshan: (S, f, t) => {
      const { mid, depth } = P(f);
      water(S, f, 0.28, mid, 0.36, depth * 0.9);
      nouka(S, f, 0.28, mid - depth * 0.1, 1.4);
      building(S, f, -0.17, mid + depth * 0.08, 0.42, 0.42, 1.15, 'glass', 'rickBlue');
      sign(S, f, -0.17, mid + depth * 0.08, 0.42, 0.42, 0.95, t, 'rickBlue');
      tree(S, f, 0.3, mid + depth * 0.36, 0.9);
      tree(S, f, -0.38, mid - depth * 0.33, 0.8);
    },
    city_tax: (S, f, t) => {
      const { mid } = N(f);
      building(S, f, -0.15, mid + 0.06, 0.42, 0.3, 0.42, 'concrete', 'rickBlue');
      sign(S, f, -0.15, mid + 0.06, 0.42, 0.3, 0.34, t, 'rickBlue');
      coins(S, f, 0.27, mid - 0.12, 1.2);
    },
    baridhara: (S, f, t) => {
      const { mid, depth } = P(f);
      water(S, f, 0, mid + depth * 0.38, 0.9, depth * 0.22);
      building(S, f, -0.12, mid - depth * 0.02, 0.5, 0.34, 0.62, 'concrete', 'tinRoof');
      sign(S, f, -0.12, mid - depth * 0.02, 0.5, 0.34, 0.5, t, 'boardGreenDark');
      rickshaw(S, f, 0.3, mid - depth * 0.08, 1.4);
      tree(S, f, 0.32, mid + depth * 0.2, 0.9);
      tree(S, f, -0.4, mid + depth * 0.2, 0.75);
    },
  };
}
