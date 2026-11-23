// Night Map look (website match, ?look=nightmap): a painted night map around the board, the
// two corner scenes, a lotus emblem in the middle and a truck-art repaint for built landmarks.
// The board itself stays clean (D-84): no ready-made buildings around it; buildings, and the
// pink domed hotels, appear only when players build. Everything merges into a few meshes.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Scenery, type KitContext } from './scenery';

// Truck-art paints shared with the website's city.
export const PAINT = ['#F0558A', '#19B3A6', '#FFC93C', '#E0262F', '#3D5FC4', '#2E9E5B', '#FF8A1E', '#B04FD0'] as const;

interface Spot { x: number; z: number; inward: THREE.Vector2 }

const GROUND_Y = -0.23;

// Seeded so the map is the same on every load.
function rng(seed: number): () => number {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

// skyline: painted low-rise blocks on the outer lots, for comparing with the clean map.
export function buildNightMap(kit: KitContext, half: number, corners: { cha?: Spot; jam?: Spot }, skyline: boolean): THREE.Group {
  const S = new Scenery(kit);
  const glow: THREE.BufferGeometry[] = [];
  const rnd = rng(23);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)]!;
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const flat = (w: number, d: number, x: number, z: number, color: string, y = 0) => S.solid(new THREE.BoxGeometry(w, 0.02, d), color, v(x, GROUND_Y + 0.01 + y, z));
  const bulb = (x: number, y: number, z: number, color: string) => {
    const g = new THREE.OctahedronGeometry(0.06).toNonIndexed();
    g.deleteAttribute('uv');
    g.translate(x, y, z);
    const c = new THREE.Color(color), arr = new Float32Array(g.attributes['position']!.count * 3);
    for (let k = 0; k < arr.length; k += 3) { arr[k] = c.r; arr[k + 1] = c.g; arr[k + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    glow.push(g);
  };

  const EXTENT = 34;
  // Corner scenes stand just outside their corner, above the board on a phone, so the tiles stay clean.
  const sceneAt = (spot: Spot) => ({ x: Math.sign(spot.x) * (half - 1.1), z: Math.sign(spot.z) * (half + 2.15) });
  const scenes = [corners.cha, corners.jam].filter((c): c is Spot => !!c).map(sceneAt);
  const ring0 = half + 0.35, ring1 = half + 1.15; // string-lit avenue hugging the board
  const riverZ0 = ring1 + 0.5, riverZ1 = riverZ0 + 3.6; // the Buriganga, in front of the board
  S.solid(new THREE.BoxGeometry(EXTENT * 2, 0.02, EXTENT * 2), '#241A4F', v(0, GROUND_Y, 0));

  // Ring avenue with a dashed lamp-yellow centre line.
  const ringMid = (ring0 + ring1) / 2, ringW = ring1 - ring0, ringLen = ring1 * 2;
  for (const s of [-1, 1]) {
    flat(ringLen, ringW, 0, s * ringMid, '#120E2A');
    flat(ringW, ringLen, s * ringMid, 0, '#120E2A');
    for (let a = -ring1 + 0.4; a < ring1 - 0.4; a += 0.7) {
      flat(0.36, 0.05, a, s * ringMid, '#FFD66B', 0.005);
      flat(0.05, 0.36, s * ringMid, a, '#FFD66B', 0.005);
    }
  }

  // Street grid out from the avenue; blocks between roads become parks, ponds and lots.
  const PITCH = 2.6, ROAD = 0.5, FILL = 19;
  const lines: number[] = [];
  for (let k = 0; k < 9; k++) { const p = PITCH / 2 + k * PITCH; if (p > ring1 + 1) lines.push(p, -p); else if (p < ring0) lines.push(p, -p); }
  for (const p of lines) {
    flat(EXTENT * 2, ROAD, 0, p, '#120E2A');
    flat(ROAD, EXTENT * 2, p, 0, '#120E2A');
  }
  const edges = [-EXTENT, -ring1, ring1, EXTENT, ...lines].sort((a, b) => a - b);
  for (let i = 0; i < edges.length - 1; i++) for (let j = 0; j < edges.length - 1; j++) {
    const [x0, x1, z0, z1] = [edges[i]!, edges[i + 1]!, edges[j]!, edges[j + 1]!];
    if (x1 - x0 < 1.2 || z1 - z0 < 1.2) continue;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (Math.abs(cx) < ring1 && Math.abs(cz) < ring1) continue; // the board
    if (cz > riverZ0 - 0.6 && cz < riverZ1 + 0.6) continue; // the river runs here
    if (Math.abs(cx) > FILL || Math.abs(cz) > FILL) continue; // past the edge of any screen
    if (scenes.some((p) => p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1)) { flat(x1 - x0 - ROAD, z1 - z0 - ROAD, cx, cz, '#30276A'); continue; } // a corner scene stands here
    const w = x1 - x0 - (Math.abs(x0) === EXTENT || Math.abs(x1) === EXTENT ? 0 : ROAD + 0.2);
    const d = z1 - z0 - (Math.abs(z0) === EXTENT || Math.abs(z1) === EXTENT ? 0 : ROAD + 0.2);
    const roll = rnd();
    flat(w, d, cx, cz, roll < 0.45 ? '#2E5E4A' : pick(['#2A2160', '#30276A', '#1D2F6B'] as const));
    const far = Math.max(Math.abs(cx), Math.abs(cz)) - half;
    if (skyline && roll >= 0.45 && far > 2) { // painted low-rise, taller further out
      const bw = w * (0.55 + rnd() * 0.3), bd = d * (0.55 + rnd() * 0.3), h = (0.5 + rnd() ** 2 * 1.4) * Math.min(1.6, far / 4);
      const body = pick(PAINT);
      let band: string = pick(PAINT);
      if (band === body) band = '#FFF1DC';
      S.windowed(new THREE.BoxGeometry(bw, h, bd), body, v(cx, GROUND_Y + h / 2, cz), Math.max(1, Math.round(bw * 1.4)), Math.max(1, Math.round(h * 1.6)));
      S.solid(new THREE.BoxGeometry(bw + 0.1, 0.12, bd + 0.1), band, v(cx, GROUND_Y + h + 0.06, cz));
      continue;
    }
    if (roll < 0.45) { // park with palms
      for (let n = 0; n < 2; n++) palm(S, cx + (rnd() - 0.5) * w * 0.6, cz + (rnd() - 0.5) * d * 0.6, 0.9 + rnd() * 0.5, rnd);
    } else if (roll < 0.6) { // pond
      flat(w * 0.6, d * 0.5, cx, cz, '#0F4C5C', 0.01);
      flat(w * 0.3, 0.04, cx, cz, '#19B3A6', 0.02);
    }
  }

  // The Buriganga with boats and a ghat of steps facing the board. Drawn over the street grid.
  const rz = (riverZ0 + riverZ1) / 2;
  flat(EXTENT * 2, riverZ1 - riverZ0, 0, rz, '#0F4C5C', 0.02);
  for (let k = 0; k < 14; k++) flat(0.6 + rnd() * 1.2, 0.04, -FILL + rnd() * FILL * 2, riverZ0 + 0.3 + rnd() * 3, '#19B3A6', 0.03);
  for (let s = 0; s < 3; s++) flat(ring1 * 1.4, 0.18, 0, riverZ0 - 0.25 + s * 0.12, s % 2 ? '#B9AE9A' : '#DCD3C3', s * 0.03);
  for (let k = 0; k < 9; k++) {
    const x = -16 + k * 4 + (rnd() - 0.5) * 2, z = riverZ0 + 0.7 + (k % 3) * 1.1;
    S.solid(new THREE.BoxGeometry(1.1, 0.16, 0.36), '#FFF1DC', v(x, GROUND_Y + 0.08, z));
    S.solid(new THREE.BoxGeometry(0.6, 0.18, 0.3), k % 2 ? '#E0262F' : '#19B3A6', v(x + 0.1, GROUND_Y + 0.25, z));
    S.solid(new THREE.BoxGeometry(0.62, 0.04, 0.34), '#FFC93C', v(x + 0.1, GROUND_Y + 0.36, z));
  }

  // String lights: posts along the avenue's outer edge, bulbs hanging between them.
  const BULBS = ['#FFD66B', '#F49AB4', '#FFF1DC', '#FFD66B'] as const;
  for (const s of [-1, 1]) for (const axis of [0, 1]) {
    const post = (a: number) => {
      const [x, z] = axis === 0 ? [a, s * (ring1 + 0.08)] : [s * (ring1 + 0.08), a];
      S.solid(new THREE.BoxGeometry(0.05, 0.62, 0.05), '#0B0A1E', v(x, GROUND_Y + 0.31, z));
    };
    for (let a = -ring1; a < ring1 - 0.1; a += 2.2) {
      post(a);
      for (let b = 1; b < 8; b++) {
        const t = b / 8, sag = Math.sin(t * Math.PI) * 0.16;
        const along = a + t * 2.2;
        const [x, z] = axis === 0 ? [along, s * (ring1 + 0.08)] : [s * (ring1 + 0.08), along];
        bulb(x, GROUND_Y + 0.58 - sag, z, BULBS[b % BULBS.length]!);
      }
    }
    post(ring1);
  }

  // Rickshaws and CNGs parked along the streets.
  for (let k = 0; k < 18; k++) {
    const p = pick(lines), a = -20 + rnd() * 40, alongX = rnd() < 0.5;
    const [x, z] = alongX ? [a, p] : [p, a];
    if (Math.abs(x) < ring1 + 1 && Math.abs(z) < ring1 + 1) continue;
    if (z > riverZ0 - 0.6 && z < riverZ1 + 0.6) continue;
    const rot = new THREE.Euler(0, alongX ? Math.PI / 2 : 0, 0);
    const cng = rnd() < 0.4;
    S.solid(new THREE.BoxGeometry(0.22, 0.14, 0.4), cng ? '#2E9E5B' : pick(PAINT), v(x, GROUND_Y + 0.12, z), rot);
    S.solid(new THREE.BoxGeometry(0.24, 0.12, cng ? 0.36 : 0.2), cng ? '#FFD66B' : '#E0262F', v(x, GROUND_Y + 0.26, z), rot);
  }

  if (corners.cha) chaAdda(S, sceneAt(corners.cha));
  if (corners.jam) goToJam(S, sceneAt(corners.jam), bulb);

  const group = S.build();
  if (glow.length) group.add(new THREE.Mesh(mergeGeometries(glow)!, new THREE.MeshBasicMaterial({ vertexColors: true })));
  group.add(lotusEmblem(half));
  return group;
}

function palm(S: Scenery, x: number, z: number, h: number, rnd: () => number): void {
  S.solid(new THREE.CylinderGeometry(0.05, 0.08, h, 5, 1, true), '#8A5A3A', new THREE.Vector3(x, GROUND_Y + h / 2, z));
  for (let f = 0; f < 5; f++) {
    const l = new THREE.PlaneGeometry(0.7, 0.2).rotateX(-Math.PI / 2);
    l.translate(0.32, 0, 0);
    l.rotateZ(-0.45);
    l.rotateY((f / 5) * Math.PI * 2 + rnd());
    S.solid(l, f % 2 ? '#19B3A6' : '#2E9E5B', new THREE.Vector3(x, GROUND_Y + h, z));
  }
}

// Places a corner scene on its lot, front facing the camera.
function cornerFrame(at: { x: number; z: number }): THREE.Matrix4 {
  const o = new THREE.Object3D();
  o.position.set(at.x, GROUND_Y, at.z);
  o.scale.setScalar(1.35);
  o.rotation.y = Math.PI; // local -z (the scene's front) toward the camera
  o.updateMatrix();
  return o.matrix;
}

function adder(S: Scenery, frame: THREE.Matrix4) {
  return (geo: THREE.BufferGeometry, color: string, x: number, y: number, z: number, rx = 0) => {
    geo.rotateX(rx);
    geo.translate(x, y, z);
    geo.applyMatrix4(frame);
    S.solid(geo, color, new THREE.Vector3());
  };
}

function person(add: ReturnType<typeof adder>, x: number, z: number, shirt: string, seated: boolean, lift = 0): void {
  const y = (seated ? 0.2 : 0.14) + lift;
  add(new THREE.CylinderGeometry(0.045, 0.06, 0.16, 6), shirt, x, y + 0.08, z);
  add(new THREE.SphereGeometry(0.045, 6, 4), '#B9785A', x, y + 0.21, z);
  add(new THREE.SphereGeometry(0.047, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), '#0B0A1E', x, y + 0.22, z);
  if (!seated) add(new THREE.BoxGeometry(0.08, 0.14, 0.05), '#1D2F6B', x, 0.07 + lift, z);
}

function chaAdda(S: Scenery, at: { x: number; z: number }): void {
  const add = adder(S, cornerFrame(at));
  add(new THREE.BoxGeometry(0.62, 0.26, 0.24), '#8A5A3A', 0, 0.13, 0.22);
  add(new THREE.BoxGeometry(0.66, 0.04, 0.28), '#A8744A', 0, 0.28, 0.22);
  add(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 8), '#C0C6D6', -0.16, 0.36, 0.22);
  for (const x of [0.02, 0.1, 0.18]) add(new THREE.CylinderGeometry(0.022, 0.018, 0.05, 6), '#FFF1DC', x, 0.325, 0.18);
  for (const x of [-0.3, 0.3]) add(new THREE.CylinderGeometry(0.015, 0.015, 0.62, 4), '#3A2A1E', x, 0.31, 0.08);
  add(new THREE.BoxGeometry(0.78, 0.04, 0.42), '#E0262F', 0, 0.63, 0.2, 0.18);
  for (let i = 0; i < 8; i++) add(new THREE.ConeGeometry(0.045, 0.08, 4), '#FFC93C', -0.35 + i * 0.1, 0.56, -0.01, Math.PI);
  for (const x of [-0.24, 0.24]) add(new THREE.BoxGeometry(0.34, 0.05, 0.1), '#8A5A3A', x, 0.17, -0.18);
  person(add, -0.3, -0.18, '#FFC93C', true);
  person(add, -0.17, -0.18, '#3D5FC4', true);
  person(add, 0.24, -0.18, '#F0558A', true);
  person(add, 0.08, 0.02, '#FFF1DC', false); // the cha wallah
}

