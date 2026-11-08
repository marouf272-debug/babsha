// Low-poly parts kit (style guide 4, 5, 7). Every part is added to a Scenery builder and merged.
// Positions are in a tile frame: a runs across the tile, b points to the board centre.

import * as THREE from 'three';
import type { Scenery, TileFrame } from './scenery';

export type { KitContext, TileFrame } from './scenery';

const X = (f: TileFrame) => Math.abs(f.along.x) > 0.5; // tile frame `along` runs along world x

export function at(f: TileFrame, a: number, b: number, y = 0): THREE.Vector3 {
  return new THREE.Vector3(f.center.x + f.along.x * a + f.inward.x * b, f.center.y + y, f.center.z + f.along.y * a + f.inward.y * b);
}

// World size for a box sized in the frame (wa across, db toward the centre).
const size = (f: TileFrame, wa: number, db: number): [number, number] => (X(f) ? [wa, db] : [db, wa]);
// Rotation that lays a part's local x axis along the frame's `along` (or `inward` when cross).
const yaw = (f: TileFrame, cross = false) => new THREE.Euler(0, (X(f) ? 0 : Math.PI / 2) + (cross ? Math.PI / 2 : 0), 0);

export function box(S: Scenery, f: TileFrame, a: number, b: number, wa: number, db: number, h: number, color: string, y = 0): void {
  const [sx, sz] = size(f, wa, db);
  S.solid(new THREE.BoxGeometry(sx, h, sz), color, at(f, a, b, y + h / 2));
}

export function cyl(S: Scenery, f: TileFrame, a: number, b: number, r: number, h: number, color: string, y = 0, seg = 8, rTop = r): void {
  S.solid(new THREE.CylinderGeometry(rTop, r, h, seg), color, at(f, a, b, y + h / 2));
}

export function shadow(S: Scenery, f: TileFrame, a: number, b: number, wa: number, db: number): void {
  const [sx, sz] = size(f, wa, db);
  S.shadow(at(f, a, b), sx, sz);
}

// Building with a plinth, window texture on its walls, a flat roof in `roof`.
export function building(S: Scenery, f: TileFrame, a: number, b: number, wa: number, db: number, h: number, wall: string, roof: string): void {
  box(S, f, a, b, wa + 0.07, db + 0.07, 0.04, 'concreteShade');
  const [sx, sz] = size(f, wa, db);
  S.windowed(new THREE.BoxGeometry(sx, h, sz), wall, at(f, a, b, 0.04 + h / 2), Math.max(1, Math.round(wa * 5)), Math.max(1, Math.round(h * 6)));
  box(S, f, a, b, wa + 0.02, db + 0.02, 0.03, roof, 0.04 + h);
  shadow(S, f, a, b, wa + 0.12, db + 0.12);
}

// Small house with a pitched roof (old town, residential).
export function gableHouse(S: Scenery, f: TileFrame, a: number, b: number, wa: number, db: number, h: number, wall: string, roof: string): void {
  box(S, f, a, b, wa, db, h, wall);
  const [sx, sz] = size(f, wa, db);
  const r = new THREE.CylinderGeometry(0.5, 0.5, 1, 3);
  S.solid(r, roof, at(f, a, b, h + 0.06), new THREE.Euler(X(f) ? 0 : 0, X(f) ? 0 : Math.PI / 2, Math.PI / 2), new THREE.Vector3(0.14, sx > sz ? sx + 0.02 : sz + 0.02, (X(f) ? sz : sx) * 0.95));
  shadow(S, f, a, b, wa + 0.1, db + 0.1);
}

export function tree(S: Scenery, f: TileFrame, a: number, b: number, s = 1): void {
  cyl(S, f, a, b, 0.03 * s, 0.14 * s, 'terracotta', 0, 5, 0.025 * s);
  S.solid(new THREE.IcosahedronGeometry(0.13 * s, 0), 'leaf', at(f, a, b, 0.22 * s));
  shadow(S, f, a, b, 0.24 * s, 0.24 * s);
}


export function water(S: Scenery, f: TileFrame, a: number, b: number, wa: number, db: number): void {
  box(S, f, a, b, wa, db, 0.014, 'water', 0.002);
}

export function road(S: Scenery, f: TileFrame, a: number, b: number, wa: number, db: number): void {
  box(S, f, a, b, wa, db, 0.01, 'road', 0.002);
  const [la, lb] = X(f) === wa > db ? [wa * 0.9, 0.012] : [0.012, db * 0.9];
  box(S, f, a, b, wa > db ? la : 0.012, wa > db ? 0.012 : lb, 0.012, 'roadLine', 0.004);
}

