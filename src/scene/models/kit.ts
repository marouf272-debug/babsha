// Low-poly building kit (style guide sections 4 and 5): flat-shaded boxes on plinths, shared
// window texture, Bangla signs on canvas, blob shadows. Everything is made in code.

import * as THREE from 'three';

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

const materials = new Map<string, THREE.MeshLambertMaterial>();
export function flat(color: string): THREE.MeshLambertMaterial {
  let m = materials.get(color);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, flatShading: true });
    materials.set(color, m);
  }
  return m;
}

let windowTex: THREE.CanvasTexture | null = null;
function windowTexture(): THREE.CanvasTexture {
  if (windowTex) return windowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(30,40,60,0.55)';
  for (let y = 6; y < 64; y += 16) for (let x = 6; x < 64; x += 16) g.fillRect(x, y, 9, 8);
  windowTex = new THREE.CanvasTexture(c);
  windowTex.colorSpace = THREE.SRGBColorSpace;
  windowTex.wrapS = windowTex.wrapT = THREE.RepeatWrapping;
  return windowTex;
}

// World position for a point given in the tile frame (a across, b toward the centre, y up).
export function at(f: TileFrame, a: number, b: number, y = 0): THREE.Vector3 {
  return new THREE.Vector3(f.center.x + f.along.x * a + f.inward.x * b, f.center.y + y, f.center.z + f.along.y * a + f.inward.y * b);
}

// Box sized in the tile frame (wa across, db toward the centre), standing on the tile.
export function box(f: TileFrame, a: number, b: number, wa: number, db: number, h: number, mat: THREE.Material, y = 0): THREE.Mesh {
  const alongX = Math.abs(f.along.x) > 0.5;
  const geo = new THREE.BoxGeometry(alongX ? wa : db, h, alongX ? db : wa);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(at(f, a, b, y + h / 2));
  return mesh;
}

// A building with a plinth, window texture on its walls and a roof color.
export function building(ctx: KitContext, f: TileFrame, a: number, b: number, wa: number, db: number, h: number, wall: string, roof: string, floors: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(f, a, b, wa + 0.08, db + 0.08, 0.05, flat(ctx.palette['concreteShade']!)));
  const tex = windowTexture().clone();
  tex.repeat.set(Math.max(1, Math.round(wa * 4)), floors / 4);
  tex.needsUpdate = true;
  const walls = new THREE.MeshLambertMaterial({ color: wall, map: tex, flatShading: true });
  const top = flat(roof);
  const body = box(f, a, b, wa, db, h, walls, 0.05);
  body.material = [walls, walls, top, top, walls, walls];
  g.add(body);
  g.add(blob(ctx, f, a, b, wa + 0.25, db + 0.25));
  return g;
}

export function blob(ctx: KitContext, f: TileFrame, a: number, b: number, wa: number, db: number): THREE.Mesh {
  const alongX = Math.abs(f.along.x) > 0.5;
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: ctx.shadowOpacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.scale.set(alongX ? wa : db, alongX ? db : wa, 1);
  m.position.copy(at(f, a, b, 0.004));
  return m;
}

export function tree(ctx: KitContext, f: TileFrame, a: number, b: number, s = 1): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.025 * s, 0.03 * s, 0.14 * s, 5), flat(ctx.palette['terracotta']!));
  trunk.position.copy(at(f, a, b, 0.07 * s));
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12 * s, 0), flat(ctx.palette['leaf']!));
  crown.position.copy(at(f, a, b, 0.2 * s));
  g.add(trunk, crown, blob(ctx, f, a, b, 0.22 * s, 0.22 * s));
  return g;
}

export function water(ctx: KitContext, f: TileFrame, a: number, b: number, wa: number, db: number): THREE.Mesh {
  return box(f, a, b, wa, db, 0.015, flat(ctx.palette['water']!), 0.002);
}

// Scales a group about a ground point, so small anchors can be enlarged in place.
export function scaled(g: THREE.Group, centre: THREE.Vector3, s: number): THREE.Group {
  const outer = new THREE.Group();
  outer.position.copy(centre);
  g.position.sub(centre);
  outer.add(g);
  outer.scale.setScalar(s);
  return outer;
}

// Nouka (country boat): a slim hull with a small curved shade.
export function nouka(ctx: KitContext, f: TileFrame, a: number, b: number): THREE.Group {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.02, 0.36, 6, 1), flat(ctx.palette['terracotta']!));
  hull.rotation.z = Math.PI / 2;
  if (Math.abs(f.along.x) < 0.5) hull.rotation.set(Math.PI / 2, 0, 0);
  hull.position.copy(at(f, a, b, 0.04));
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 6, 1, false, 0, Math.PI), flat(ctx.palette['rickYellow']!));
  shade.rotation.z = Math.PI / 2;
  if (Math.abs(f.along.x) < 0.5) shade.rotation.set(Math.PI / 2, 0, 0);
  shade.position.copy(at(f, a, b, 0.08));
  g.add(hull, shade);
  return g;
}

// Cycle rickshaw: three wheels, a seat, and a hood in rickshaw-art pink and yellow.
export function rickshaw(ctx: KitContext, f: TileFrame, a: number, b: number): THREE.Group {
  const g = new THREE.Group();
  const p = ctx.palette;
  const wheel = (wa: number, wb: number) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.015, 8), flat(p['ink']!));
    w.rotation.x = Math.PI / 2;
    if (Math.abs(f.along.x) > 0.5) w.rotation.set(0, 0, Math.PI / 2);
    w.position.copy(at(f, a + wa, b + wb, 0.05));
    return w;
  };
  g.add(wheel(-0.07, 0.05), wheel(0.07, 0.05), wheel(0, -0.13));
  g.add(box(f, a, b + 0.04, 0.16, 0.1, 0.05, flat(p['rickBlue']!), 0.07));
  const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.16, 8, 1, false, 0, Math.PI), flat(p['rickPink']!));
  hood.rotation.set(0, 0, 0);
  if (Math.abs(f.along.x) > 0.5) hood.rotation.y = Math.PI / 2;
  hood.position.copy(at(f, a, b + 0.06, 0.13));
  g.add(hood);
  g.add(box(f, a, b + 0.06, 0.17, 0.02, 0.02, flat(p['rickYellow']!), 0.13));
  g.add(blob(ctx, f, a, b, 0.24, 0.3));
  return g;
}

// A Bangla sign board on the building face that looks most toward the camera.
export function sign(ctx: KitContext, f: TileFrame, a: number, b: number, wa: number, db: number, y: number, text: string, bg: string): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#ffffff';
  g.font = `700 38px ${ctx.font}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 34, 240);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const alongX = Math.abs(f.along.x) > 0.5;
  const sizeX = alongX ? wa : db;
  const sizeZ = alongX ? db : wa;
  const centre = at(f, a, b, y);
  // Pick the face (+x, -x, +z or -z) that faces the camera most.
  const faces = [new THREE.Vector2(1, 0), new THREE.Vector2(-1, 0), new THREE.Vector2(0, 1), new THREE.Vector2(0, -1)];
  const n = faces.reduce((best, v) => (v.dot(ctx.cameraDir) > best.dot(ctx.cameraDir) ? v : best));
  const faceWidth = n.x !== 0 ? sizeZ : sizeX;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(faceWidth * 0.9, faceWidth * 0.22), new THREE.MeshBasicMaterial({ map: tex }));
  mesh.position.set(centre.x + n.x * (sizeX / 2 + 0.006), centre.y, centre.z + n.y * (sizeZ / 2 + 0.006));
  mesh.rotation.y = Math.atan2(n.x, n.y);
  return mesh;
}