function goToJam(S: Scenery, at: { x: number; z: number }, bulb: (x: number, y: number, z: number, c: string) => void): void {
  const frame = cornerFrame(at);
  const add = adder(S, frame);
  const car = (x: number, z: number, ry: number, c: string, long = false) => {
    const L = long ? 0.42 : 0.24;
    const o = new THREE.Matrix4().makeRotationY(ry).setPosition(x, 0, z);
    const part = (geo: THREE.BufferGeometry, color: string, y: number, zz: number) => { geo.translate(0, y, zz); geo.applyMatrix4(o); add(geo, color, 0, 0, 0); };
    part(new THREE.BoxGeometry(0.14, 0.1, L), c, 0.08, 0);
    part(new THREE.BoxGeometry(0.12, 0.07, L * (long ? 0.9 : 0.55)), long ? c : '#CFF7F0', 0.165, long ? 0 : -0.02);
    part(new THREE.BoxGeometry(0.15, 0.025, 0.02), '#FFD66B', 0.08, -L / 2);
  };
  car(-0.5, -0.05, 0, '#2E9E5B');
  car(-0.5, 0.28, 0, '#FFC93C');
  car(-0.22, 0.48, Math.PI / 2, '#E0262F', true);
  car(0.2, 0.5, Math.PI / 2, '#2E9E5B');
  car(0.5, 0.5, Math.PI / 2, '#3D5FC4');
  add(new THREE.CylinderGeometry(0.09, 0.1, 0.12, 8), '#FFF1DC', 0.22, 0.06, 0.12); // police stand
  add(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 4), '#0B0A1E', 0.22, 0.33, 0.12);
  add(new THREE.ConeGeometry(0.2, 0.1, 8), '#E0262F', 0.22, 0.54, 0.12);
  person(add, 0.22, 0.12, '#FFF1DC', false, 0.12);
  add(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 4), '#0B0A1E', 0.55, 0.3, 0.2); // traffic light
  add(new THREE.BoxGeometry(0.08, 0.2, 0.06), '#0B0A1E', 0.55, 0.62, 0.2);
  const red = new THREE.Vector3(0.55, 0.68, 0.16).applyMatrix4(frame);
  bulb(red.x, red.y, red.z, '#FF3030');
}

