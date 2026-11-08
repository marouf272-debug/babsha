// Greybox 3D board (S4): flat functional colors, fixed orthographic camera, no pan or zoom.
// Reads engine state and events; never changes them.

import * as THREE from 'three';
import type { GameEvent, GameState, Rules, Tile } from '../engine';
import type { SceneConfig } from './config';

export interface SceneText {
  tileName(tile: Tile): string;
  tileNote(tile: Tile): string; // price, tax amount or deck name; '' for none
  font: string;
}

interface Placement {
  x: number;
  z: number;
  w: number; // along x
  d: number; // along z
  inward: THREE.Vector2; // unit vector toward the board centre
}

const TOKEN_HEIGHT = 0.35;

export class BoardScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  private readonly timer = new THREE.Timer();
  private readonly placements: Placement[];
  private readonly half: number;
  private readonly labels: THREE.Mesh[] = [];
  private readonly ownerStrips = new Map<string, THREE.Mesh>();
  private readonly buildings = new Map<string, THREE.Group>();
  private readonly tokens: THREE.Mesh[] = [];
  private readonly dice: THREE.Mesh[] = [];
  private tweens: Array<(dt: number) => boolean> = [];
  private dirty = true;
  private state: GameState | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly rules: Rules,
    private readonly cfg: SceneConfig,
    private readonly text: () => SceneText,
    private readonly instant: boolean,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: instant });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, cfg.render.maxPixelRatio));
    this.scene.background = new THREE.Color(cfg.colors.background);
    const b = cfg.board;
    this.half = (9 * b.tileWidth + 2 * b.tileDepth) / 2;
    this.placements = rules.tiles.map((t) => this.place(t.pos));

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x888888, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(4, 10, 6);
    this.scene.add(sun);

    this.buildBoard();
    this.buildDice();
    this.timer.connect(document);
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ---------- layout ----------

  // Classic loop: GO at the bottom right, moving clockwise along the bottom first (FR-01).
  private place(pos: number): Placement {
    const { tileWidth: w, tileDepth: d } = this.cfg.board;
    const h = this.half;
    const side = Math.floor(pos / 10);
    const k = pos % 10;
    const corner = k === 0;
    const along = corner ? 0 : h - d - (k - 0.5) * w; // distance from centre along the side
    const edge = h - d / 2;
    switch (side) {
      case 0: return corner ? { x: edge, z: edge, w: d, d, inward: new THREE.Vector2(-1, -1).normalize() } : { x: along, z: edge, w, d, inward: new THREE.Vector2(0, -1) };
      case 1: return corner ? { x: -edge, z: edge, w: d, d, inward: new THREE.Vector2(1, -1).normalize() } : { x: -edge, z: along, w: d, d: w, inward: new THREE.Vector2(1, 0) };
      case 2: return corner ? { x: -edge, z: -edge, w: d, d, inward: new THREE.Vector2(1, 1).normalize() } : { x: -along, z: -edge, w, d, inward: new THREE.Vector2(0, 1) };
      default: return corner ? { x: edge, z: -edge, w: d, d, inward: new THREE.Vector2(-1, 1).normalize() } : { x: edge, z: -along, w: d, d: w, inward: new THREE.Vector2(-1, 0) };
    }
  }

  private buildBoard(): void {
    const { colors, board } = this.cfg;
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(this.half * 2 + 0.2, board.baseHeight, this.half * 2 + 0.2),
      new THREE.MeshLambertMaterial({ color: colors.board }),
    );
    base.position.y = -board.baseHeight / 2;
    this.scene.add(base);
    const tileMat = new THREE.MeshLambertMaterial({ color: colors.tile });
    this.rules.tiles.forEach((t, i) => {
      const p = this.placements[i]!;
      const tile = new THREE.Mesh(new THREE.BoxGeometry(p.w * 0.96, board.tileHeight, p.d * 0.96), tileMat);
      tile.position.set(p.x, board.tileHeight / 2, p.z);
      this.scene.add(tile);
      const label = new THREE.Mesh(new THREE.PlaneGeometry(p.w * 0.94, p.d * 0.94), new THREE.MeshBasicMaterial({ transparent: true }));
      label.rotation.x = -Math.PI / 2; // texture top faces away from the camera, so text reads upright (D-67)
      label.position.set(p.x, board.tileHeight + 0.002, p.z);
      this.labels.push(label);
      this.scene.add(label);
    });
    this.refreshText();
  }

  // Redraws every tile sign, for example after the language changes (FR-15).
  refreshText(): void {
    const txt = this.text();
    this.rules.tiles.forEach((t, i) => {
      const p = this.placements[i]!;
      const mat = this.labels[i]!.material as THREE.MeshBasicMaterial;
      mat.map?.dispose();
      mat.map = this.tileTexture(t, p, txt);
      mat.needsUpdate = true;
    });
    this.dirty = true;
  }

  private tileTexture(t: Tile, p: Placement, txt: SceneText): THREE.CanvasTexture {
    const scale = 128;
    const c = document.createElement('canvas');
    c.width = Math.round(p.w * scale);
    c.height = Math.round(p.d * scale);
    const g = c.getContext('2d')!;
    const { colors } = this.cfg;
    let top = 6;
    if (t.group) {
      g.fillStyle = colors.groups[t.group] ?? '#888';
      g.fillRect(0, 0, c.width, c.height * 0.24);
      g.fillStyle = '#ffffff';
      g.font = `700 ${Math.round(c.height * 0.15)}px ${txt.font}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(this.cfg.groupSymbols[t.group] ?? '', c.width / 2, c.height * 0.12);
      top = c.height * 0.28;
    }
    g.fillStyle = colors.tileText;
    g.textAlign = 'center';
    g.textBaseline = 'top';
    const size = Math.round(Math.min(c.width, c.height) * (t.type === 'corner' ? 0.16 : 0.2));
    g.font = `600 ${size}px ${txt.font}`;
    const lines = wrap(g, txt.tileName(t), c.width * 0.9);
    lines.slice(0, 3).forEach((line, k) => g.fillText(line, c.width / 2, top + k * size * 1.2));
    const note = txt.tileNote(t);
    if (note) {
      g.font = `500 ${Math.round(size * 0.85)}px ${txt.font}`;
      g.textBaseline = 'bottom';
      g.fillText(note, c.width / 2, c.height - 6);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  private buildDice(): void {
    const { colors } = this.cfg;
    // Faces in BoxGeometry order +x, -x, +y, -y, +z, -z. Opposite faces add up to 7.
    const faces = [3, 4, 1, 6, 2, 5].map((v) => new THREE.MeshLambertMaterial({ map: pipTexture(v, colors.dice, colors.pip) }));
    for (let i = 0; i < 2; i++) {
      const die = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), faces);
      die.position.set(i === 0 ? -0.55 : 0.55, 0.35, 0);
      this.dice.push(die);
      this.scene.add(die);
    }
  }

  private makeToken(player: number): THREE.Mesh {
    const color = this.cfg.colors.players[player % this.cfg.colors.players.length]!;
    const mat = new THREE.MeshLambertMaterial({ color });
    // Greybox stand-ins for rickshaw, CNG auto, ilish, kite, tea cup and bus (plan 2.4).
    const shapes = [
      () => new THREE.BoxGeometry(0.34, 0.3, 0.44),
      () => new THREE.ConeGeometry(0.22, 0.42, 12),
      () => new THREE.CapsuleGeometry(0.12, 0.28, 4, 10).rotateZ(Math.PI / 2),
      () => new THREE.OctahedronGeometry(0.24),
      () => new THREE.CylinderGeometry(0.18, 0.12, 0.3, 16),
      () => new THREE.BoxGeometry(0.52, 0.3, 0.26),
    ];
    const mesh = new THREE.Mesh(shapes[player % shapes.length]!(), mat);
    this.scene.add(mesh);
    return mesh;
  }

  // ---------- state ----------

  // Puts every piece where the state says, without animation.
  sync(state: GameState): void {
    this.state = state;
    while (this.tokens.length < state.players.length) this.tokens.push(this.makeToken(this.tokens.length));
    state.players.forEach((p, i) => {
      const tok = this.tokens[i]!;
      tok.visible = !p.bankrupt;
      tok.position.copy(this.tokenSpot(i, p.position, p.inJam));
    });
    this.syncOwnership(state);
    if (state.turn.lastDice) this.showDice(state.turn.lastDice);
    this.dirty = true;
  }

  // Animates the events, then settles on the new state.
  async play(events: GameEvent[], state: GameState): Promise<void> {
    if (this.instant) {
      this.sync(state);
      return;
    }
    for (const e of events) {
      if (e.type === 'diceRolled') await this.rollDice(e.dice);
      else if (e.type === 'moved') await this.hop(e.player, e.from, e.steps);
      else if (e.type === 'sentToJam') await this.slide(e.player, this.tokenSpot(e.player, this.rules.jamPos, true));
    }
    this.sync(state);
  }

  private tokenSpot(player: number, pos: number, inJam: boolean): THREE.Vector3 {
    const p = this.placements[pos]!;
    const col = player % 3;
    const row = Math.floor(player / 3);
    const ox = (col - 1) * 0.3;
    const oz = (row - 0.5) * 0.36;
    // In Jam, tokens sit toward the board centre; just passing, toward the outer edge.
    const push = pos === this.rules.jamPos ? (inJam ? 0.35 : -0.35) : 0;
    return new THREE.Vector3(p.x + ox + p.inward.x * push, this.cfg.board.tileHeight + TOKEN_HEIGHT / 2, p.z + oz + p.inward.y * push);
  }

  private syncOwnership(state: GameState): void {
    const { colors, board } = this.cfg;
    for (const t of this.rules.tiles) {
      const owned = state.properties[t.id];
      const p = this.placements[t.pos]!;
      let strip = this.ownerStrips.get(t.id);
      if (owned && !strip) {
        // Flat owner band on the outer edge, readable even behind buildings (plan 3.6).
        const long = Math.abs(p.inward.x) > 0.5 ? p.d : p.w;
        strip = new THREE.Mesh(new THREE.BoxGeometry(long * 0.9, 0.04, 0.14), new THREE.MeshLambertMaterial({ transparent: true }));
        if (Math.abs(p.inward.x) > 0.5) strip.rotation.y = Math.PI / 2;
        const out = (Math.abs(p.inward.x) > 0.5 ? p.w : p.d) / 2 - 0.12;
        strip.position.set(p.x - p.inward.x * out, board.tileHeight + 0.02, p.z - p.inward.y * out);
        this.ownerStrips.set(t.id, strip);
        this.scene.add(strip);
      }
      if (strip) {
        strip.visible = !!owned;
        if (owned) {
          const m = strip.material as THREE.MeshLambertMaterial;
          m.color.set(colors.players[owned.owner % colors.players.length]!);
          m.opacity = owned.mortgaged ? 0.3 : 1;
        }
      }
      this.syncBuildings(t, p, owned?.houses ?? 0);
    }
  }

  private syncBuildings(t: Tile, p: Placement, houses: number): void {
    let group = this.buildings.get(t.id);
    if (houses === 0) {
      if (group) group.visible = false;
      return;
    }
    if (!group) {
      group = new THREE.Group();
      this.buildings.set(t.id, group);
      this.scene.add(group);
    }
    group.visible = true;
    group.clear();
    const { colors, board } = this.cfg;
    const hotel = houses > this.rules.config.building.maxHouses;
    const count = hotel ? 1 : houses;
    const vertical = Math.abs(p.inward.x) > 0.5;
    const inner = (vertical ? p.w : p.d) / 2 - 0.25;
    for (let k = 0; k < count; k++) {
      const size = hotel ? [0.5, 0.32, 0.26] : [0.16, 0.2, 0.18];
      const box = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), new THREE.MeshLambertMaterial({ color: hotel ? colors.hotel : colors.house }));
      const spread = hotel ? 0 : (k - (count - 1) / 2) * 0.21;
      const along = vertical ? new THREE.Vector2(0, spread) : new THREE.Vector2(spread, 0);
      box.position.set(p.x + p.inward.x * inner + along.x, board.tileHeight + size[1]! / 2, p.z + p.inward.y * inner + along.y);
      if (vertical) box.rotation.y = Math.PI / 2;
      group.add(box);
    }
  }

  // ---------- animation ----------

  private showDice(values: number[]): void {
    values.forEach((v, i) => this.dice[i]?.rotation.copy(faceUp(v)));
  }

  private rollDice(values: number[]): Promise<void> {
    const ms = this.cfg.animation.diceMs;
    return new Promise((done) => {
      let t = 0;
      this.tweens.push((dt) => {
        t += dt * 1000;
        if (t >= ms) {
          this.showDice(values);
          done();
          return false;
        }
        this.dice.forEach((d, i) => d.rotation.set(t * 0.02 * (i + 1), t * 0.015, t * 0.011 * (i + 2)));
        return true;
      });
    });
  }

  private hop(player: number, from: number, steps: number): Promise<void> {
    const n = this.rules.tiles.length;
    const dir = Math.sign(steps);
    const path: THREE.Vector3[] = [];
    for (let k = 1; k <= Math.abs(steps); k++) path.push(this.tokenSpot(player, (((from + dir * k) % n) + n) % n, false));
    const ms = this.cfg.animation.hopMs;
    const tok = this.tokens[player]!;
    return new Promise((done) => {
      let i = 0;
      let t = 0;
      let start = tok.position.clone();
      this.tweens.push((dt) => {
        if (i >= path.length) {
          done();
          return false;
        }
        t += dt * 1000;
        const f = Math.min(1, t / ms);
        tok.position.lerpVectors(start, path[i]!, f);
        tok.position.y += Math.sin(f * Math.PI) * 0.35;
        if (f >= 1) {
          start = path[i]!.clone();
          i++;
          t = 0;
        }
        return true;
      });
    });
  }

  private slide(player: number, to: THREE.Vector3): Promise<void> {
    const tok = this.tokens[player]!;
    const start = tok.position.clone();
    const ms = this.cfg.animation.hopMs * 3;
    return new Promise((done) => {
      let t = 0;
      this.tweens.push((dt) => {
        t += dt * 1000;
        const f = Math.min(1, t / ms);
        tok.position.lerpVectors(start, to, f);
        if (f >= 1) {
          done();
          return false;
        }
        return true;
      });
    });
  }

  // ---------- camera and loop ----------

  // Fits the whole board in the canvas from the configured fixed angle (plan 3.6). No pan or zoom.
  resize(): void {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    const preset = this.cfg.camera.presets[this.cfg.camera.active]!;
    const az = THREE.MathUtils.degToRad(preset.azimuthDeg);
    const el = THREE.MathUtils.degToRad(preset.elevationDeg);
    const dist = 60;
    this.camera.position.set(Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld();
    const m = this.half + this.cfg.camera.marginTiles;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const x of [-m, m]) for (const z of [-m, m]) for (const y of [0, 0.8]) {
      const v = new THREE.Vector3(x, y, z).applyMatrix4(this.camera.matrixWorldInverse);
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x); minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    }
    let bw = maxX - minX;
    let bh = maxY - minY;
    const aspect = w / h;
    if (bw / bh > aspect) bh = bw / aspect; else bw = bh * aspect;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const z = preset.zoom;
    this.camera.left = cx - bw / 2 / z;
    this.camera.right = cx + bw / 2 / z;
    this.camera.top = cy + bh / 2 / z;
    this.camera.bottom = cy - bh / 2 / z;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  private frame(): void {
    this.timer.update();
    const dt = Math.min(Math.max(this.timer.getDelta(), 0), 0.1);
    if (this.tweens.length) {
      this.tweens = this.tweens.filter((tw) => tw(dt));
      this.dirty = true;
    }
    if (this.dirty) {
      this.renderer.render(this.scene, this.camera);
      this.dirty = false;
    }
  }

  get currentState(): GameState | null {
    return this.state;
  }

  dispose(): void {
    this.renderer.setAnimationLoop(null);
    this.timer.dispose();
    this.renderer.dispose();
  }
}

function wrap(g: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (g.measureText(next).width > max && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function pipTexture(value: number, bg: string, pip: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = pip;
  const spots: Record<number, Array<[number, number]>> = {
    1: [[32, 32]], 2: [[18, 18], [46, 46]], 3: [[18, 18], [32, 32], [46, 46]],
    4: [[18, 18], [46, 18], [18, 46], [46, 46]], 5: [[18, 18], [46, 18], [32, 32], [18, 46], [46, 46]],
    6: [[18, 16], [46, 16], [18, 32], [46, 32], [18, 48], [46, 48]],
  };
  for (const [x, y] of spots[value]!) {
    g.beginPath();
    g.arc(x, y, 6, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Rotation that turns face `v` upward, for faces laid out +x=3, -x=4, +y=1, -y=6, +z=2, -z=5.
function faceUp(v: number): THREE.Euler {
  switch (v) {
    case 1: return new THREE.Euler(0, 0, 0);
    case 6: return new THREE.Euler(Math.PI, 0, 0);
    case 2: return new THREE.Euler(-Math.PI / 2, 0, 0);
    case 5: return new THREE.Euler(Math.PI / 2, 0, 0);
    case 3: return new THREE.Euler(0, 0, Math.PI / 2);
    default: return new THREE.Euler(0, 0, -Math.PI / 2);
  }
}
