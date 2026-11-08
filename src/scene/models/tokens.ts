// Player tokens (plan 2.4): rickshaw, CNG auto, ilish, kite, tea cup, bus. Each is one merged,
// vertex-colored geometry standing on a disc in the player's color (style guide 2), so colors
// stay the first cue and the shape the second.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

type Part = [THREE.BufferGeometry, string, [number, number, number], [number, number, number]?, [number, number, number]?];

function merge(parts: Part[]): THREE.BufferGeometry {
  const tmp = new THREE.Object3D();
  const geos = parts.map(([geo, color, pos, rot = [0, 0, 0], scale = [1, 1, 1]]) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.deleteAttribute('uv');
    tmp.position.set(...pos);
    tmp.rotation.set(...rot);
    tmp.scale.set(...scale);
    tmp.updateMatrix();
    g.applyMatrix4(tmp.matrix);
    const c = new THREE.Color(color);
    const arr = new Float32Array(g.attributes['position']!.count * 3).map((_, i) => [c.r, c.g, c.b][i % 3]!);
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return g;
  });
  return mergeGeometries(geos)!;
}

const wheel = (x: number, z: number, r: number): Part => [new THREE.CylinderGeometry(r, r, 0.03, 10), '#1E1B18', [x, r + 0.05, z], [Math.PI / 2, 0, 0]];

// Base height 0.05; models sit on top. Origin is the centre of the base's underside.
export function tokenGeometry(kind: number, playerColor: string, p: Record<string, string>): THREE.BufferGeometry {
  const base: Part = [new THREE.CylinderGeometry(0.21, 0.23, 0.05, 16), playerColor, [0, 0.025, 0]];
  const parts: Record<number, Part[]> = {
    // Rickshaw: three wheels, blue seat, pink hood with yellow trim.
    0: [
      wheel(-0.08, -0.09, 0.06), wheel(-0.08, 0.09, 0.06), wheel(0.15, 0, 0.06),
      [new THREE.BoxGeometry(0.12, 0.06, 0.2), p['rickBlue']!, [-0.06, 0.15, 0]],
      [new THREE.BoxGeometry(0.18, 0.025, 0.025), '#1E1B18', [0.06, 0.12, 0]],
      [new THREE.CylinderGeometry(0.11, 0.11, 0.21, 10, 1, false, 0, Math.PI), p['rickPink']!, [-0.08, 0.2, 0], [Math.PI / 2, Math.PI / 2, 0]],
      [new THREE.BoxGeometry(0.025, 0.025, 0.22), p['rickYellow']!, [-0.08, 0.205, 0]],
    ],
    // CNG auto: green body, black canopy, three wheels.
    1: [
      wheel(-0.07, -0.08, 0.045), wheel(-0.07, 0.08, 0.045), wheel(0.1, 0, 0.045),
      [new THREE.BoxGeometry(0.28, 0.12, 0.18), '#2E9E4F', [0, 0.16, 0]],
      [new THREE.BoxGeometry(0.24, 0.1, 0.19), '#1E1B18', [-0.01, 0.27, 0]],
      [new THREE.BoxGeometry(0.02, 0.07, 0.15), p['glass']!, [0.13, 0.25, 0]],
    ],
    // Ilish: a silver hilsa on a little stand.
    2: [
      [new THREE.CylinderGeometry(0.015, 0.02, 0.1, 6), '#1E1B18', [0, 0.1, 0]],
      [new THREE.IcosahedronGeometry(0.1, 1), '#C9D3DA', [0, 0.22, 0], [0, 0, 0], [1.6, 0.6, 0.45]],
      [new THREE.ConeGeometry(0.07, 0.1, 4), '#AEB9C1', [-0.19, 0.22, 0], [0, 0, Math.PI / 2], [1, 1, 0.3]],
      [new THREE.IcosahedronGeometry(0.018, 0), '#1E1B18', [0.12, 0.24, 0.04]],
    ],
    // Kite: a diamond kite in rickshaw-art pink with a yellow cross, on a stick, with a tail.
    3: [
      [new THREE.CylinderGeometry(0.012, 0.012, 0.2, 5), '#8A5232', [0, 0.15, 0]],
      [new THREE.OctahedronGeometry(0.15, 0), p['rickPink']!, [0, 0.33, 0], [0, 0, 0], [1, 1.25, 0.12]],
      [new THREE.BoxGeometry(0.022, 0.33, 0.04), p['rickYellow']!, [0, 0.33, 0]],
      [new THREE.BoxGeometry(0.26, 0.022, 0.04), p['rickYellow']!, [0, 0.35, 0]],
      [new THREE.BoxGeometry(0.03, 0.1, 0.02), p['rickTeal']!, [0.02, 0.1, 0.03], [0, 0, 0.4]],
    ],
    // Tea cup: saucer, cup, tea, handle.
    4: [
      [new THREE.CylinderGeometry(0.17, 0.15, 0.025, 16), '#FFFFFF', [0, 0.065, 0]],
      [new THREE.CylinderGeometry(0.12, 0.08, 0.17, 16), '#FFFFFF', [0, 0.16, 0]],
      [new THREE.CylinderGeometry(0.105, 0.105, 0.01, 16), '#8A5232', [0, 0.235, 0]],
      [new THREE.TorusGeometry(0.05, 0.015, 6, 10), '#FFFFFF', [0.13, 0.17, 0]],
      [new THREE.CylinderGeometry(0.125, 0.125, 0.02, 16), p['rickTeal']!, [0, 0.12, 0]],
    ],
    // Bus: red body, yellow rickshaw-art band, window strip, wheels.
    5: [
      wheel(-0.1, -0.08, 0.045), wheel(-0.1, 0.08, 0.045), wheel(0.1, -0.08, 0.045), wheel(0.1, 0.08, 0.045),
      [new THREE.BoxGeometry(0.36, 0.2, 0.17), p['rickRed']!, [0, 0.2, 0]],
      [new THREE.BoxGeometry(0.364, 0.05, 0.174), p['glass']!, [0, 0.25, 0]],
      [new THREE.BoxGeometry(0.366, 0.025, 0.176), p['rickYellow']!, [0, 0.17, 0]],
    ],
  };
  return merge([base, ...parts[kind % 6]!]);
}
