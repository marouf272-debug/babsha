// The game screen (S4 greybox): setup, top strip, board, player strip, log, action bar and the
// sheets for deed, auction, manage, trade, cards, debt, hand-off and game over (plan 3.5).
// All text comes from the language files; all rules come from the engine.

import { emptyMemory, type Ai, type AiMemory, type AiProfile } from '../ai';
import type { Action, Engine, GameEvent, GameState, Tile, TradeOffer } from '../engine';
import { getLang, money, num, setLang, t, tIn } from '../i18n';
import { BoardScene, type SceneText } from '../scene/board';
import type { SceneConfig } from '../scene/config';
import { cardText, describeLines, findCard, playerName, tileName } from './describe';
import { cueFor } from '../audio/cues';
import { Sfx } from '../audio/sfx';
import { cardArt } from './cardArt';
import { icon } from './icons';
import { h } from './dom';
import { textOn } from './contrast';
import { Session, type SeatKind } from './session';
import { clearSave, deviceStorage, loadSave, writeSave, type GameSettings, type SaveGame } from './save';

export interface AppOptions {
  root: HTMLElement;
  engine: Engine;
  ai: Ai;
  profiles: Record<'easy' | 'medium' | 'hard', AiProfile>;
  sceneConfig: SceneConfig;
  test: boolean;
  // Show the frame-rate readout during play (?fps=1).
  fps: boolean;
}

interface TradeDraft {
  to: number | null;
  give: Set<string>;
  get: Set<string>;
  giveCash: number;
  getCash: number;
  error: boolean;
}

const SEAT_KINDS: SeatKind[] = ['human', 'easy', 'medium', 'hard'];
const FONT = '"Noto Sans Bengali", system-ui, sans-serif';

export class App {
  private session: Session | null = null;
  private scene: BoardScene | null = null;
  private setup = { count: 2, seats: ['human', 'human', 'human', 'human', 'human', 'human'] as SeatKind[], startCash: 0, timer: false };
  private panel: 'manage' | 'trade' | null = null;
  // Which management move the manage sheet lists (FR-17 buttons), or all of them in DEBT.
  private mode: 'BUILD' | 'SELL_BUILDING' | 'MORTGAGE' | 'REDEEM' | null = null;
  private draft: TradeDraft = emptyDraft();
  // D-89: every logged event, kept raw so the log redraws in either language.
  private events: GameEvent[] = [];
  // D-88: the details popup for a tile, a player, or the full log.
  private info: { kind: 'tile'; id: string } | { kind: 'player'; player: number } | { kind: 'log' } | null = null;
  private lastRoll: number[] | null = null;
  private cards: Array<{ player: number; deck: 'lucky' | 'dohs'; cardId: string }> = [];
  private revealedTrade: string | null = null;
  private confirmBankrupt = false;
  // FR-19: after a resume with several people on one phone, cover the board until someone taps.
  private resumeCover = false;
  private settings: GameSettings = { timer: false };
  // FR-14: the running turn timer for the human who must decide now (D-34).
  private clock: { deadline: number; tick: number } | null = null;
  private playing: Promise<void> = Promise.resolve();
  private readonly els: Record<string, HTMLElement> = {};
  private suggestMemory: AiMemory = emptyMemory();
  private readonly sfx: Sfx;
  private suggestRng = 7;

  constructor(private readonly o: AppOptions) {
    let muted = o.test;
    try { muted = o.test || localStorage.getItem('babsha.sound') === 'off'; } catch { /* storage may be blocked */ }
    this.sfx = new Sfx(muted);
    // Phones only start audio after a tap.
    if (!o.test) document.addEventListener('pointerdown', () => this.sfx.unlock(), { once: false, passive: true });
    document.documentElement.lang = getLang();
    const { settings, startCash } = o.engine.rules.config;
    this.setup.startCash = startCash;
    this.setup.timer = settings.timerDefaultOn;
    this.renderSetup();
  }

  // Test mode only: the move the Medium computer player would make for the human who must act.
  // The end-to-end test then presses the matching button, so a whole game runs through the UI.
  suggest(): Action | null {
    const session = this.session;
    if (!session) return null;
    const who = session.actor();
    if (who === null || !session.isHuman(who)) return null;
    const d = this.o.ai.decide({ state: session.state, player: who, profile: this.o.profiles.medium, memory: this.suggestMemory, rng: this.suggestRng });
    this.suggestMemory = d.memory;
    this.suggestRng = d.rng;
    return d.action;
  }

  // Test mode only: the tiles currently highlighted for tapping, with their screen points.
  tapTargetsForTest(): Array<{ id: string; x: number; y: number }> {
    return this.tapTargets().map((id) => ({ id, ...this.scene!.tileScreenPoint(id) }));
  }

  // Test mode only: houses on a tile.
  housesForTest(tileId: string): number {
    return this.session?.state.properties[tileId]?.houses ?? 0;
  }

  // ---------- setup ----------

