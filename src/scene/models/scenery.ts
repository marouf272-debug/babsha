// Scenery builder (S6): every static part is added here and merged into a few meshes at the end,
// so the whole dressed board costs a handful of draw calls (style guide 9). Flat colors become
// vertex colors on one material; windowed walls share one texture; signs share one atlas.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export interface KitContext {
  palette: Record<string, string>;
  shadowOpacity: number;
  font: string;
  // Direction the camera looks from (unit vector on the ground plane), so signs face it.
  cameraDir: THREE.Vector2;
}

// A tile's ground frame: `along` runs across the tile, `inward` points to the board centre.
export interface TileFrame {
  center: THREE.Vector3; // on the tile top surface
  along: THREE.Vector2;
  inward: THREE.Vector2;
  width: number; // along
  depth: number; // inward
}

interface SignPart {
  geo: THREE.BufferGeometry;
  text: string;
  bg: string;
}

const tmp = new THREE.Object3D();

function prepared(geo: THREE.BufferGeometry, keepUv: boolean): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (!keepUv) g.deleteAttribute('uv');
  for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(name)) g.deleteAttribute(name);
  return g;
}

function paint(g: THREE.BufferGeometry, color: string): void {
  const c = new THREE.Color(color);
  const n = g.attributes['position']!.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
}

export class Scenery {
  private readonly solids: THREE.BufferGeometry[] = [];
  private readonly windows: THREE.BufferGeometry[] = [];
  private readonly shadows: THREE.BufferGeometry[] = [];
  private readonly signs: SignPart[] = [];

  constructor(readonly ctx: KitContext) {}

  color(token: string): string {
    return this.ctx.palette[token] ?? token;
  }

  // Adds a flat-colored part at a world position, with optional rotation and scale.
  solid(geo: THREE.BufferGeometry, color: string, pos: THREE.Vector3, rot = new THREE.Euler(), scale = new THREE.Vector3(1, 1, 1)): void {
    const g = prepared(geo, false);
    tmp.position.copy(pos);
    tmp.rotation.copy(rot);
    tmp.scale.copy(scale);
    tmp.updateMatrix();
    g.applyMatrix4(tmp.matrix);
    paint(g, this.color(color));
    this.solids.push(g);
  }

  // Adds a wall box with the shared window texture repeated u by v times.
  windowed(geo: THREE.BufferGeometry, color: string, pos: THREE.Vector3, u: number, v: number): void {
    const g = prepared(geo, true);
    const uv = g.attributes['uv']!;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v);
    tmp.position.copy(pos);
    tmp.rotation.set(0, 0, 0);
    tmp.scale.set(1, 1, 1);
    tmp.updateMatrix();
    g.applyMatrix4(tmp.matrix);
    paint(g, this.color(color));
    this.windows.push(g);
  }

  shadow(pos: THREE.Vector3, sx: number, sz: number): void {
    const g = prepared(new THREE.CircleGeometry(0.5, 14), false);
    tmp.position.set(pos.x, pos.y + 0.004, pos.z);
    tmp.rotation.set(-Math.PI / 2, 0, 0);
    tmp.scale.set(sx, sz, 1);
    tmp.updateMatrix();
    g.applyMatrix4(tmp.matrix);
    this.shadows.push(g);
  }

  sign(geo: THREE.BufferGeometry, pos: THREE.Vector3, rotY: number, text: string, bg: string): void {
    const g = prepared(geo, true);
    tmp.position.copy(pos);
    tmp.rotation.set(0, rotY, 0);
    tmp.scale.set(1, 1, 1);
    tmp.updateMatrix();
    g.applyMatrix4(tmp.matrix);
    this.signs.push({ geo: g, text, bg: this.color(bg) });
  }

  // Merges everything into at most four meshes: solids, windowed walls, shadows, signs.
  build(): THREE.Group {
    const group = new THREE.Group();
    if (this.solids.length) group.add(new THREE.Mesh(mergeGeometries(this.solids)!, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
    if (this.windows.length) group.add(new THREE.Mesh(mergeGeometries(this.windows)!, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, map: windowTexture() })));
    if (this.shadows.length) {
      const m = new THREE.Mesh(mergeGeometries(this.shadows)!, new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: this.ctx.shadowOpacity, depthWrite: false }));
      m.renderOrder = 1;
      group.add(m);
    }
    if (this.signs.length) group.add(this.signMesh());
    return group;
  }

  // All signs drawn into one atlas texture; each sign plane's UVs point at its cell.
  private signMesh(): THREE.Mesh {
    const cellW = 256, cellH = 64, cols = 4;
    const rows = Math.ceil(this.signs.length / cols);
    const c = document.createElement('canvas');
    c.width = cellW * cols;
    c.height = cellH * rows;
    const g = c.getContext('2d')!;
    this.signs.forEach((s, i) => {
      const x = (i % cols) * cellW, y = Math.floor(i / cols) * cellH;
      g.fillStyle = s.bg;
      g.fillRect(x, y, cellW, cellH);
      g.fillStyle = '#ffffff';
      g.font = `700 36px ${this.ctx.font}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(s.text, x + cellW / 2, y + cellH / 2 + 2, cellW - 16);
      const uv = s.geo.attributes['uv']!;
      for (let k = 0; k < uv.count; k++) {
        uv.setXY(k, (x + uv.getX(k) * cellW) / c.width, 1 - (y + (1 - uv.getY(k)) * cellH) / c.height);
      }
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Mesh(mergeGeometries(this.signs.map((s) => s.geo))!, new THREE.MeshBasicMaterial({ map: tex }));
  }
}

let windowTex: THREE.CanvasTexture | null = null;
function windowTexture(): THREE.CanvasTexture {
  if (windowTex) return windowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(30,40,60,0.5)';
  for (let y = 6; y < 64; y += 16) for (let x = 6; x < 64; x += 16) g.fillRect(x, y, 9, 8);
  windowTex = new THREE.CanvasTexture(c);
  windowTex.colorSpace = THREE.SRGBColorSpace;
  windowTex.wrapS = windowTex.wrapT = THREE.RepeatWrapping;
  return windowTex;
}