function wheel(S: Scenery, f: TileFrame, a: number, b: number, r: number, cross: boolean): void {
  // Wheel axis points across the vehicle's direction of travel.
  const e = yaw(f, cross);
  S.solid(new THREE.CylinderGeometry(r, r, 0.02, 8), 'ink', at(f, a, b, r), new THREE.Euler(Math.PI / 2, e.y, 0, 'YXZ'));
}

// Cycle rickshaw, travelling across the tile: hood in rickshaw-art pink with a yellow trim.
export function rickshaw(S: Scenery, f: TileFrame, a: number, b: number, s = 1): void {
  wheel(S, f, a - 0.08 * s, b - 0.06 * s, 0.05 * s, false);
  wheel(S, f, a - 0.08 * s, b + 0.06 * s, 0.05 * s, false);
  wheel(S, f, a + 0.14 * s, b, 0.05 * s, false);
  box(S, f, a - 0.06 * s, b, 0.1 * s, 0.16 * s, 0.05 * s, 'rickBlue', 0.07 * s);
  box(S, f, a + 0.06 * s, b, 0.14 * s, 0.02 * s, 0.02 * s, 'ink', 0.08 * s);
  const hood = new THREE.CylinderGeometry(0.085 * s, 0.085 * s, 0.17 * s, 8, 1, false, 0, Math.PI);
  S.solid(hood, 'rickPink', at(f, a - 0.07 * s, b, 0.13 * s), new THREE.Euler(Math.PI / 2, yaw(f).y + Math.PI / 2, 0, 'YXZ'));
  box(S, f, a - 0.07 * s, b, 0.02 * s, 0.18 * s, 0.02 * s, 'rickYellow', 0.14 * s);
  shadow(S, f, a, b, 0.32 * s, 0.24 * s);
}

// CNG auto-rickshaw: green body, black canopy, three wheels.
export function cng(S: Scenery, f: TileFrame, a: number, b: number, s = 1): void {
  wheel(S, f, a - 0.06 * s, b - 0.06 * s, 0.035 * s, false);
  wheel(S, f, a - 0.06 * s, b + 0.06 * s, 0.035 * s, false);
  wheel(S, f, a + 0.08 * s, b, 0.035 * s, false);
  box(S, f, a, b, 0.22 * s, 0.14 * s, 0.09 * s, '#2E9E4F', 0.03 * s);
  box(S, f, a - 0.01 * s, b, 0.18 * s, 0.15 * s, 0.07 * s, 'ink', 0.12 * s);
  shadow(S, f, a, b, 0.3 * s, 0.22 * s);
}

// Bus with a rickshaw-art painted band.
export function bus(S: Scenery, f: TileFrame, a: number, b: number, s = 1, body = 'rickRed', cross = false, y = 0): void {
  const [la, lb] = cross ? [0.14, 0.42] : [0.42, 0.14];
  box(S, f, a, b, la * s, lb * s, 0.14 * s, body, y + 0.04 * s);
  box(S, f, a, b, (la + 0.004) * s, (lb + 0.004) * s, 0.035 * s, 'glass', y + 0.12 * s);
  box(S, f, a, b, (la + 0.006) * s, (lb + 0.006) * s, 0.018 * s, 'rickYellow', y + 0.07 * s);
  if (y === 0) shadow(S, f, a, b, (la + 0.1) * s, (lb + 0.1) * s);
}

export function truck(S: Scenery, f: TileFrame, a: number, b: number, s = 1): void {
  box(S, f, a + 0.1 * s, b, 0.1 * s, 0.14 * s, 0.12 * s, 'rickYellow', 0.03 * s);
  box(S, f, a - 0.05 * s, b, 0.22 * s, 0.15 * s, 0.13 * s, 'rickTeal', 0.03 * s);
  shadow(S, f, a, b, 0.4 * s, 0.24 * s);
}

// Nouka (country boat): slim hull, curved bamboo shade.
export function nouka(S: Scenery, f: TileFrame, a: number, b: number, s = 1): void {
  S.solid(new THREE.CylinderGeometry(0.05 * s, 0.02 * s, 0.38 * s, 6), 'terracotta', at(f, a, b, 0.035 * s), new THREE.Euler(0, yaw(f).y, Math.PI / 2, 'YXZ'));
  S.solid(new THREE.CylinderGeometry(0.05 * s, 0.05 * s, 0.13 * s, 6, 1, false, 0, Math.PI), 'rickYellow', at(f, a, b, 0.07 * s), new THREE.Euler(0, yaw(f).y, Math.PI / 2, 'YXZ'));
}