// A lotus rosette in lamp yellow and pink on the board's centre, drawn once to a canvas (no text).
function lotusEmblem(half: number): THREE.Mesh {
  const N = 512, c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  g.translate(N / 2, N / 2);
  g.lineWidth = 4;
  g.strokeStyle = 'rgba(255,214,107,0.7)';
  for (const r of [236, 214]) { g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); }
  for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; g.fillStyle = i % 2 ? 'rgba(244,154,180,0.8)' : 'rgba(255,214,107,0.8)'; g.beginPath(); g.arc(Math.cos(a) * 225, Math.sin(a) * 225, 4, 0, Math.PI * 2); g.fill(); }
  const petals = (n: number, len: number, wid: number, fill: string, rot: number) => {
    for (let i = 0; i < n; i++) {
      g.save();
      g.rotate((i / n) * Math.PI * 2 + rot);
      g.beginPath();
      g.moveTo(0, -40);
      g.quadraticCurveTo(wid, -len * 0.6, 0, -len);
      g.quadraticCurveTo(-wid, -len * 0.6, 0, -40);
      g.fillStyle = fill;
      g.fill();
      g.restore();
    }
  };
  petals(12, 200, 40, '#C8467F', Math.PI / 12);
  petals(12, 160, 30, '#E8B34A', 0);
  g.fillStyle = '#FFD66B';
  g.beginPath(); g.arc(0, 0, 44, 0, Math.PI * 2); g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const size = (half - 1.6) * 2 * 0.86;
  const geo = new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2);
  geo.translate(0, 0.003, 0);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
}

