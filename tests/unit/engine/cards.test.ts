import { describe, expect, it } from 'vitest';
import type { DeckId, GameState } from '../../../src/engine';
import { actionTypes, edit, engine, newGame, ofType, ready, rollAs, step } from './helpers';

// Puts a card on top of its deck, for testing one effect at a time.
const top = (deck: DeckId, id: string, more: (s: GameState) => void = () => {}) => (s: GameState) => {
  s.decks[deck] = [id, ...s.decks[deck].filter((x) => x !== id)];
  more(s);
};
const at = (p: number) => (s: GameState) => { s.players[s.turn.active]!.position = p; };
const start = (players = 3) => ready(newGame(players, 61).state);
// Land on Lucky at 7 from GO, or on DOHS at 17 from 10.
const lucky = (id: string, more?: (s: GameState) => void, players = 3) => {
  const s0 = edit(start(players), top('lucky', id, more));
  return { s0, me: s0.turn.active, ...rollAs(s0, 3, 4) };
};
const dohs = (id: string, more: (s: GameState) => void = () => {}, players = 3) => {
  const s0 = edit(start(players), top('dohs', id, (s) => { at(10)(s); more(s); }));
  return { s0, me: s0.turn.active, ...rollAs(s0, 3, 4) };
};
const deckIntact = (s: GameState, deck: DeckId) => {
  const held = s.players.flatMap((p) => p.jamCards.filter((c) => c.deck === deck).map((c) => c.cardId));
  return [...s.decks[deck], ...held].sort();
};

describe('decks (FR-09, R-30 to R-33, D-40)', () => {
  it('FR-09, D-40: both decks are shuffled at game start with the seeded generator', () => {
    const a = newGame(3, 61).state;
    expect([...a.decks.lucky].sort()).toEqual(engine.rules.cards.lucky.map((c) => c.id).sort());
    expect([...a.decks.dohs].sort()).toEqual(engine.rules.cards.dohs.map((c) => c.id).sort());
    expect(newGame(3, 61).state.decks).toEqual(a.decks);
    expect(newGame(3, 62).state.decks).not.toEqual(a.decks);
  });

  it('FR-09, D-40: landing on a card tile draws the top card, which then goes to the bottom', () => {
    const { state, events, me } = lucky('lucky_05');
    expect(ofType(events, 'cardDrawn')).toEqual([{ type: 'cardDrawn', player: me, deck: 'lucky', cardId: 'lucky_05' }]);
    expect(state.decks.lucky[15]).toBe('lucky_05');
    expect(state.decks.lucky).toHaveLength(16);
  });
});