// Elevated Metro Rail viaduct with a white and green train (Uttara, Line 6).
export function metro(S: Scenery, f: TileFrame, a: number, b: number, len: number, h = 0.36): void {
  for (const pa of [-len / 2 + 0.06, len / 2 - 0.06]) box(S, f, a + pa, b, 0.06, 0.06, h, 'concrete');
  box(S, f, a, b, len, 0.18, 0.05, 'concreteShade', h);
  box(S, f, a, b, len * 0.8, 0.13, 0.1, '#FFFFFF', h + 0.05);
  box(S, f, a, b, len * 0.8 + 0.004, 0.134, 0.022, '#2E9E4F', h + 0.08);
  shadow(S, f, a, b, len + 0.1, 0.3);
}

// Flyover: pillars, a deck, and a bus on top (Jatrabari, Mohakhali).
export function flyover(S: Scenery, f: TileFrame, a: number, b: number, len: number, h = 0.3): void {
  for (const pa of [-len / 2 + 0.08, 0, len / 2 - 0.08]) box(S, f, a + pa, b, 0.05, 0.05, h, 'concrete');
  box(S, f, a, b, len, 0.2, 0.04, 'road', h);
  box(S, f, a, b, len, 0.012, 0.01, 'roadLine', h + 0.04);
  bus(S, f, a + 0.08, b, 0.8, 'rickRed', false, h + 0.04 - 0.032);
}

// Foot over-bridge with stairs at both ends (Farmgate).
export function footbridge(S: Scenery, f: TileFrame, a: number, b: number, len: number, h = 0.3): void {
  for (const pa of [-len / 2, len / 2]) box(S, f, a + pa, b, 0.1, 0.12, h, 'concreteShade');
  box(S, f, a, b, len, 0.1, 0.03, 'concrete', h);
  box(S, f, a, b, len, 0.11, 0.015, 'rickTeal', h + 0.03);
}





// Market shed with a tin roof and crates of produce (Karwan Bazar).
export function marketShed(S: Scenery, f: TileFrame, a: number, b: number, wa: number, db: number): void {
  for (const [da, dbb] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) box(S, f, a + da * (wa / 2 - 0.02), b + dbb * (db / 2 - 0.02), 0.025, 0.025, 0.22, 'concreteShade');
  box(S, f, a, b, wa + 0.06, db + 0.06, 0.025, 'tinRoof', 0.22);
  const crates = ['#2E9E4F', 'rickRed', 'rickYellow', '#EE7D2B', '#2E9E4F', 'rickPink'];
  crates.forEach((c, k) => box(S, f, a + ((k % 3) - 1) * wa * 0.28, b + (Math.floor(k / 3) - 0.5) * db * 0.4, wa * 0.22, db * 0.3, 0.07, c));
  shadow(S, f, a, b, wa + 0.1, db + 0.1);
}

// Factory with a saw-tooth roof and a chimney (Tejgaon).
export function factory(S: Scenery, f: TileFrame, a: number, b: number, wa: number, db: number): void {
  box(S, f, a, b, wa, db, 0.26, 'concrete');
  for (let k = 0; k < 3; k++) {
    const ka = a + (k - 1) * wa / 3;
    S.solid(new THREE.CylinderGeometry(0.5, 0.5, 1, 3), 'tinRoof', at(f, ka, b, 0.3), new THREE.Euler(0, yaw(f, true).y, Math.PI / 2, 'YXZ'), new THREE.Vector3(0.1, db, wa / 3.2));
  }
  cyl(S, f, a + wa / 2 - 0.06, b + db / 2 - 0.06, 0.04, 0.55, 'terracotta', 0, 8, 0.03);
  box(S, f, a + wa / 2 - 0.06, b + db / 2 - 0.06, 0.09, 0.09, 0.04, 'rickRed', 0.5);
  shadow(S, f, a, b, wa + 0.1, db + 0.1);
}

// Flower stall: low tables heaped with flowers (Shahbag flower market).
export function flowerStall(S: Scenery, f: TileFrame, a: number, b: number, s = 1): void {
  box(S, f, a, b, 0.3 * s, 0.14 * s, 0.07 * s, 'terracotta');
  const colors = ['rickPink', 'rickYellow', 'rickRed', '#FFFFFF', '#EE7D2B'];
  for (let k = 0; k < 10; k++) {
    S.solid(new THREE.IcosahedronGeometry(0.03 * s, 0), colors[k % colors.length]!, at(f, a + ((k % 5) - 2) * 0.06 * s, b + (Math.floor(k / 5) - 0.5) * 0.06 * s, 0.1 * s));
  }
  shadow(S, f, a, b, 0.4 * s, 0.24 * s);
}