// Truck-art paint for a built landmark: pale walls take one paint; signs and dark roofs keep theirs.
export function repaint(group: THREE.Object3D, paint: string): void {
  const target = new THREE.Color(paint), c = new THREE.Color(), hsl = { h: 0, s: 0, l: 0 };
  group.traverse((o) => {
    const col = (o as THREE.Mesh).geometry?.attributes?.['color'];
    if (!(o as THREE.Mesh).isMesh || !col) return;
    for (let i = 0; i < col.count; i++) {
      c.setRGB(col.getX(i), col.getY(i), col.getZ(i));
      c.getHSL(hsl);
      if (hsl.s < 0.3 && hsl.l > 0.6) col.setXYZ(i, target.r, target.g, target.b);
    }
    col.needsUpdate = true;
  });
}

// Hotel for the Night Map look: a pink Old Dhaka building with three domes, laid out along x
// (0.5 long, 0.16 deep, 0.3 tall, centred) so it can be instanced like the plain hotel block.
export function domedHotel(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const add = (geo: THREE.BufferGeometry, color: string, x: number, y: number, z = 0) => {
    const g = geo.toNonIndexed();
    g.deleteAttribute('uv');
    g.translate(x, y, z);
    const c = new THREE.Color(color), arr = new Float32Array(g.attributes['position']!.count * 3);
    for (let k = 0; k < arr.length; k += 3) { arr[k] = c.r; arr[k + 1] = c.g; arr[k + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    parts.push(g);
  };
  add(new THREE.BoxGeometry(0.5, 0.2, 0.16), '#F7B6CB', 0, -0.05);
  add(new THREE.BoxGeometry(0.52, 0.03, 0.18), '#E0262F', 0, 0.065);
  for (const [x, r] of [[-0.17, 0.055], [0, 0.075], [0.17, 0.055]] as const) {
    add(new THREE.SphereGeometry(r, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), '#F0558A', x, 0.08);
    add(new THREE.ConeGeometry(0.012, 0.05, 4), '#FFC93C', x, 0.08 + r + 0.02);
  }
  return mergeGeometries(parts)!;
}
