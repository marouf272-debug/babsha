// 3D board (S6, docs/style-guide.md): every tile dressed, static scenery merged into a few meshes,
// tile labels and signs in atlases, houses and owner bands instanced, so the full board costs
// about twenty draw calls. Fixed orthographic camera, no pan or zoom (plan 3.6).
// Reads engine state and events; never changes them.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { GameEvent, GameState, Rules, Tile } from '../engine';
import type { SceneConfig } from './config';
import { dressers } from './models/dressing';
import { Scenery, type KitContext, type TileFrame } from './models/scenery';
import { tokenGeometry } from './models/tokens';

export interface SceneText {
  tileName(tile: Tile): string;
  tileNote(tile: Tile): string; // price, tax amount or deck name; '' for none
  signName(tile: Tile): string; // always Bangla (plan 3.7, D-74)
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
  inward: THREE.Vector2; // unit vector toward the board centre (diagonal on corners)
}

const TOKEN_LIFT = 0.35;
const CELL = 264; // label atlas cell, with a gutter so mipmaps do not bleed
const LABEL_SCALE = 150; // canvas pixels per world unit
const easeOutBack = (x: number) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2;

export class BoardScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  private readonly timer = new THREE.Timer();
  private readonly placements: Placement[];
  private readonly half: number;
  private readonly kit: KitContext;
  private readonly reduced: boolean;
  private labelCanvas!: HTMLCanvasElement;
  private labelTexture!: THREE.CanvasTexture;
  private strips!: THREE.InstancedMesh;
  private houses!: THREE.InstancedMesh;
  private roofs!: THREE.InstancedMesh;
  private hotels!: THREE.InstancedMesh;
  private highlights!: THREE.InstancedMesh;
  private readonly buyable: Tile[];
  private readonly tokens: THREE.Mesh[] = [];
  private readonly dice: THREE.Mesh[] = [];
  private tweens: Array<(dt: number) => boolean> = [];
  private pops = new Map<string, number>(); // instance key -> start time (ms)
  private highlighted: string[] = [];
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
    this.buyable = rules.tiles.filter((t) => t.type === 'property' || t.type === 'hub' || t.type === 'utility');
    this.fps = opts.fps ? { el: opts.fps, frames: 0, since: performance.now(), history: [] } : null;
    this.reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

    const L = cfg.lighting;
    this.scene.add(new THREE.HemisphereLight(L.skyColor, L.groundColor, L.hemiIntensity));
    const sun = new THREE.DirectionalLight(L.sunColor, L.sunIntensity);
    sun.position.set(...L.sunPosition);
    this.scene.add(sun);

    const preset = cfg.camera.presets[cfg.camera.active]!;
    const az = THREE.MathUtils.degToRad(preset.azimuthDeg);
    this.kit = { palette: cfg.colors.palette, shadowOpacity: L.shadowOpacity, font: '"Noto Sans Bengali", system-ui, sans-serif', cameraDir: new THREE.Vector2(Math.sin(az), Math.cos(az)) };

    this.buildScenery();
    this.buildLabels();
    this.buildInstances();
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

  // Tile frame for dressing. Corners use an axis-aligned frame, laid out like a row tile.
  private frameOf(p: Placement): TileFrame {
    const diag = Math.abs(p.inward.x) > 0.1 && Math.abs(p.inward.y) > 0.1;
    const inward = diag ? new THREE.Vector2(0, Math.sign(p.inward.y)) : p.inward.clone();
    const along = new THREE.Vector2(-inward.y, inward.x);
    const vertical = Math.abs(inward.x) > 0.5;
    return { center: new THREE.Vector3(p.x, this.cfg.board.tileHeight, p.z), along, inward, width: vertical ? p.d : p.w, depth: vertical ? p.w : p.d };
  }

  private buildScenery(): void {
    const { colors, board, dressing } = this.cfg;
    const S = new Scenery(this.kit);
    S.solid(new THREE.BoxGeometry(this.half * 2 + 0.5, board.baseHeight, this.half * 2 + 0.5), colors.boardRim, new THREE.Vector3(0, -board.baseHeight / 2 - 0.02, 0));
    S.solid(new THREE.BoxGeometry(this.half * 2 + 0.1, board.baseHeight, this.half * 2 + 0.1), colors.board, new THREE.Vector3(0, -board.baseHeight / 2, 0));
    const all = dressers(dressing.textShare, dressing.houseLane);
    this.rules.tiles.forEach((t, i) => {
      const p = this.placements[i]!;
      S.solid(new THREE.BoxGeometry(p.w * 0.97, board.tileHeight, p.d * 0.97), colors.tile, new THREE.Vector3(p.x, board.tileHeight / 2, p.z));
      all[t.id]?.(S, this.frameOf(p), this.text().signName(t));
    });
    this.scene.add(S.build());
  }

  // ---------- tile labels: one atlas, one mesh (FR-15) ----------

  private buildLabels(): void {
    const cols = 8;
    this.labelCanvas = document.createElement('canvas');
    this.labelCanvas.width = CELL * cols;
    this.labelCanvas.height = CELL * Math.ceil(this.rules.tiles.length / cols);
    this.labelTexture = new THREE.CanvasTexture(this.labelCanvas);
    this.labelTexture.colorSpace = THREE.SRGBColorSpace;
    this.labelTexture.anisotropy = 4;
    const geos = this.rules.tiles.map((t, i) => {
      const p = this.placements[i]!;
      const g = new THREE.PlaneGeometry(p.w * 0.95, p.d * 0.95);
      const [cw, ch] = [Math.round(p.w * LABEL_SCALE), Math.round(p.d * LABEL_SCALE)];
      const [cx, cy] = [(i % cols) * CELL + 4, Math.floor(i / cols) * CELL + 4];
      const uv = g.attributes['uv']!;
      for (let k = 0; k < uv.count; k++) {
        uv.setXY(k, (cx + uv.getX(k) * cw) / this.labelCanvas.width, 1 - (cy + (1 - uv.getY(k)) * ch) / this.labelCanvas.height);
      }
      g.rotateX(-Math.PI / 2); // canvas top lies away from the camera, so text reads upright (D-67)
      g.translate(p.x, this.cfg.board.tileHeight + 0.002, p.z);
      return g;
    });
    const mesh = new THREE.Mesh(mergeGeometries(geos)!, new THREE.MeshBasicMaterial({ map: this.labelTexture, transparent: true }));
    this.scene.add(mesh);
    this.refreshText();
  }

  // Redraws every tile label, for example after the language changes (FR-15).
  refreshText(): void {
    const g = this.labelCanvas.getContext('2d')!;
    g.clearRect(0, 0, this.labelCanvas.width, this.labelCanvas.height);
    const txt = this.text();
    this.rules.tiles.forEach((t, i) => {
      g.save();
      g.translate((i % 8) * CELL + 4, Math.floor(i / 8) * CELL + 4);
      this.drawLabel(g, t, this.placements[i]!, txt);
      g.restore();
    });
    this.labelTexture.needsUpdate = true;
    this.dirty = true;
  }

  // Tile face: border, set band on the edge facing the centre (D-77), name and price kept to the
  // outer part (the landmark fills the middle) and clear of the owner band.
  private drawLabel(g: CanvasRenderingContext2D, t: Tile, p: Placement, txt: SceneText): void {
    const W = Math.round(p.w * LABEL_SCALE), H = Math.round(p.d * LABEL_SCALE);
    const { colors, dressing } = this.cfg;
    g.strokeStyle = colors.tileEdge;
    g.lineWidth = 4;
    g.strokeRect(2, 2, W - 4, H - 4);
    const diag = Math.abs(p.inward.x) > 0.1 && Math.abs(p.inward.y) > 0.1;
    const ix = diag ? 0 : p.inward.x, iz = diag ? Math.sign(p.inward.y) : p.inward.y;
    let rx = 0, ry = 0, rw = W, rh = H;
    if (t.group) {
      const band = Math.round(dressing.houseLane * LABEL_SCALE);
      let bx = 0, by = 0, bw = W, bh = H;
      if (iz < -0.5) bh = band; else if (iz > 0.5) { by = H - band; bh = band; } else if (ix > 0.5) { bx = W - band; bw = band; } else bw = band;
      g.fillStyle = colors.groups[t.group] ?? '#888';
      g.fillRect(bx + 4, by + 4, bw - 8, bh - 8);
      g.fillStyle = '#ffffff';
      g.font = `700 ${Math.round(Math.min(bw, bh) * 0.5)}px ${txt.font}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(this.cfg.groupSymbols[t.group] ?? '', bx + bw / 2, by + bh / 2);
    }
    const share = dressing.textShare;
    if (iz < -0.5) { rh = H * share; ry = H - rh; } else if (iz > 0.5) rh = H * share; else if (ix > 0.5) rw = W * share; else { rw = W * share; rx = W - rw; }
    if (t.type === 'property' || t.type === 'hub' || t.type === 'utility') {
      const pad = Math.round(0.17 * LABEL_SCALE);
      if (iz < -0.5) rh -= pad; else if (iz > 0.5) { ry += pad; rh -= pad; } else if (ix > 0.5) { rx += pad; rw -= pad; } else rw -= pad;
    }
    g.fillStyle = colors.tileText;
    g.textAlign = 'center';
    g.textBaseline = 'top';
    const size = Math.round(Math.min(rw * 0.22, rh * 0.3, 30));
    g.font = `700 ${size}px ${txt.font}`;
    const lines = wrap(g, txt.tileName(t), rw * 0.92);
    lines.slice(0, 2).forEach((line, k) => g.fillText(line, rx + rw / 2, ry + 6 + k * size * 1.12, rw * 0.94));
    const note = txt.tileNote(t);
    if (note) {
      g.font = `600 ${Math.round(size * 0.85)}px ${txt.font}`;
      g.textBaseline = 'bottom';
      g.fillText(note, rx + rw / 2, ry + rh - 4, rw * 0.94);
    }
  }

  // ---------- instanced pieces: owner bands, houses, roofs, hotels, highlights ----------

  private buildInstances(): void {
    const { colors } = this.cfg;
    const lam = (color?: string) => new THREE.MeshLambertMaterial({ color: color ?? '#ffffff', flatShading: true });
    this.strips = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.04, 0.12), lam(), this.buyable.length);
    this.houses = new THREE.InstancedMesh(new THREE.BoxGeometry(0.15, 0.13, 0.15), lam(colors.house), this.buyable.length * 4);
    const roof = new THREE.ConeGeometry(0.12, 0.09, 4);
    roof.rotateY(Math.PI / 4);
    this.roofs = new THREE.InstancedMesh(roof, lam(colors.houseRoof), this.buyable.length * 4);
    this.hotels = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(colors.hotel), this.buyable.length);
    this.highlights = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: this.cfg.colors.palette['rickYellow'], transparent: true, opacity: 0.45, depthWrite: false }), this.rules.tiles.length);
    for (const m of [this.strips, this.houses, this.roofs, this.hotels, this.highlights]) {
      m.count = 0;
      m.frustumCulled = false;
      this.scene.add(m);
    }
    this.highlights.renderOrder = 2;
  }

  private layoutInstances(now: number): boolean {
    const s = this.state;
    if (!s) return false;
    const { colors, board, dressing } = this.cfg;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    let popping = false;
    const pop = (key: string) => {
      const start = this.pops.get(key);
      if (start === undefined) return 1;
      const f = Math.min(1, (now - start) / 260);
      if (f >= 1) { this.pops.delete(key); return 1; }
      popping = true;
      return Math.max(0.001, easeOutBack(f));
    };
    let nStrip = 0, nHouse = 0, nHotel = 0;
    const paper = new THREE.Color(colors.tile);
    for (const t of this.buyable) {
      const owned = s.properties[t.id];
      if (!owned) continue;
      const p = this.placements[t.pos]!;
      const vertical = Math.abs(p.inward.x) > 0.5;
      const long = vertical ? p.d : p.w;
      const out = (vertical ? p.w : p.d) / 2 - 0.09;
      const k = pop(`strip:${t.id}`);
      q.setFromAxisAngle(up, vertical ? Math.PI / 2 : 0);
      m.compose(v.set(p.x - p.inward.x * out, board.tileHeight + 0.02, p.z - p.inward.y * out), q, sc.set(long * 0.9 * k, 1, k));
      this.strips.setMatrixAt(nStrip, m);
      const c = new THREE.Color(colors.players[owned.owner % colors.players.length]!);
      if (owned.mortgaged) c.lerp(paper, 0.65); // mortgaged: faded band
      this.strips.setColorAt(nStrip++, c);
      // Houses and hotels stand on the set band at the inner edge (D-77).
      const f = this.frameOf(p);
      const b = f.depth / 2 - dressing.houseLane / 2;
      if (owned.houses > this.rules.config.building.maxHouses) {
        const kh = pop(`hotel:${t.id}`);
        q.setFromAxisAngle(up, 0);
        m.compose(v.set(f.center.x + f.inward.x * b, f.center.y + 0.15 * kh, f.center.z + f.inward.y * b), q, sc.set((vertical ? 0.16 : 0.5) * kh, 0.3 * kh, (vertical ? 0.5 : 0.16) * kh));
        this.hotels.setMatrixAt(nHotel++, m);
      } else {
        for (let h = 0; h < owned.houses; h++) {
          const kk = pop(`house:${t.id}:${h}`);
          const a = (h - (owned.houses - 1) / 2) * 0.21;
          const x = f.center.x + f.along.x * a + f.inward.x * b, z = f.center.z + f.along.y * a + f.inward.y * b;
          m.compose(v.set(x, f.center.y + 0.065 * kk, z), q.identity(), sc.set(kk, kk, kk));
          this.houses.setMatrixAt(nHouse, m);
          m.compose(v.set(x, f.center.y + 0.175 * kk, z), q.identity(), sc.set(kk, kk, kk));
          this.roofs.setMatrixAt(nHouse++, m);
        }
      }
    }
    this.strips.count = nStrip;
    this.houses.count = this.roofs.count = nHouse;
    this.hotels.count = nHotel;
    for (const im of [this.strips, this.houses, this.roofs, this.hotels]) im.instanceMatrix.needsUpdate = true;
    if (this.strips.instanceColor) this.strips.instanceColor.needsUpdate = true;
    return popping;
  }

  // Highlights the tiles a tapped Build, Sell, Mortgage or Redeem can use (D-71).
  setHighlights(tileIds: string[]): void {
    this.highlighted = [...tileIds];
    const m = new THREE.Matrix4();
    this.highlighted.forEach((id, i) => {
      const t = this.rules.tiles.find((x) => x.id === id)!;
      const p = this.placements[t.pos]!;
      m.compose(new THREE.Vector3(p.x, this.cfg.board.tileHeight + 0.006, p.z), new THREE.Quaternion(), new THREE.Vector3(p.w * 0.95, 1, p.d * 0.95));
      this.highlights.setMatrixAt(i, m);
    });
    this.highlights.count = this.highlighted.length;
    this.highlights.instanceMatrix.needsUpdate = true;
    this.dirty = true;
  }

  // The tile under a screen point, or null (for tap-to-build).
  pickTile(clientX: number, clientY: number): string | null {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.cfg.board.tileHeight), hit)) return null;
    for (const t of this.rules.tiles) {
      const p = this.placements[t.pos]!;
      if (Math.abs(hit.x - p.x) <= p.w / 2 && Math.abs(hit.z - p.z) <= p.d / 2) return t.id;
    }
    return null;
  }

  // ---------- dice: one texture, one material each ----------

  private buildDice(): void {
    const { colors } = this.cfg;
    const tex = diceAtlas(colors.dice, colors.pip);
    // BoxGeometry face order +x, -x, +y, -y, +z, -z; values chosen so opposite faces add to 7.
    const values = [3, 4, 1, 6, 2, 5];
    for (let i = 0; i < 2; i++) {
      const g = new THREE.BoxGeometry(0.7, 0.7, 0.7);
      const uv = g.attributes['uv']!;
      for (let face = 0; face < 6; face++) {
        const v = values[face]! - 1;
        const [cx, cy] = [(v % 3) / 3, Math.floor(v / 3) / 2];
        for (let k = face * 4; k < face * 4 + 4; k++) uv.setXY(k, cx + uv.getX(k) / 3, 1 - cy - (1 - uv.getY(k)) / 2);
      }
      const die = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex }));
      die.position.set(i === 0 ? -0.55 : 0.55, 0.35, 0);
      this.dice.push(die);
      this.scene.add(die);
    }
  }

  private makeToken(player: number): THREE.Mesh {
    const color = this.cfg.colors.players[player % this.cfg.colors.players.length]!;
    const mesh = new THREE.Mesh(tokenGeometry(player, color, this.cfg.colors.palette), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    this.scene.add(mesh);
    return mesh;
  }

  // ---------- state ----------

  // Puts every piece where the state says, without animation; new bands and houses pop in.
  sync(state: GameState): void {
    const prev = this.state;
    if (prev && !this.opts.instant && !this.reduced) {
      const now = performance.now();
      for (const t of this.buyable) {
        const a = prev.properties[t.id], b = state.properties[t.id];
        if (b && (!a || a.owner !== b.owner)) this.pops.set(`strip:${t.id}`, now);
        const ha = a?.houses ?? 0, hb = b?.houses ?? 0;
        if (hb > ha) this.pops.set(hb > this.rules.config.building.maxHouses ? `hotel:${t.id}` : `house:${t.id}:${hb - 1}`, now);
      }
    }
    this.state = state;
    while (this.tokens.length < state.players.length) this.tokens.push(this.makeToken(this.tokens.length));
    state.players.forEach((p, i) => {
      const tok = this.tokens[i]!;
      tok.visible = !p.bankrupt;
      tok.position.copy(this.tokenSpot(i, p.position, p.inJam));
      tok.scale.set(1, 1, 1);
    });
    this.layoutInstances(performance.now());
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
    const vertical = Math.abs(p.inward.x) > 0.5 && Math.abs(p.inward.y) < 0.1;
    const across = (col - 1) * 0.28;
    const deep = (row - 0.5) * 0.3;
    // Tokens wait on the text side of a tile; in Jam they stand toward the centre.
    const push = pos === this.rules.jamPos && inJam ? 0.35 : -0.42;
    const ox = vertical ? deep * 0.6 : across;
    const oz = vertical ? across : deep * 0.6;
    return new THREE.Vector3(p.x + ox + p.inward.x * push, this.cfg.board.tileHeight, p.z + oz + p.inward.y * push);
  }

  private showDice(values: number[]): void {
    values.forEach((v, i) => {
      const d = this.dice[i];
      if (!d) return;
      d.rotation.copy(faceUp(v));
      d.position.y = 0.35;
    });
  }

  // Dice tumble, bounce lower each time, and settle on the rolled faces (game feel).
  private rollDice(values: number[]): Promise<void> {
    const ms = this.reduced ? 120 : this.cfg.animation.diceMs;
    return new Promise((done) => {
      let t = 0;
      this.tweens.push((dt) => {
        t += dt * 1000;
        if (t >= ms) {
          this.showDice(values);
          done();
          return false;
        }
        const f = t / ms;
        this.dice.forEach((d, i) => {
          d.rotation.set(t * 0.02 * (i + 1), t * 0.015, t * 0.011 * (i + 2));
          d.position.y = 0.35 + Math.abs(Math.sin(f * Math.PI * 3)) * 0.5 * (1 - f);
        });
        return true;
      });
    });
  }

  // Token hops tile by tile: stretches in the air, squashes on landing, then settles.
  private hop(player: number, from: number, steps: number): Promise<void> {
    const n = this.rules.tiles.length;
    const dir = Math.sign(steps);
    const path: THREE.Vector3[] = [];
    for (let k = 1; k <= Math.abs(steps); k++) path.push(this.tokenSpot(player, (((from + dir * k) % n) + n) % n, false));
    const ms = this.reduced ? 40 : this.cfg.animation.hopMs;
    const tok = this.tokens[player]!;
    return new Promise((done) => {
      let i = 0;
      let t = 0;
      let start = tok.position.clone();
      let settle = 0;
      this.tweens.push((dt) => {
        if (i >= path.length) {
          if (this.reduced || settle >= 1) {
            tok.scale.set(1, 1, 1);
            done();
            return false;
          }
          settle = Math.min(1, settle + (dt * 1000) / 140);
          const s = 1 - 0.18 * Math.sin(settle * Math.PI);
          tok.scale.set(2 - s, s, 2 - s);
          return true;
        }
        t += dt * 1000;
        const f = Math.min(1, t / ms);
        tok.position.lerpVectors(start, path[i]!, f);
        if (!this.reduced) {
          tok.position.y += Math.sin(f * Math.PI) * TOKEN_LIFT;
          const stretch = 1 + 0.14 * Math.sin(f * Math.PI);
          tok.scale.set(1 / Math.sqrt(stretch), stretch, 1 / Math.sqrt(stretch));
        }
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
    const ms = (this.reduced ? 1 : 3) * this.cfg.animation.hopMs;
    return new Promise((done) => {
      let t = 0;
      this.tweens.push((dt) => {
        t += dt * 1000;
        const f = Math.min(1, t / ms);
        tok.position.lerpVectors(start, to, 1 - (1 - f) ** 2);
        if (f >= 1) {
          done();
          return false;
        }
        return true;
      });
    });
  }

  // Benchmark only: every token keeps hopping round the board and the dice keep rolling.
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
    if (this.pops.size && this.layoutInstances(performance.now())) this.dirty = true;
    if (this.highlighted.length) {
      (this.highlights.material as THREE.MeshBasicMaterial).opacity = 0.3 + 0.2 * Math.sin(performance.now() / 220);
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

// Six die faces in a 3 by 2 grid on one canvas: 1 2 3 / 4 5 6.
function diceAtlas(bg: string, pip: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 192;
  c.height = 128;
  const g = c.getContext('2d')!;
  const spots: Record<number, Array<[number, number]>> = {
    1: [[32, 32]], 2: [[18, 18], [46, 46]], 3: [[18, 18], [32, 32], [46, 46]],
    4: [[18, 18], [46, 18], [18, 46], [46, 46]], 5: [[18, 18], [46, 18], [32, 32], [18, 46], [46, 46]],
    6: [[18, 16], [46, 16], [18, 32], [46, 32], [18, 48], [46, 48]],
  };
  for (let v = 1; v <= 6; v++) {
    const ox = ((v - 1) % 3) * 64, oy = Math.floor((v - 1) / 3) * 64;
    g.fillStyle = bg;
    g.fillRect(ox, oy, 64, 64);
    g.fillStyle = pip;
    for (const [x, y] of spots[v]!) {
      g.beginPath();
      g.arc(ox + x, oy + y, 6, 0, Math.PI * 2);
      g.fill();
    }
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