// Shapla (water lily) fountain sculpture on a round base (Motijheel's Shapla Chattar).
export function shapla(S: Scenery, f: TileFrame, a: number, b: number, s = 1): void {
  cyl(S, f, a, b, 0.2 * s, 0.04 * s, 'concrete', 0, 12);
  cyl(S, f, a, b, 0.17 * s, 0.02 * s, 'water', 0.04 * s, 12);
  cyl(S, f, a, b, 0.03 * s, 0.22 * s, 'concrete', 0.04 * s, 6);
  for (let k = 0; k < 6; k++) {
    const ang = (k / 6) * Math.PI * 2;
    S.solid(new THREE.ConeGeometry(0.035 * s, 0.14 * s, 4), k % 2 ? '#FFFFFF' : 'rickPink', at(f, a + Math.cos(ang) * 0.06 * s, b + Math.sin(ang) * 0.06 * s, 0.32 * s), new THREE.Euler(Math.sin(ang) * 0.6, 0, -Math.cos(ang) * 0.6));
  }
  shadow(S, f, a, b, 0.46 * s, 0.46 * s);
}

// Spotted deer (zoo).
export function deer(S: Scenery, f: TileFrame, a: number, b: number, s = 1): void {
  box(S, f, a, b, 0.18 * s, 0.07 * s, 0.07 * s, '#C38A4E', 0.12 * s);
  for (const [da, dbb] of [[-0.07, -0.025], [0.07, -0.025], [-0.07, 0.025], [0.07, 0.025]] as const) box(S, f, a + da * s, b + dbb * s, 0.02 * s, 0.02 * s, 0.12 * s, '#8A5232');
  box(S, f, a + 0.09 * s, b, 0.04 * s, 0.04 * s, 0.1 * s, '#C38A4E', 0.17 * s);
  box(S, f, a + 0.12 * s, b, 0.07 * s, 0.045 * s, 0.045 * s, '#C38A4E', 0.25 * s);
  shadow(S, f, a, b, 0.26 * s, 0.14 * s);
}

// Roadside tea stall: tin roof on posts, counter, kettle, bench (Cha Adda, TSC).
export function teaStall(S: Scenery, f: TileFrame, a: number, b: number, s = 1): void {
  box(S, f, a, b, 0.3 * s, 0.18 * s, 0.1 * s, 'terracotta');
  for (const da of [-0.14, 0.14]) box(S, f, a + da * s, b - 0.08 * s, 0.02 * s, 0.02 * s, 0.26 * s, 'ink');
  box(S, f, a, b - 0.02 * s, 0.36 * s, 0.26 * s, 0.02 * s, 'tinRoof', 0.26 * s);
  cyl(S, f, a + 0.07 * s, b, 0.035 * s, 0.05 * s, 'concreteShade', 0.1 * s, 8);
  box(S, f, a, b - 0.2 * s, 0.3 * s, 0.05 * s, 0.05 * s, 'rickTeal');
  shadow(S, f, a, b - 0.05 * s, 0.46 * s, 0.4 * s);
}

// A flying kite on a thin string, in rickshaw-art colors (Puran Dhaka, Lucky).
export function kite(S: Scenery, f: TileFrame, a: number, b: number, y: number, color: string, s = 1): void {
  S.solid(new THREE.OctahedronGeometry(0.08 * s, 0), color, at(f, a, b, y), new THREE.Euler(0, 0.6, 0), new THREE.Vector3(1, 1.2, 0.15));
  box(S, f, a, b, 0.006, 0.006, y * 0.9, 'ink', 0.02);
}




// Gate with two pillars and a beam (DOHS housing society).
export function gate(S: Scenery, f: TileFrame, a: number, b: number, wa: number, h = 0.32): void {
  for (const da of [-wa / 2, wa / 2]) box(S, f, a + da, b, 0.06, 0.06, h, 'concrete');
  box(S, f, a, b, wa + 0.08, 0.07, 0.05, 'boardGreenDark', h);
}

// A Bangla sign on the building face that looks most toward the camera.
export function sign(S: Scenery, f: TileFrame, a: number, b: number, wa: number, db: number, y: number, text: string, bg: string): void {
  const [sx, sz] = size(f, wa, db);
  const centre = at(f, a, b, y);
  const faces = [new THREE.Vector2(1, 0), new THREE.Vector2(-1, 0), new THREE.Vector2(0, 1), new THREE.Vector2(0, -1)];
  const n = faces.reduce((best, v) => (v.dot(S.ctx.cameraDir) > best.dot(S.ctx.cameraDir) ? v : best));
  const faceWidth = n.x !== 0 ? sz : sx;
  const pos = new THREE.Vector3(centre.x + n.x * (sx / 2 + 0.006), centre.y, centre.z + n.y * (sz / 2 + 0.006));
  S.sign(new THREE.PlaneGeometry(faceWidth * 0.92, faceWidth * 0.23), pos, Math.atan2(n.x, n.y), text, bg);
}
