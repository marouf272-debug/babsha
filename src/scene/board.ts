// 3D board (S5 style, docs/style-guide.md): palette and lighting from data/scene.json, fixed
// orthographic camera, no pan or zoom. Reads engine state and events; never changes them.

import * as THREE from 'three';
import type { GameEvent, GameState, Rules, Tile } from '../engine';
import type { SceneConfig } from './config';
import { dressers } from './models/dressing';
import { blob, flat, type KitContext, type TileFrame } from './models/kit';

export interface SceneText {
  tileName(tile: Tile): string;
  tileNote(tile: Tile): string; // price, tax amount or deck name; '' for none
  signName(tile: Tile): string; // always Bangla (plan 3.7)
  font: string;
}

export interface SceneOptions {
  instant: boolean;
  // Show a frame-rate readout and render every frame, for measuring on the phone.
  fps?: HTMLElement | null;
}

interface Placement {
  x: number;
  z: number;
  w: number; // along x
  d: number; // along z
  inward: THREE.Vector2; // unit vector toward the board centre
}

const TOKEN_HEIGHT = 0.4;

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
  private readonly dressing = new Map<string, THREE.Group>();
  private readonly tokens: THREE.Mesh[] = [];
  private readonly dice: THREE.Mesh[] = [];
  private readonly dressed: Set<string>;
  private readonly kit: KitContext;
  private tweens: Array<(dt: number) => boolean> = [];
  private dirty = true;
  private state: GameState | null = null;
  private readonly fps: { el: HTMLElement; frames: number; since: number; history: number[] } | null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly rules: Rules,
    private readonly cfg: SceneConfig,
    private readonly text: () => SceneText,
    private readonly opts: SceneOptions,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: opts.instant });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, cfg.render.maxPixelRatio));
    this.scene.background = new THREE.Color(cfg.colors.background);
    const b = cfg.board;
    this.half = (9 * b.tileWidth + 2 * b.tileDepth) / 2;
    this.placements = rules.tiles.map((t) => this.place(t.pos));
    this.fps = opts.fps ? { el: opts.fps, frames: 0, since: performance.now(), history: [] } : null;

    const L = cfg.lighting;
    this.scene.add(new THREE.HemisphereLight(L.skyColor, L.groundColor, L.hemiIntensity));
    const sun = new THREE.DirectionalLight(L.sunColor, L.sunIntensity);
    sun.position.set(...L.sunPosition);
    this.scene.add(sun);

    const preset = cfg.camera.presets[cfg.camera.active]!;
    const az = THREE.MathUtils.degToRad(preset.azimuthDeg);
    this.kit = { palette: cfg.colors.palette, shadowOpacity: L.shadowOpacity, font: '"Noto Sans Bengali", system-ui, sans-serif', cameraDir: new THREE.Vector2(Math.sin(az), Math.cos(az)) };
    const all = dressers(cfg.dressing.textShare, cfg.dressing.houseLane);
    this.dressed = new Set(Object.keys(all));

    this.buildBoard();
    this.buildDressing(all);
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
    const along = corner ? 0 : h - d - (k - 0.5) * w;
    const edge = h - d / 2;
    switch (side) {
      case 0: return corner ? { x: edge, z: edge, w: d, d, inward: new THREE.Vector2(-1, -1).normalize() } : { x: along, z: edge, w, d, inward: new THREE.Vector2(0, -1) };
      case 1: return corner ? { x: -edge, z: edge, w: d, d, inward: new THREE.Vector2(1, -1).normalize() } : { x: -edge, z: along, w: d, d: w, inward: new THREE.Vector2(1, 0) };
      case 2: return corner ? { x: -edge, z: -edge, w: d, d, inward: new THREE.Vector2(1, 1).normalize() } : { x: -along, z: -edge, w, d, inward: new THREE.Vector2(0, 1) };
      default: return corner ? { x: edge, z: -edge, w: d, d, inward: new THREE.Vector2(-1, 1).normalize() } : { x: edge, z: -along, w: d, d: w, inward: new THREE.Vector2(-1, 0) };
    }
  }

  private frame3(p: Placement): TileFrame {
    const inward = p.inward.clone();
    const along = new THREE.Vector2(-inward.y, inward.x);
    const vertical = Math.abs(inward.x) > 0.5;
    return {
      center: new THREE.Vector3(p.x, this.cfg.board.tileHeight, p.z),
      along, inward,
      width: vertical ? p.d : p.w,
      depth: vertical ? p.w : p.d,
    };
  }

  private buildBoard(): void {
    const { colors, board } = this.cfg;
    const rim = new THREE.Mesh(new THREE.BoxGeometry(this.half * 2 + 0.5, board.baseHeight, this.half * 2 + 0.5), flat(colors.boardRim));
    rim.position.y = -board.baseHeight / 2 - 0.02;
    const field = new THREE.Mesh(new THREE.BoxGeometry(this.half * 2 + 0.1, board.baseHeight, this.half * 2 + 0.1), flat(colors.board));
    field.position.y = -board.baseHeight / 2;
    this.scene.add(rim, field);
    const tileMat = flat(colors.tile);
    this.rules.tiles.forEach((t, i) => {
      const p = this.placements[i]!;
      const tile = new THREE.Mesh(new THREE.BoxGeometry(p.w * 0.97, board.tileHeight, p.d * 0.97), tileMat);
      tile.position.set(p.x, board.tileHeight / 2, p.z);
      this.scene.add(tile);
      const label = new THREE.Mesh(new THREE.PlaneGeometry(p.w * 0.95, p.d * 0.95), new THREE.MeshBasicMaterial({ transparent: true }));
      label.rotation.x = -Math.PI / 2; // texture top faces away from the camera, so text reads upright (D-67)
      label.position.set(p.x, board.tileHeight + 0.002, p.z);
      this.labels.push(label);
      this.scene.add(label);
    });
    this.refreshText();
  }

  private buildDressing(all: ReturnType<typeof dressers>): void {
    for (const [id, dress] of Object.entries(all)) {
      const t = this.rules.tiles.find((x) => x.id === id);
      if (!t) continue;
      const old = this.dressing.get(id);
      if (old) this.scene.remove(old);
      const g = dress(this.kit, this.frame3(this.placements[t.pos]!), this.text().signName(t));
      this.dressing.set(id, g);
      this.scene.add(g);
    }
  }

  // Redraws every tile sign, for example after the language changes (FR-15).
  refreshText(): void {
    const txt = this.text();
    this.rules.tiles.forEach((t, i) => {
      const mat = this.labels[i]!.material as THREE.MeshBasicMaterial;
      mat.map?.dispose();
      mat.map = this.tileTexture(t, this.placements[i]!, txt);
      mat.needsUpdate = true;
    });
    this.dirty = true;
  }

  // Tile face: paper with a border, set strip with symbol, name and price (style guide 4).
  // On a dressed tile the text keeps to the outer part so no building covers it.
  private tileTexture(t: Tile, p: Placement, txt: SceneText): THREE.CanvasTexture {
    const scale = 160;
    const c = document.createElement('canvas');
    c.width = Math.round(p.w * scale);
    c.height = Math.round(p.d * scale);
    const g = c.getContext('2d')!;
    const { colors } = this.cfg;
    g.strokeStyle = colors.tileEdge;
    g.lineWidth = 4;
    g.strokeRect(2, 2, c.width - 4, c.height - 4);
    // Region for text, in canvas pixels. Canvas top is the far side (away from the camera).
    let rx = 0, ry = 0, rw = c.width, rh = c.height;
    if (this.dressed.has(t.id)) {
      const share = this.cfg.dressing.textShare;
      const ix = p.inward.x, iz = p.inward.y;
      if (iz < -0.5) { rh = c.height * share; ry = c.height - rh; } // bottom row: outer is the bottom
      else if (iz > 0.5) { rh = c.height * share; } // top row: outer is the top
      else if (ix > 0.5) { rw = c.width * share; } // left column: outer is the left
      else { rw = c.width * share; rx = c.width - rw; } // right column: outer is the right
    }
    let top = ry + 8;
    if (t.group) {
      const bandH = Math.min(rh * 0.26, 46);
      g.fillStyle = colors.groups[t.group] ?? '#888';
      g.fillRect(rx + 4, ry + 4, rw - 8, bandH);
      g.fillStyle = '#ffffff';
      g.font = `700 ${Math.round(bandH * 0.62)}px ${txt.font}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(this.cfg.groupSymbols[t.group] ?? '', rx + rw / 2, ry + 4 + bandH / 2);
      top = ry + bandH + 10;
    }
    g.fillStyle = colors.tileText;
    g.textAlign = 'center';
    g.textBaseline = 'top';
    const size = Math.round(Math.min(rw * 0.24, rh * (t.type === 'corner' ? 0.15 : 0.2)));
    g.font = `700 ${size}px ${txt.font}`;
    const lines = wrap(g, txt.tileName(t), rw * 0.92);
    lines.slice(0, 3).forEach((line, k) => g.fillText(line, rx + rw / 2, top + k * size * 1.15, rw * 0.94));
    const note = txt.tileNote(t);
    if (note) {
      g.font = `600 ${Math.round(size * 0.9)}px ${txt.font}`;
      g.textBaseline = 'bottom';
      g.fillText(note, rx + rw / 2, ry + rh - 8, rw * 0.94);
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
    const mat = new THREE.MeshLambertMaterial({ color, flatShading: true });
    // Greybox stand-ins for rickshaw, CNG auto, ilish, kite, tea cup and bus; dressed in S6.
    const shapes = [
      () => new THREE.BoxGeometry(0.34, 0.3, 0.44),
      () => new THREE.ConeGeometry(0.22, 0.42, 8),
      () => new THREE.CapsuleGeometry(0.12, 0.28, 3, 8).rotateZ(Math.PI / 2),
      () => new THREE.OctahedronGeometry(0.24),
      () => new THREE.CylinderGeometry(0.18, 0.12, 0.3, 10),
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
    if (this.opts.instant) {
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
    // On a dressed tile, tokens wait on the text side; in Jam, toward the centre; just passing, outward.
    let push = pos === this.rules.jamPos ? (inJam ? 0.35 : -0.35) : 0;
    if (this.dressed.has(this.rules.tiles[pos]!.id)) push = -0.38;
    return new THREE.Vector3(p.x + ox * (Math.abs(p.inward.x) > 0.5 ? 0.5 : 1) + p.inward.x * push, this.cfg.board.tileHeight + TOKEN_HEIGHT / 2, p.z + oz * (Math.abs(p.inward.y) > 0.5 ? 0.5 : 1) + p.inward.y * push);
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
        strip = new THREE.Mesh(new THREE.BoxGeometry(long * 0.9, 0.04, 0.12), new THREE.MeshLambertMaterial({ transparent: true }));
        if (Math.abs(p.inward.x) > 0.5) strip.rotation.y = Math.PI / 2;
        const out = (Math.abs(p.inward.x) > 0.5 ? p.w : p.d) / 2 - 0.09;
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
    const { colors } = this.cfg;
    const f = this.frame3(p);
    const hotel = houses > this.rules.config.building.maxHouses;
    const count = hotel ? 1 : houses;
    // On a dressed tile, houses stand in a row between the text and the landmark (style guide 4).
    const lane = this.cfg.dressing.houseLane;
    const b = this.dressed.has(t.id) ? f.depth / 2 - lane / 2 : f.depth / 2 - 0.25;
    for (let k = 0; k < count; k++) {
      const a = hotel ? 0 : (k - (count - 1) / 2) * 0.21;
      if (hotel) {
        const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), flat(colors.hotel));
        body.scale.set(Math.abs(f.along.x) > 0.5 ? 0.5 : 0.16, 0.3, Math.abs(f.along.x) > 0.5 ? 0.16 : 0.5);
        body.position.set(f.center.x + f.inward.x * b, f.center.y + 0.15, f.center.z + f.inward.y * b);
        group.add(body);
      } else {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.13, 0.15), flat(colors.house));
        body.position.set(f.center.x + f.along.x * a + f.inward.x * b, f.center.y + 0.065, f.center.z + f.along.y * a + f.inward.y * b);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.09, 4), flat(colors.houseRoof));
        roof.rotation.y = Math.PI / 4;
        roof.position.set(body.position.x, f.center.y + 0.175, body.position.z);
        group.add(body, roof);
      }
    }
    group.add(blob(this.kit, f, 0, b, hotel ? 0.6 : count * 0.21, 0.3));
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

  // Benchmark only: every token keeps hopping round the board and the dice keep rolling, so the
  // frame-rate readout measures a busy scene (S5 measurement).
  benchmark(): void {
    const loop = (player: number, from: number) => {
      const steps = 2 + ((player * 7 + from) % 10);
      void this.hop(player, from, steps).then(() => loop(player, (from + steps) % this.rules.tiles.length));
    };
    this.tokens.forEach((_, i) => loop(i, this.state?.players[i]?.position ?? 0));
    const roll = () => { void this.rollDice([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]).then(roll); };
    roll();
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
    for (const x of [-m, m]) for (const z of [-m, m]) for (const y of [0, this.cfg.dressing.maxHeight]) {
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
    if (this.dirty || this.fps) {
      this.renderer.render(this.scene, this.camera);
      this.dirty = false;
    }
    if (this.fps) this.countFrame();
  }

  // Frame-rate readout: frames per second each second, the lowest of the last 10 seconds, and
  // the renderer's draw calls and triangles.
  private countFrame(): void {
    const f = this.fps!;
    f.frames++;
    const now = performance.now();
    if (now - f.since >= 1000) {
      const fps = (f.frames * 1000) / (now - f.since);
      f.history = [...f.history, fps].slice(-10);
      const info = this.renderer.info.render;
      f.el.textContent = `${fps.toFixed(0)} fps  (low ${Math.min(...f.history).toFixed(0)}, 10 s)\n${info.calls} draw calls\n${info.triangles} triangles\npixel ratio ${this.renderer.getPixelRatio().toFixed(2)}`;
      f.frames = 0;
      f.since = now;
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