  private renderSetup(): void {
    this.stopClock();
    this.scene?.dispose();
    this.scene = null;
    this.session = null;
    const { root } = this.o;
    root.replaceChildren();
    const seats = h('div', { class: 'seats' });
    for (let i = 0; i < this.setup.count; i++) {
      const select = h('select', { 'data-testid': `seat-${i}`, onchange: (e) => { this.setup.seats[i] = (e.target as HTMLSelectElement).value as SeatKind; } });
      for (const k of SEAT_KINDS) select.append(h('option', { value: k, selected: this.setup.seats[i] === k }, t(`seat.${k}`)));
      seats.append(h('label', { class: 'seat' }, h('span', { class: 'swatch', style: `background:${this.color(i)}` }), h('span', { class: 'seat-name' }, playerName(i)), select));
    }
    const counts = h('div', { class: 'counts', role: 'group' });
    for (let n = this.o.engine.rules.config.players.min; n <= this.o.engine.rules.config.players.max; n++) {
      counts.append(h('button', { class: n === this.setup.count ? 'chip on' : 'chip', 'data-testid': `count-${n}`, onclick: () => { this.setup.count = n; this.renderSetup(); } }, num(n)));
    }
    // FR-14: start cash and the optional turn timer.
    const { settings } = this.o.engine.rules.config;
    const cash = h('div', { class: 'counts', role: 'group', 'aria-label': t('setup.startCash') });
    for (const n of settings.startCashOptions) {
      cash.append(h('button', { class: n === this.setup.startCash ? 'chip on' : 'chip', 'data-testid': `cash-${n}`, 'aria-pressed': n === this.setup.startCash ? 'true' : 'false', onclick: () => { this.setup.startCash = n; this.renderSetup(); } }, money(n)));
    }
    const timer = h('div', { class: 'counts', role: 'group', 'aria-label': t('setup.timer') });
    for (const on of [false, true]) {
      timer.append(h('button', { class: on === this.setup.timer ? 'chip on' : 'chip', 'data-testid': `timer-${on ? 'on' : 'off'}`, 'aria-pressed': on === this.setup.timer ? 'true' : 'false', onclick: () => { this.setup.timer = on; this.renderSetup(); } },
        on ? t('setup.timerOn', { seconds: num(settings.timerSeconds) }) : t('setup.timerOff')));
    }
    const saved = loadSave(deviceStorage(), this.o.engine);
    root.append(h('div', { class: 'setup' },
      h('div', { class: 'setup-top' }, h('h1', {}, t('app.title')), this.langButton()),
      saved ? this.continueCard(saved) : null,
      h('h2', {}, t('setup.heading')),
      h('div', { class: 'field-label' }, t('setup.players')),
      counts,
      seats,
      h('div', { class: 'field-label' }, t('setup.startCash')),
      cash,
      h('div', { class: 'field-label' }, t('setup.timer')),
      timer,
      h('button', { class: 'primary big', 'data-testid': 'start', onclick: () => this.start() }, t('setup.start')),
    ));
    document.title = t('app.title');
  }