describe('card effects (FR-09, D-41)', () => {
  it('FR-09: collect pays the player from the bank', () => {
    const { state, events, me } = lucky('lucky_05');
    expect(state.players[me]!.cash).toBe(10500);
    expect(ofType(events, 'cardCollected')).toEqual([{ type: 'cardCollected', player: me, cardId: 'lucky_05', amount: 500 }]);
  });

  it('FR-09: pay sends money to the bank, and a payment the player cannot make becomes a debt', () => {
    expect(lucky('lucky_06').state.players[lucky('lucky_06').me]!.cash).toBe(9500);
    const short = lucky('lucky_06', (s) => { s.players[s.turn.active]!.cash = 100; });
    expect(short.state.turn.phase).toBe('DEBT');
    expect(short.state.debts[0]).toMatchObject({ creditor: { kind: 'bank' }, amount: 500, reason: 'card' });
  });

  it('FR-09: collect from each takes the amount from every other player', () => {
    const { state, me } = dohs('dohs_04');
    expect(state.players[me]!.cash).toBe(10200);
    expect(state.players.filter((_, i) => i !== me).every((p) => p.cash === 9900)).toBe(true);
  });

  it('FR-09, D-49: when a payer of collect from each is short, that payer settles in DEBT, then the turn goes on', () => {
    const { state, me } = dohs('dohs_04', (s) => { s.players[(s.turn.active + 2) % 3]!.cash = 50; });
    const short = (me + 2) % 3;
    expect(state.turn.phase).toBe('DEBT');
    expect(state.debts).toEqual([{ debtor: short, creditor: { kind: 'player', player: me }, amount: 100, reason: 'card' }]);
    expect(actionTypes(engine.legalActions(state))).toEqual(['DECLARE_BANKRUPTCY']);
    const r = step(state, { type: 'DECLARE_BANKRUPTCY', player: short });
    expect(r.state.turn).toMatchObject({ phase: 'MANAGE', active: me });
  });

  it('FR-09: pay each sends the amount to every other player', () => {
    const { state, me } = dohs('dohs_05');
    expect(state.players[me]!.cash).toBe(9800);
    expect(state.players.filter((_, i) => i !== me).every((p) => p.cash === 10100)).toBe(true);
  });

  it('FR-11, D-45, D-48: bankrupt on pay each: cash split equally, remainder to the bank, properties auctioned', () => {
    const { state, me } = dohs('dohs_05', (s) => {
      s.players[s.turn.active]!.cash = 101;
      s.properties['kamalapur'] = { owner: s.turn.active, houses: 0, mortgaged: false };
    });
    expect(state.debts[0]).toMatchObject({ debtor: me, amount: 200, creditor: { kind: 'split' } });
    const r = step(state, { type: 'DECLARE_BANKRUPTCY' });
    const b = ofType(r.events, 'bankrupt')[0]!;
    expect(b.transfers).toEqual([{ to: (me + 1) % 3, amount: 50 }, { to: (me + 2) % 3, amount: 50 }, { to: 'bank', amount: 1 }]);
    expect(b.tilesTo).toBe('auction');
    expect(r.state.auction?.tileId).toBe('kamalapur');
  });

  it('FR-09: move to a tile goes clockwise and resolves it; passing GO pays the salary', () => {
    const near = lucky('lucky_01'); // 7 to Uttara at 34
    expect(near.state.players[near.me]!.position).toBe(34);
    expect(ofType(near.events, 'salary')).toHaveLength(0);
    expect(near.state.turn.phase).toBe('BUY_DECISION');
    const s0 = edit(start(), top('lucky', 'lucky_01', at(29)));
    const far = rollAs(s0, 3, 4); // 36 to Uttara at 34 passes GO
    expect(far.state.players[s0.turn.active]!.cash).toBe(12000);
  });

  it('FR-09, D-15: advance to GO pays the salary on landing', () => {
    const { state, me } = lucky('lucky_02');
    expect(state.players[me]).toMatchObject({ position: 0, cash: 12000 });
  });

  it('FR-09: move back goes backwards without salary and resolves the tile it lands on', () => {
    const { state, events, me } = lucky('lucky_03'); // 7 back to Super Tax at 4
    expect(state.players[me]!.position).toBe(4);
    expect(ofType(events, 'taxPaid')).toHaveLength(1);
    expect(ofType(events, 'salary')).toHaveLength(0);
  });

  it('FR-09, FR-10, D-23: go to Jam sends the player to Jam with no salary', () => {
    const { state, events, me } = lucky('lucky_04');
    expect(state.players[me]).toMatchObject({ position: 10, inJam: true, cash: 10000 });
    expect(ofType(events, 'sentToJam')).toEqual([{ type: 'sentToJam', player: me, reason: 'card' }]);
  });

  it('FR-09: repairs charge per house and per hotel owned', () => {
    const { state, me } = lucky('lucky_11', (s) => {
      const a = s.turn.active;
      s.properties['mirpur'] = { owner: a, houses: 2, mortgaged: false };
      s.properties['mohammadpur'] = { owner: a, houses: 2, mortgaged: false };
      s.properties['shyamoli'] = { owner: a, houses: 2, mortgaged: false };
      s.properties['puran_dhaka'] = { owner: a, houses: 5, mortgaged: false };
      s.properties['chawk_bazar'] = { owner: a, houses: 5, mortgaged: false };
    });
    expect(state.players[me]!.cash).toBe(10000 - (6 * 250 + 2 * 1000));
  });
});

describe('Jam exit card (FR-10, R-32, R-50, D-40, D-47)', () => {
  it('FR-10: the Jam exit card is kept by the player and leaves the deck', () => {
    const { state, events, me } = lucky('lucky_10');
    expect(state.players[me]!.jamCards).toEqual([{ deck: 'lucky', cardId: 'lucky_10' }]);
    expect(state.decks.lucky).not.toContain('lucky_10');
    expect(deckIntact(state, 'lucky')).toHaveLength(16);
    expect(ofType(events, 'cardHeld')).toHaveLength(1);
  });

  it('FR-10, D-47: in Jam the card is used before rolling, returns to the bottom of its deck, then the player rolls normally', () => {
    const s0 = edit(start(), (s) => {
      const p = s.players[s.turn.active]!;
      Object.assign(p, { position: 10, inJam: true, jamCards: [{ deck: 'dohs', cardId: 'dohs_06' }] });
      s.decks.dohs = s.decks.dohs.filter((x) => x !== 'dohs_06');
    });
    const me = s0.turn.active;
    expect(actionTypes(engine.legalActions(s0))).toEqual(['ROLL', 'PAY_JAM_FINE', 'USE_JAM_CARD']);
    let r = step(s0, { type: 'USE_JAM_CARD' });
    expect(r.state.players[me]).toMatchObject({ inJam: false, jamCards: [], cash: 10000 });
    expect(r.state.decks.dohs[r.state.decks.dohs.length - 1]).toBe('dohs_06');
    expect(ofType(r.events, 'leftJam')).toEqual([{ type: 'leftJam', player: me, by: 'card' }]);
    r = rollAs(r.state, 4, 6);
    expect(r.state.players[me]!.position).toBe(20);
  });

  it('D-40: a bankrupt player returns a held card to the bottom of its deck', () => {
    const s0 = edit(start(2), (s) => {
      const a = s.turn.active;
      const owner = (a + 1) % 2;
      s.properties['puran_dhaka'] = { owner, houses: 5, mortgaged: false };
      s.properties['chawk_bazar'] = { owner, houses: 5, mortgaged: false };
      s.players[a]!.cash = 10;
      s.players[a]!.jamCards = [{ deck: 'lucky', cardId: 'lucky_10' }];
      s.decks.lucky = s.decks.lucky.filter((x) => x !== 'lucky_10');
    });
    const r = step(rollAs(s0, 1, 2).state, { type: 'DECLARE_BANKRUPTCY' });
    expect(r.state.decks.lucky[15]).toBe('lucky_10');
  });
});