  // FR-19: the saved game, with who plays and how far it got.
  private continueCard(save: SaveGame): HTMLElement {
    const humans = save.seats.filter((k) => k === 'human').length;
    const when = new Intl.DateTimeFormat(getLang() === 'bn' ? 'bn-BD' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(save.savedAt);
    return h('div', { class: 'continue', 'data-testid': 'saved-game' },
      h('h2', {}, t('save.heading')),
      h('p', {}, t('save.summary', { players: num(save.seats.length), humans: num(humans), turn: num(save.state.turnCount + 1) })),
      h('p', { class: 'note' }, t('save.when', { when })),
      h('button', { class: 'primary big', 'data-testid': 'continue', onclick: () => this.resume(save) }, t('save.continue')));
  }

  private resume(save: SaveGame): void {
    this.settings = { ...save.settings };
    this.begin(new Session({
      engine: this.o.engine, ai: this.o.ai, profiles: this.o.profiles, seats: save.seats, seed: save.seed, resume: save,
      aiDelayMs: this.o.test ? 0 : 650,
      schedule: (fn, ms) => { void this.playing.then(() => setTimeout(fn, ms)); },
    }), save.events);
    const s = this.session!;
    const who = s.actor();
    this.resumeCover = s.humanCount >= 2 && who !== null && s.isHuman(who) && s.state.turn.phase !== 'START_TURN';
    this.render();
  }

  private start(): void {
    const seats = this.setup.seats.slice(0, this.setup.count);
    const seed = this.o.test ? 4242 : (Date.now() & 0x7fffffff);
    this.settings = { timer: this.setup.timer };
    this.begin(new Session({
      engine: this.o.engine, ai: this.o.ai, profiles: this.o.profiles, seats, seed, startCash: this.setup.startCash,
      aiDelayMs: this.o.test ? 0 : 650,
      // Computer moves wait for the board animation to finish.
      schedule: (fn, ms) => { void this.playing.then(() => setTimeout(fn, ms)); },
    }), []);
  }

  private begin(session: Session, events: GameEvent[]): void {
    this.session = session;
    this.events = [...events];
    this.resumeCover = false;
    this.info = null;
    this.lastRoll = null;
    this.cards = [];
    this.panel = null;
    this.draft = emptyDraft();
    this.buildGameShell();
    session.subscribe((u) => this.onUpdate(u.state, u.events));
    session.start();
  }

  // ---------- game shell ----------

  private buildGameShell(): void {
    const { root } = this.o;
    root.replaceChildren();
    const canvas = h('canvas', { class: 'board', 'data-testid': 'board' });
    const names = ['top', 'players', 'log', 'actions', 'sheet', 'overlay', 'panel'];
    for (const n of names) this.els[n] = h('div', { class: n });
    this.els['board'] = h('div', { class: 'board-wrap' }, canvas);
    root.append(h('div', { class: 'game' },
      this.els['top']!,
      this.els['players']!,
      this.els['board'],
      h('div', { class: 'side' }, this.els['panel']!, this.els['log']!, this.els['actions']!),
    ));
    this.placePopups();
    this.wide.addEventListener('change', () => this.placePopups());
    const fps = this.o.fps ? h('div', { class: 'fps' }) : null;
    if (fps) root.append(fps);
    this.scene = new BoardScene(canvas, this.o.engine.rules, this.o.sceneConfig, () => this.sceneText(), { instant: this.o.test, fps });
    new ResizeObserver(() => this.scene?.resize()).observe(canvas);
    // D-71: tap a highlighted tile to build, sell, mortgage or redeem there.
    // D-88: tapping any other tile shows its details.
    canvas.addEventListener('pointerup', (e) => {
      const id = this.scene?.pickTile(e.clientX, e.clientY);
      if (!id) return;
      if (this.mode && this.tapTargets().includes(id)) this.act({ type: this.mode, tileId: id });
      else this.openInfo({ kind: 'tile', id });
    });
    this.els['log']!.setAttribute('data-testid', 'log');
    this.els['log']!.addEventListener('click', () => this.openInfo({ kind: 'log' }));
  }

  // Pop-ups go in the right panel on desktop, and as small cards over the board on a phone.
  private readonly wide = window.matchMedia('(min-width: 900px) and (orientation: landscape)');

  private placePopups(): void {
    const host = this.wide.matches ? this.els['panel']! : this.els['board']!;
    for (const n of ['sheet', 'overlay']) if (this.els[n]!.parentElement !== host) host.append(this.els[n]!);
    this.scene?.resize();
  }

  private sceneText(): SceneText {
    const rules = this.o.engine.rules;
    return {
      font: FONT,
      tileName: (tile: Tile) => t(tile.nameKey),
      signName: (tile: Tile) => tIn('bn', tile.nameKey),
      tileNote: (tile: Tile) => {
        if (tile.type === 'property' || tile.type === 'hub' || tile.type === 'utility') return money(this.o.engine.quote(this.session!.state, tile.id).price);
        if (tile.type === 'tax') return money(rules.config.tax[tile.tax!] ?? 0);
        return '';
      },
    };
  }

  private onUpdate(state: GameState, events: GameEvent[]): void {
    for (const e of events) {
      if (describeLines(e, state, this.o.engine.rules).length) this.events.push(e);
      // A roll ends any management the player was doing before it.
      if (e.type === 'diceRolled') { this.panel = null; this.mode = null; }
      if (e.type === 'cardDrawn') this.cards.push({ player: e.player, deck: e.deck, cardId: e.cardId });
      if (e.type === 'diceRolled') this.lastRoll = e.dice;
      if (e.type === 'turnPassed' || e.type === 'tradeAccepted' || e.type === 'tradeRejected') this.panel = null;
    }
    this.events = this.events.slice(-600);
    this.confirmBankrupt = false;
    // Every change is a new decision, so the turn timer starts again (D-34: per decision).
    this.stopClock();
    // FR-19: save after every change; a finished game is not kept.
    if (state.turn.phase === 'GAME_OVER') clearSave(deviceStorage());
    else if (this.session) writeSave(deviceStorage(), this.session.snapshot(this.settings, this.events));
    // Computer card draws are shown briefly; a human dismisses their own card.
    const scene = this.scene;
    this.playing = this.playing.then(() => {
      this.sounds(events);
      return scene?.play(events, state);
    });
    this.render();
  }

  // Plays the sound for each event, timed to the board animation (dice first, then each hop).
  private sounds(events: GameEvent[]): void {
    const { diceMs, hopMs } = this.o.sceneConfig.animation;
    let at = 0;
    for (const e of events) {
      const cue = cueFor(e);
      if (!cue) continue;
      if (e.type === 'moved') {
        for (let k = 0; k < Math.min(Math.abs(e.steps), 12); k++) this.sfx.play('hop', (at + (k + 1) * hopMs) / 1000);
        at += Math.abs(e.steps) * hopMs;
      } else {
        this.sfx.play(cue, at / 1000);
        if (e.type === 'diceRolled') at += diceMs;
      }
    }
  }

  render(): void {
    if (!this.session) return this.renderSetup();
    const s = this.session.state;
    this.renderTop(s);
    this.renderPlayers(s);
    // The side panel on a computer has room for more recent lines than a phone.
    this.els['log']!.replaceChildren(...this.logLines().slice(this.wide.matches ? -10 : -2).map((l) => h('div', { class: 'log-line' }, l)));
    this.renderActions(s);
    this.renderSheet(s);
    this.renderOverlay(s);
    this.scene?.setHighlights(this.tapTargets());
    this.syncClock(s);
  }

  // ---------- turn timer (FR-14, D-34, D-52) ----------

  // Runs while a human must make a decision that has a passive choice, once the phone is theirs.
  private syncClock(s: GameState): void {
    const session = this.session;
    const who = session?.actor() ?? null;
    const live = !!session && this.settings.timer && who !== null && session.isHuman(who) && !this.needsHandoff(s, who) && this.o.engine.passiveAction(s, who) !== null;
    if (!live) return this.stopClock();
    if (!this.clock) {
      const deadline = Date.now() + this.o.engine.rules.config.settings.timerSeconds * 1000;
      this.clock = { deadline, tick: window.setInterval(() => (Date.now() >= deadline ? this.expireClock() : this.showClock()), 250) };
    }
    this.showClock();
  }

  private stopClock(): void {
    if (this.clock) window.clearInterval(this.clock.tick);
    this.clock = null;
    const el = this.els['top']?.querySelector<HTMLElement>('[data-testid="timer"]');
    if (el) el.hidden = true;
  }

  private showClock(): void {
    const el = this.els['top']?.querySelector<HTMLElement>('[data-testid="timer"]');
    if (!el || !this.clock) return;
    const left = Math.max(0, Math.ceil((this.clock.deadline - Date.now()) / 1000));
    el.hidden = false;
    el.classList.toggle('low', left <= 5);
    el.setAttribute('aria-label', t('timer.label', { seconds: num(left) }));
    el.lastChild!.textContent = num(left);
  }

  // Time is up: take the passive choice for whoever must decide (decline, fold, end turn, reject).
  private expireClock(): void {
    this.stopClock();
    const session = this.session;
    const who = session?.actor() ?? null;
    if (!session || who === null || !session.isHuman(who)) return;
    const passive = this.o.engine.passiveAction(session.state, who);
    if (!passive) return;
    this.panel = null;
    this.mode = null;
    this.info = null;
    this.act(passive);
  }

  // Tiles the chosen management move can use right now, for highlighting and tapping.
  private tapTargets(): string[] {
    const session = this.session;
    if (!session || this.panel !== 'manage' || !this.mode) return [];
    const who = session.actor();
    if (who === null || !session.isHuman(who) || !canManage(session.state)) return [];
    return session.legalFor(who).filter((a) => a.type === this.mode && 'tileId' in a).map((a) => (a as { tileId: string }).tileId);
  }

  private langButton(): HTMLElement {
    return h('button', { class: 'chip', 'data-testid': 'lang', onclick: () => this.toggleLang() }, t('lang.toggle'));
  }

  private soundButton(): HTMLElement {
    const on = !this.sfx.muted;
    const label = on ? t('sound.on') : t('sound.off');
    const b = h('button', { class: 'chip icon', 'data-testid': 'sound', 'aria-label': label, title: label, 'aria-pressed': on ? 'true' : 'false', onclick: () => {
      this.sfx.setMuted(!this.sfx.muted);
      this.sfx.unlock();
      try { localStorage.setItem('babsha.sound', this.sfx.muted ? 'off' : 'on'); } catch { /* storage may be blocked */ }
      this.render();
    } });
    b.append(icon(on ? 'soundOn' : 'soundOff', 20));
    return b;
  }

  private toggleLang(): void {
    setLang(getLang() === 'en' ? 'bn' : 'en');
    document.documentElement.lang = getLang();
    document.title = t('app.title');
    try { localStorage.setItem('babsha.lang', getLang()); } catch { /* storage may be blocked */ }
    this.scene?.refreshText();
    this.render();
  }

  private renderTop(s: GameState): void {
    const label = s.turn.phase === 'GAME_OVER' ? t('over.title', { name: playerName(s.winner!) }) : t('hud.turn', { name: playerName(s.turn.active) });
    this.els['top']!.replaceChildren(
      h('div', { class: 'turn', 'data-testid': 'turn' }, label),
      ...(this.settings.timer ? [h('div', { class: 'timer', 'data-testid': 'timer', role: 'timer', hidden: true }, icon('timer', 18), h('span', {}, ''))] : []),
      this.langButton(),
      this.soundButton(),
      this.logButton(),
      h('button', { class: 'chip icon', 'data-testid': 'new-game', 'aria-label': t('menu.newGame'), title: t('menu.newGame'), onclick: () => { if (this.o.test || window.confirm(t('menu.confirmNew'))) this.renderSetup(); } }, icon('newGame', 20)),
    );
  }

  // Player cards in two columns with the last roll between them (style guide 3).
  private renderPlayers(s: GameState): void {
    const session = this.session!;
    const pips: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
    const die = (v: number) => h('div', { class: 'die', 'aria-label': num(v) }, ...Array.from({ length: 9 }, (_, k) => h('i', { class: pips[v]?.includes(k) ? 'on' : '' })));
    const roll = h('div', { class: 'roll', 'data-testid': 'last-roll' }, ...(this.lastRoll ?? []).map(die));
    const rows = Math.ceil(s.players.length / 2);
    roll.style.gridRow = `1 / span ${rows}`;
    this.els['players']!.replaceChildren(roll, ...s.players.map((p, i) => h('div', {
      class: `player ${i % 2 === 0 ? 'left' : 'right'}${i === s.turn.active ? ' active' : ''}${p.bankrupt ? ' out' : ''}`, 'data-testid': `player-${i}`,
      style: `grid-row:${Math.floor(i / 2) + 1}`, role: 'button', tabindex: 0,
      onclick: () => this.openInfo({ kind: 'player', player: i }),
      onkeydown: (e) => { if ((e as KeyboardEvent).key === 'Enter') this.openInfo({ kind: 'player', player: i }); },
    },
    h('span', { class: 'swatch', style: `background:${this.color(i)}` }),
    h('span', { class: 'pname' }, playerName(i)),
    h('span', { class: 'cash' }, money(p.cash)),
    h('span', { class: 'flags' }, p.bankrupt ? t('hud.bankrupt') : p.inJam ? t('hud.inJam') : session.isHuman(i) ? '' : t(`seat.${session.seats[i]}`)),
    )));
  }

  // ---------- action bar ----------

  // FR-17: a fixed bar of Build, Sell, Mortgage, Redeem and Trade, plus the move of the moment
  // (Roll, Jam options or End turn) above it.
  private renderActions(s: GameState): void {
    const session = this.session!;
    const bar = this.els['actions']!;
    const who = session.actor();
    const human = who !== null && session.isHuman(who) && s.turn.phase !== 'GAME_OVER';
    const legal = human ? session.legalFor(who) : [];
    const has = (type: Action['type']) => legal.some((a) => a.type === type);
    const main: HTMLElement[] = [];
    if (who !== null && !session.isHuman(who) && s.turn.phase !== 'GAME_OVER') main.push(h('div', { class: 'thinking' }, t('hud.thinking', { name: playerName(who) })));
    if (human && s.turn.phase === 'ROLL') {
      main.push(this.actButton(t('action.roll'), { type: 'ROLL' }, 'primary'));
      if (has('PAY_JAM_FINE')) main.push(this.actButton(t('action.payFine', { amount: money(this.o.engine.rules.config.jam.fine) }), { type: 'PAY_JAM_FINE' }));
      if (has('USE_JAM_CARD')) main.push(this.actButton(t('action.useCard'), { type: 'USE_JAM_CARD' }));
    } else if (human && s.turn.phase === 'MANAGE' && !s.trade) {
      main.push(this.actButton(t('action.endTurn'), { type: 'END_TURN' }, 'primary'));
    }
    // D-87: the tools work at any point of your own turn: before rolling, while buying, after moving.
    const manage = human && canManage(s);
    const tool = (testid: string, label: string, mode: App['mode']) => h('button', {
      class: `tool${this.panel === 'manage' && this.mode === mode ? ' on' : ''}`, 'data-testid': testid,
      disabled: !manage || !has(mode!),
      onclick: () => { const same = this.panel === 'manage' && this.mode === mode; this.panel = same ? null : 'manage'; this.mode = same ? null : mode; this.render(); },
    }, label);
    const others = s.players.some((p, i) => i !== who && !p.bankrupt);
    const tools = h('div', { class: 'tools' },
      tool('act-build', t('action.build'), 'BUILD'),
      tool('act-sell', t('action.sell'), 'SELL_BUILDING'),
      tool('act-mortgage', t('action.mortgage'), 'MORTGAGE'),
      tool('act-redeem', t('action.redeem'), 'REDEEM'),
      h('button', {
        class: `tool trade${this.panel === 'trade' ? ' on' : ''}`, 'data-testid': 'act-trade', disabled: !manage || !others,
        onclick: () => { this.panel = this.panel === 'trade' ? null : 'trade'; this.draft = emptyDraft(); this.render(); },
      }, t('action.trade')),
    );
    bar.replaceChildren(h('div', { class: 'main-row' }, ...main), tools);
  }

  private actButton(label: string, action: Action, cls = '', disabled = false): HTMLElement {
    return h('button', {
      class: cls, disabled, 'data-action': JSON.stringify(action),
      onclick: () => this.act(action),
    }, label);
  }

  private act(action: Action): void {
    try {
      this.session!.act(action);
    } catch (err) {
      console.error(err);
    }
  }

  // ---------- sheets ----------

  private renderSheet(s: GameState): void {
    const sheet = this.els['sheet']!;
    const session = this.session!;
    const who = session.actor();
    sheet.replaceChildren();
    sheet.hidden = true;
    sheet.classList.remove('compact');
    if (s.turn.phase === 'GAME_OVER' || this.cards.length) return;
    // D-88: details are open to everyone at any time, and sit on top until closed.
    if (this.info) {
      sheet.hidden = false;
      sheet.append(this.infoSheet(s, this.info));
      return;
    }
    if (who === null || !session.isHuman(who) || this.needsHandoff(s, who)) return;
    const free = canManage(s);
    let body: HTMLElement | null = null;
    if (s.trade && s.trade.to === who) body = this.tradeAnswer(s, s.trade);
    else if (free && this.panel === 'manage') body = this.manageSheet(s, who, true);
    else if (free && this.panel === 'trade') body = this.tradeSheet(s, who);
    else if (s.turn.phase === 'BUY_DECISION') body = this.deedSheet(s, who);
    else if (s.turn.phase === 'AUCTION') body = this.auctionSheet(s, who);
    else if (s.turn.phase === 'DEBT' && this.panel === 'trade') body = this.tradeSheet(s, who);
    else if (s.turn.phase === 'DEBT') body = this.debtSheet(s, who);
    if (body) {
      sheet.hidden = false;
      // The manage list is a short sheet so the highlighted tiles stay visible above it.
      sheet.classList.toggle('compact', free && this.panel === 'manage');
      sheet.append(body);
    }
  }

  private deedSheet(s: GameState, who: number): HTMLElement {
    const id = s.turn.pendingTile!;
    const q = this.o.engine.quote(s, id);
    const canBuy = this.session!.legalFor(who).some((a) => a.type === 'BUY');
    return h('div', { 'data-testid': 'deed' },
      this.deedCard(this.tile(id)),
      h('div', { class: 'row' },
        this.actButton(t('deed.buy', { amount: money(q.price) }), { type: 'BUY' }, 'primary', !canBuy),
        this.actButton(t('deed.auction'), { type: 'DECLINE' }),
      ));
  }

  // FR-03: price, mortgage value and rent schedule.
  private deedCard(tile: Tile): HTMLElement {
    const rules = this.o.engine.rules;
    const q = this.o.engine.quote(this.session!.state, tile.id);
    const rows: Array<[string, string]> = [];
    if (tile.type === 'property') {
      tile.rent!.forEach((r, i) => rows.push([t(`deed.level.${i}`), money(r)]));
    } else if (tile.type === 'hub') {
      rules.config.hub.rentByHubsOwned.forEach((r, i) => rows.push([t('deed.owning', { n: num(i + 1) }), money(r)]));
    } else {
      rules.config.utility.diceMultiplierByUtilitiesOwned.forEach((m, i) => rows.push([t('deed.owning', { n: num(i + 1) }), t('deed.diceTimes', { n: num(m) })]));
    }
    return h('div', { class: 'deed' },
      h('div', { class: 'deed-head', style: tile.group ? this.groupStyle(tile.group) : '' },
        tile.group ? `${this.o.sceneConfig.groupSymbols[tile.group]} ` : '', t(tile.nameKey)),
      h('div', { class: 'kv' }, h('span', {}, t('deed.price')), h('span', {}, money(q.price))),
      h('div', { class: 'kv' }, h('span', {}, t('deed.mortgage')), h('span', {}, money(q.mortgageValue))),
      h('div', { class: 'kv sub' }, h('span', {}, t('deed.rent'))),
      h('div', { class: 'rent-grid' }, ...rows.map(([a, b]) => h('div', { class: 'kv' }, h('span', {}, a), h('span', {}, b)))),
      tile.type === 'property' ? h('div', { class: 'note' }, t('deed.fullSet')) : null,
    );
  }

  // FR-04, D-62: one bidder at a time.
  private auctionSheet(s: GameState, who: number): HTMLElement {
    const a = s.auction!;
    const legal = this.session!.legalFor(who);
    const bid = legal.find((x) => x.type === 'BID') as Extract<Action, { type: 'BID' }> | undefined;
    const cash = s.players[who]!.cash;
    const quick = bid ? [bid.amount, bid.amount + 500, bid.amount + 1000].filter((v, i, arr) => v <= cash && arr.indexOf(v) === i) : [];
    const slider = bid ? h('input', { type: 'range', min: bid.amount, max: cash, step: 100, value: bid.amount, 'data-testid': 'bid-slider' }) as HTMLInputElement : null;
    const sliderBtn = slider ? h('button', { 'data-testid': 'bid-custom', onclick: () => this.act({ type: 'BID', player: who, amount: Number(slider.value) }) }, t('auction.bid', { amount: money(Number(slider.value)) })) : null;
    if (slider && sliderBtn) slider.addEventListener('input', () => { sliderBtn.textContent = t('auction.bid', { amount: money(Number(slider.value)) }); });
    return h('div', { 'data-testid': 'auction' },
      h('div', { class: 'band auction' }, t('auction.title', { tile: tileName(this.o.engine.rules, a.tileId) })),
      h('div', { class: 'status' }, a.highBidder === null ? t('auction.none') : t('auction.high', { amount: money(a.highBid!), name: playerName(a.highBidder) })),
      h('div', { class: 'who' }, t('auction.yourBid', { name: playerName(who) })),
      h('div', { class: 'row wrap' }, ...quick.map((v) => this.actButton(t('auction.bid', { amount: money(v) }), { type: 'BID', player: who, amount: v }, v === quick[0] ? 'primary' : ''))),
      slider ? h('div', { class: 'row' }, slider, sliderBtn) : null,
      h('div', { class: 'row' }, this.actButton(t('auction.fold'), { type: 'FOLD', player: who })),
    );
  }

  // FR-06, FR-07: build, sell, mortgage and redeem per property.
  private manageSheet(s: GameState, who: number, closable: boolean): HTMLElement {
    const legal = this.session!.legalFor(who);
    const mine = this.o.engine.rules.tiles.filter((x) => s.properties[x.id]?.owner === who);
    const rows = mine.filter((tile) => !closable || this.mode === null || legal.some((a) => a.type === this.mode && 'tileId' in a && a.tileId === tile.id)).map((tile) => {
      const prop = s.properties[tile.id]!;
      const q = this.o.engine.quote(s, tile.id);
      const allowed = (type: Action['type']) => !closable || this.mode === null || this.mode === type;
      const can = (type: Action['type']) => allowed(type) && legal.some((a) => a.type === type && 'tileId' in a && a.tileId === tile.id);
      const level = prop.mortgaged ? t('manage.mortgaged') : tile.type === 'property' ? t(`deed.level.${Math.min(prop.houses, 5)}`) : '';
      const btns: HTMLElement[] = [];
      if (can('BUILD')) btns.push(this.actButton(t('manage.build', { amount: money(q.buildCost!) }), { type: 'BUILD', tileId: tile.id }));
      if (can('SELL_BUILDING')) btns.push(this.actButton(t('manage.sell', { amount: money(q.sellRefund!) }), { type: 'SELL_BUILDING', tileId: tile.id }));
      if (can('MORTGAGE')) btns.push(this.actButton(t('manage.mortgage', { amount: money(q.mortgageValue) }), { type: 'MORTGAGE', tileId: tile.id }));
      if (can('REDEEM')) btns.push(this.actButton(t('manage.redeem', { amount: money(q.redeemCost) }), { type: 'REDEEM', tileId: tile.id }));
      return h('div', { class: 'prop' },
        h('div', { class: 'prop-name' }, tile.group ? h('span', { class: 'swatch', style: `background:${this.o.sceneConfig.colors.groups[tile.group]}` }) : null, t(tile.nameKey), h('span', { class: 'level' }, level)),
        h('div', { class: 'row wrap' }, ...btns));
    });
    return h('div', { 'data-testid': 'manage' },
      closable ? h('div', { class: 'band manage' }, t('manage.title', { name: playerName(who) })) : h('h3', {}, t('manage.title', { name: playerName(who) })),
      closable && this.mode ? h('div', { class: 'note' }, t('manage.tapHint')) : null,
      rows.length ? h('div', { class: 'props' }, ...rows) : h('div', { class: 'note' }, t('manage.none')),
      closable ? h('div', { class: 'row' }, h('button', { 'data-testid': 'manage-close', onclick: () => { this.panel = null; this.mode = null; this.render(); } }, t('action.close'))) : null,
    );
  }

  // FR-08: compose an offer.
  private tradeSheet(s: GameState, who: number): HTMLElement {
    const d = this.draft;
    const others = s.players.map((_, i) => i).filter((i) => i !== who && !s.players[i]!.bankrupt);
    const pick = h('div', { class: 'row wrap' }, ...others.map((o) => h('button', {
      class: d.to === o ? 'chip on' : 'chip', 'data-testid': `trade-to-${o}`,
      onclick: () => { this.draft = { ...emptyDraft(), to: o }; this.render(); },
    }, h('span', { class: 'swatch', style: `background:${this.color(o)}` }), playerName(o))));
    const tileList = (owner: number, set: Set<string>, side: 'give' | 'get') => h('div', { class: 'checks' },
      ...this.o.engine.rules.tiles.filter((x) => s.properties[x.id]?.owner === owner).map((tile) => {
        const box = h('input', { type: 'checkbox', checked: set.has(tile.id), 'data-testid': `trade-${side}-${tile.id}`, onchange: () => { if (set.has(tile.id)) set.delete(tile.id); else set.add(tile.id); d.error = false; } });
        return h('label', { class: 'check' }, box, this.tileTag(tile));
      }));
    const cashInput = (key: 'giveCash' | 'getCash', max: number) => h('input', {
      type: 'number', min: 0, max, step: 100, value: d[key], inputmode: 'numeric', 'data-testid': `trade-${key}`,
      oninput: (e) => { d[key] = Math.max(0, Math.floor(Number((e.target as HTMLInputElement).value) || 0)); d.error = false; },
    });
    const body = h('div', { 'data-testid': 'trade' }, h('div', { class: 'band trade' }, t('trade.title')), h('div', { class: 'field-label' }, t('trade.with')), pick);
    if (d.to === null) {
      body.append(h('div', { class: 'note' }, t('trade.choose')));
    } else {
      body.append(
        h('div', { class: 'cols' },
          h('div', {}, h('div', { class: 'field-label' }, t('trade.theyGive', { name: playerName(who) })), tileList(who, d.give, 'give'), h('label', { class: 'cash-in' }, t('trade.cash'), cashInput('giveCash', s.players[who]!.cash))),
          h('div', {}, h('div', { class: 'field-label' }, t('trade.theyGive', { name: playerName(d.to) })), tileList(d.to, d.get, 'get'), h('label', { class: 'cash-in' }, t('trade.cash'), cashInput('getCash', s.players[d.to]!.cash))),
        ),
        h('div', { class: 'error', hidden: !d.error }, d.error ? t('trade.invalid') : ''),
        h('div', { class: 'row' }, h('button', { class: 'primary', 'data-testid': 'trade-propose', onclick: () => this.propose(who) }, t('trade.propose'))),
      );
    }
    body.append(h('div', { class: 'row' }, h('button', { 'data-testid': 'trade-cancel', onclick: () => { this.panel = null; this.render(); } }, t('action.cancel'))));
    return body;
  }

  private propose(who: number): void {
    const d = this.draft;
    if (d.to === null) return;
    const offer: Omit<TradeOffer, 'from'> = { to: d.to, giveTiles: [...d.give], getTiles: [...d.get], giveCash: d.giveCash, getCash: d.getCash };
    if (this.session!.tradeProblem(offer) !== null) {
      d.error = true;
      this.render();
      return;
    }
    this.panel = null;
    this.act({ type: 'PROPOSE_TRADE', player: who, offer });
  }

  private tradeAnswer(s: GameState, o: TradeOffer): HTMLElement {
    const list = (ids: string[], cash: number) => {
      const items = [
        ...ids.map((id) => h('li', {}, this.tileTag(this.tile(id)))),
        ...(cash > 0 ? [h('li', {}, money(cash))] : []),
      ];
      return h('ul', { class: 'trade-list' }, ...(items.length ? items : [h('li', {}, t('trade.nothing'))]));
    };
    return h('div', { 'data-testid': 'trade-answer' },
      h('div', { class: 'band trade' }, t('trade.offerFrom', { name: playerName(o.from), other: playerName(o.to) })),
      h('div', { class: 'cols' },
        h('div', {}, h('div', { class: 'field-label' }, t('trade.theyGive', { name: playerName(o.from) })), list(o.giveTiles, o.giveCash)),
        h('div', {}, h('div', { class: 'field-label' }, t('trade.theyGive', { name: playerName(o.to) })), list(o.getTiles, o.getCash)),
      ),
      h('div', { class: 'row' },
        this.actButton(t('trade.accept'), { type: 'ACCEPT_TRADE', player: o.to }, 'primary'),
        this.actButton(t('trade.reject'), { type: 'REJECT_TRADE', player: o.to })),
    );
  }

  // FR-11: what is owed, how to raise cash, pay or declare bankruptcy.
  private debtSheet(s: GameState, who: number): HTMLElement {
    const debt = s.debts[0]!;
    const legal = this.session!.legalFor(who);
    const to = debt.creditor.kind === 'player' ? t('debt.toPlayer', { name: playerName(debt.creditor.player) }) : debt.creditor.kind === 'bank' ? t('debt.toBank') : t('debt.toEach');
    const canPay = legal.some((a) => a.type === 'PAY_DEBT');
    return h('div', { 'data-testid': 'debt' },
      h('div', { class: 'band debt' }, t('debt.title', { name: playerName(who), amount: money(debt.amount) })),
      h('div', { class: 'status' }, to),
      h('div', { class: 'note' }, t('debt.raise')),
      this.manageSheet(s, who, false),
      h('div', { class: 'row wrap' },
        this.actButton(t('debt.pay', { amount: money(debt.amount) }), { type: 'PAY_DEBT' }, 'primary', !canPay),
        h('button', { 'data-testid': 'open-trade-debt', onclick: () => { this.panel = 'trade'; this.draft = emptyDraft(); this.render(); } }, t('action.trade')),
        this.confirmBankrupt
          ? this.actButton(t('debt.confirm', { name: playerName(who) }), { type: 'DECLARE_BANKRUPTCY' }, 'danger')
          : h('button', { class: 'danger', 'data-testid': 'bankrupt', onclick: () => { this.confirmBankrupt = true; this.render(); } }, t('debt.bankrupt')),
      ));
  }

  // ---------- overlays ----------

  private needsHandoff(s: GameState, who: number): boolean {
    const session = this.session!;
    if (session.humanCount < 2) return false;
    if (s.turn.phase === 'START_TURN' || this.resumeCover) return true;
    return !!s.trade && s.trade.to === who && this.revealedTrade !== tradeKey(s);
  }

  private renderOverlay(s: GameState): void {
    const ov = this.els['overlay']!;
    const session = this.session!;
    ov.replaceChildren();
    ov.hidden = true;
    const show = (el: HTMLElement) => { ov.hidden = false; ov.append(el); };
    if (s.turn.phase === 'GAME_OVER') {
      return show(h('div', { class: 'card-box', 'data-testid': 'game-over' },
        h('div', { class: 'band plain' }, t('app.title')),
        h('h2', {}, t('over.title', { name: playerName(s.winner!) })),
        h('button', { class: 'primary big', 'data-testid': 'play-again', onclick: () => this.renderSetup() }, t('over.again'))));
    }
    if (this.cards.length) {
      const c = this.cards[0]!;
      const card = findCard(this.o.engine.rules, c.deck, c.cardId)!;
      const dismiss = () => { this.cards.shift(); this.render(); };
      if (!session.isHuman(c.player)) setTimeout(() => { if (this.cards[0] === c) dismiss(); }, this.o.test ? 0 : 1600);
      return show(h('div', { class: 'card-box', 'data-testid': 'card' },
        h('div', { class: `band ${c.deck}` }, t(`deck.${c.deck}`)),
        cardArt(c.deck, card.effect.type, this.o.sceneConfig.colors.palette),
        h('div', { class: 'note' }, t('card.drawnBy', { name: playerName(c.player) })),
        h('p', {}, cardText(this.o.engine.rules, card)),
        h('button', { class: 'primary', 'data-testid': 'card-ok', onclick: dismiss }, t('card.ok'))));
    }
    const who = session.actor();
    if (who === null || !session.isHuman(who) || !this.needsHandoff(s, who)) return;
    if (this.resumeCover) {
      return show(h('div', { class: 'card-box', 'data-testid': 'resume-cover' },
        h('div', { class: 'band plain' }, t('save.resumed')),
        h('span', { class: 'swatch big', style: `background:${this.color(who)}` }),
        h('h2', {}, t('handoff.pass', { name: playerName(who) })),
        h('button', { class: 'primary big', 'data-testid': 'resume-go', onclick: () => { this.resumeCover = false; this.render(); } }, t('handoff.reveal'))));
    }
    if (s.turn.phase === 'START_TURN') {
      return show(h('div', { class: 'card-box', 'data-testid': 'handoff' },
        h('div', { class: 'band plain' }, t('hud.turn', { name: playerName(who) })),
        h('span', { class: 'swatch big', style: `background:${this.color(who)}` }),
        h('h2', {}, t('handoff.pass', { name: playerName(who) })),
        this.actButton(t('handoff.reveal'), { type: 'BEGIN_TURN' }, 'primary big')));
    }
    return show(h('div', { class: 'card-box', 'data-testid': 'handoff-trade' },
      h('h2', {}, t('handoff.answer', { name: playerName(who) })),
      h('button', { class: 'primary big', 'data-testid': 'reveal-trade', onclick: () => { this.revealedTrade = tradeKey(s); this.render(); } }, t('handoff.show'))));
  }

  // ---------- details and log (D-88, D-89) ----------

  private openInfo(info: NonNullable<App['info']>): void {
    this.info = info;
    this.render();
  }

  private logButton(): HTMLElement {
    const label = t('log.title');
    const b = h('button', { class: 'chip icon', 'data-testid': 'open-log', 'aria-label': label, title: label, onclick: () => this.openInfo({ kind: 'log' }) });
    b.append(icon('log', 20));
    return b;
  }

  private logLines(): string[] {
    const s = this.session!.state;
    return this.events.flatMap((e) => describeLines(e, s, this.o.engine.rules));
  }

  // D-88: a tile name as a tag in its set color with the set symbol, like the deed header.
  // Hubs and utilities have no set, so their tag is plain.
  private tileTag(tile: Tile): HTMLElement {
    if (!tile.group) return h('span', { class: 'tag plain' }, t(tile.nameKey));
    return h('span', { class: 'tag', style: this.groupStyle(tile.group) }, `${this.o.sceneConfig.groupSymbols[tile.group] ?? ''} ${t(tile.nameKey)}`);
  }

  // Set color background with white or ink text, whichever has the contrast (D-96).
  private groupStyle(group: string): string {
    const bg = this.o.sceneConfig.colors.groups[group] ?? '#555555';
    const ink = textOn(bg) !== '#FFFFFF';
    return `background:${bg};color:${textOn(bg)}${ink ? ';text-shadow:none' : ''}`;
  }

  private infoSheet(s: GameState, info: NonNullable<App['info']>): HTMLElement {
    const close = h('div', { class: 'row' }, h('button', { 'data-testid': 'info-close', onclick: () => { this.info = null; this.render(); } }, t('action.close')));
    if (info.kind === 'log') {
      const lines = this.logLines().reverse();
      return h('div', { 'data-testid': 'info-log' },
        h('div', { class: 'band plain' }, t('log.title')),
        lines.length ? h('ol', { class: 'log-full' }, ...lines.map((l) => h('li', {}, l))) : h('div', { class: 'note' }, t('log.empty')),
        close);
    }
    if (info.kind === 'player') {
      const i = info.player;
      const p = s.players[i]!;
      const mine = this.o.engine.rules.tiles.filter((x) => s.properties[x.id]?.owner === i);
      const status = p.bankrupt ? t('hud.bankrupt') : p.inJam ? t('hud.inJam') : this.session!.isHuman(i) ? '' : t(`seat.${this.session!.seats[i]}`);
      return h('div', { 'data-testid': 'info-player' },
        h('div', { class: 'band plain who-band' }, h('span', { class: 'swatch', style: `background:${this.color(i)}` }), playerName(i)),
        h('div', { class: 'kv' }, h('span', {}, t('trade.cash')), h('span', {}, money(p.cash))),
        status ? h('div', { class: 'status' }, status) : null,
        p.jamCards.length ? h('div', { class: 'status' }, t('info.jamCards', { n: num(p.jamCards.length) })) : null,
        h('div', { class: 'field-label' }, t('info.properties')),
        mine.length
          ? h('div', { class: 'props' }, ...mine.map((tile) => h('div', { class: 'prop-name' }, this.tileTag(tile), h('span', { class: 'level' }, this.levelText(s, tile)))))
          : h('div', { class: 'note' }, t('manage.none')),
        close);
    }
    const tile = this.tile(info.id);
    const rules = this.o.engine.rules;
    const config = rules.config;
    const prop = s.properties[tile.id];
    const parts: Array<HTMLElement | null> = [];
    if (tile.type === 'property' || tile.type === 'hub' || tile.type === 'utility') {
      parts.push(this.deedCard(tile));
      if (!prop) {
        parts.push(h('div', { class: 'status' }, t('info.unowned')));
      } else {
        parts.push(h('div', { class: 'status who-band' }, h('span', { class: 'swatch', style: `background:${this.color(prop.owner)}` }), t('info.owner', { name: playerName(prop.owner) })));
        if (tile.type === 'property') parts.push(h('div', { class: 'status' }, t('info.buildings', { level: t(`deed.level.${Math.min(prop.houses, 5)}`) })));
        if (prop.mortgaged) parts.push(h('div', { class: 'status' }, t('manage.mortgaged')));
        else if (tile.type === 'utility') parts.push(h('div', { class: 'status' }, t('info.rentDice', { n: num(this.o.engine.rentFor(s, tile.id, 1)) })));
        else parts.push(h('div', { class: 'status' }, t('info.rentNow', { amount: money(this.o.engine.rentFor(s, tile.id, 0)) })));
      }
    } else {
      parts.push(h('div', { class: 'band plain' }, t(tile.nameKey)));
      let text = '';
      if (tile.type === 'tax') text = t('info.taxTile', { amount: money(config.tax[tile.tax!] ?? 0) });
      else if (tile.type === 'lucky' || tile.type === 'dohs') text = t('info.cardTile', { deck: t(`deck.${tile.type}`) });
      else if (tile.corner === 'go') text = t('info.go', { amount: money(config.goSalary) });
      else if (tile.corner === 'jam') text = t('info.jam', { amount: money(config.jam.fine) });
      else if (tile.corner === 'cha_adda') text = t('info.chaAdda');
      else if (tile.corner === 'go_to_jam') text = t('info.goToJam');
      parts.push(h('div', { class: 'note' }, text));
    }
    return h('div', { 'data-testid': 'info-tile' }, ...parts, close);
  }

  private levelText(s: GameState, tile: Tile): string {
    const prop = s.properties[tile.id]!;
    if (prop.mortgaged) return t('manage.mortgaged');
    return tile.type === 'property' ? t(`deed.level.${Math.min(prop.houses, 5)}`) : '';
  }

  private tile(id: string): Tile {
    return this.o.engine.rules.tiles.find((x) => x.id === id)!;
  }

  private color(player: number): string {
    const c = this.o.sceneConfig.colors.players;
    return c[player % c.length]!;
  }
}

// D-87: building, selling, mortgaging, redeeming and trading are open all through your own turn.
const canManage = (s: GameState) => ['ROLL', 'BUY_DECISION', 'MANAGE'].includes(s.turn.phase) && !s.trade;
const emptyDraft = (): TradeDraft => ({ to: null, give: new Set(), get: new Set(), giveCash: 0, getCash: 0, error: false });
const tradeKey = (s: GameState) => `${s.turnCount}:${JSON.stringify(s.trade)}`;
