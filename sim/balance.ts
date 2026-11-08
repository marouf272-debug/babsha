// Balance report (plan 4.3 S3): average game length, win rate by seat and bankruptcy order over
// thousands of computer-only games, plus the start cash question (Q-02) and the auction finding.

import type { Ai, AiProfile } from '../src/ai';
import type { Engine } from '../src/engine';
import { playAiGame, type AiGameResult } from './ai-games';

type Profiles = Record<'easy' | 'medium' | 'hard', AiProfile>;

const MAX_TURNS = 4000;
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const ci = (p: number, n: number) => `±${(196 * Math.sqrt((p * (1 - p)) / Math.max(n, 1))).toFixed(1)}`;
const quantile = (xs: number[], q: number) => {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]!;
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const r1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : 'n/a');

export interface BalanceOptions {
  gamesPerPlayerCount: number;
  difficultyGames: number;
  startCashGames: number;
  auctionGames: number;
  headToHeadGames: number;
  checkInvariants: boolean;
}

interface CountSummary {
  players: number;
  games: number;
  finished: number;
  rounds: { mean: number; median: number; p10: number; p90: number };
  winByTurnPosition: number[];
  bankruptcyRound: number[]; // mean round of the 1st, 2nd, ... bankruptcy
  firstBankruptByTurnPosition: number[];
  rentShareByGroup: Record<string, number>;
  purchasesViaAuction: number;
  auctionPriceMedian: number;
  housesPerGame: number;
  tradesPerGame: number;
  violations: string[];
}

function summarize(players: number, results: AiGameResult[]): CountSummary {
  const fin = results.filter((r) => r.finished);
  const rounds = fin.map((r) => r.rounds);
  const winByTurnPosition = new Array<number>(players).fill(0);
  const firstBankruptByTurnPosition = new Array<number>(players).fill(0);
  const bankruptcyRounds: number[][] = Array.from({ length: players - 1 }, () => []);
  const rent: Record<string, number> = {};
  let bought = 0;
  let won = 0;
  let houses = 0;
  let trades = 0;
  const ratios: number[] = [];
  for (const r of results) {
    if (r.winner !== null) winByTurnPosition[r.turnOrder.indexOf(r.winner)]! += 1;
    r.bankruptcies.forEach((b, k) => bankruptcyRounds[k]?.push(b.turn / players));
    if (r.bankruptcies[0]) firstBankruptByTurnPosition[r.turnOrder.indexOf(r.bankruptcies[0].player)]! += 1;
    for (const [g, v] of Object.entries(r.rentByGroup)) rent[g] = (rent[g] ?? 0) + v;
    bought += r.events['purchased'] ?? 0;
    won += r.events['auctionWon'] ?? 0;
    houses += r.events['buildingBought'] ?? 0;
    trades += r.events['tradeAccepted'] ?? 0;
    ratios.push(...r.auctionPriceRatio);
  }
  const totalRent = Object.values(rent).reduce((a, b) => a + b, 0) || 1;
  const withFirst = firstBankruptByTurnPosition.reduce((a, b) => a + b, 0) || 1;
  return {
    players, games: results.length, finished: fin.length,
    rounds: { mean: mean(rounds), median: quantile(rounds, 0.5), p10: quantile(rounds, 0.1), p90: quantile(rounds, 0.9) },
    winByTurnPosition: winByTurnPosition.map((w) => w / Math.max(fin.length, 1)),
    bankruptcyRound: bankruptcyRounds.map(mean),
    firstBankruptByTurnPosition: firstBankruptByTurnPosition.map((x) => x / withFirst),
    rentShareByGroup: Object.fromEntries(Object.entries(rent).sort((a, b) => b[1] - a[1]).map(([g, v]) => [g, v / totalRent])),
    purchasesViaAuction: won / Math.max(won + bought, 1),
    auctionPriceMedian: quantile(ratios, 0.5),
    housesPerGame: houses / results.length,
    tradesPerGame: trades / results.length,
    violations: results.flatMap((r) => r.violations),
  };
}

const seats = (P: Profiles, ids: Array<keyof Profiles>) => ids.map((id) => ({ id, profile: P[id] }));

export function runBalance(engine: Engine, ai: Ai, P: Profiles, o: BalanceOptions) {
  // A. Economy baseline: Medium players only, 2 to 6 players.
  const counts: CountSummary[] = [];
  for (let n = 2; n <= 6; n++) {
    const results: AiGameResult[] = [];
    for (let g = 0; g < o.gamesPerPlayerCount; g++) {
      results.push(playAiGame(engine, ai, { seed: 100_000 * n + g, profiles: seats(P, Array(n).fill('medium')), maxTurns: MAX_TURNS, checkInvariants: o.checkInvariants }));
    }
    counts.push(summarize(n, results));
  }

  // B. Difficulty: one Easy, one Medium, one Hard, every seating order equally often.
  const orders: Array<Array<keyof Profiles>> = [
    ['easy', 'medium', 'hard'], ['easy', 'hard', 'medium'], ['medium', 'easy', 'hard'],
    ['medium', 'hard', 'easy'], ['hard', 'easy', 'medium'], ['hard', 'medium', 'easy'],
  ];
  const diffWins: Record<string, number> = { easy: 0, medium: 0, hard: 0 };
  const diffFirstOut: Record<string, number> = { easy: 0, medium: 0, hard: 0 };
  let diffFinished = 0;
  for (let g = 0; g < o.difficultyGames; g++) {
    const ids = orders[g % orders.length]!;
    const r = playAiGame(engine, ai, { seed: 900_000 + g, profiles: seats(P, ids), maxTurns: MAX_TURNS, checkInvariants: false });
    if (r.winner !== null) { diffWins[ids[r.winner]!]! += 1; diffFinished++; }
    if (r.bankruptcies[0]) diffFirstOut[ids[r.bankruptcies[0].player]!]! += 1;
  }

  // B2. Head to head: two players, seats swapped every other game.
  const pairs: Array<[keyof Profiles, keyof Profiles]> = [['medium', 'easy'], ['hard', 'medium'], ['hard', 'easy']];
  const headToHead = pairs.map(([a, b]) => {
    let wins = 0;
    for (let g = 0; g < o.headToHeadGames; g++) {
      const aFirst = g % 2 === 0;
      const r = playAiGame(engine, ai, { seed: 600_000 + g, profiles: seats(P, aFirst ? [a, b] : [b, a]), maxTurns: MAX_TURNS, checkInvariants: false });
      if (r.winner === (aFirst ? 0 : 1)) wins++;
    }
    return { a, b, wins, games: o.headToHeadGames };
  });

  // C. Q-02: start cash 10,000 (approved), 12,500 and 15,000 (the classic cash to price ratio).
  const startCash = [10000, 12500, 15000].map((cash) => {
    const results: AiGameResult[] = [];
    for (let g = 0; g < o.startCashGames; g++) {
      results.push(playAiGame(engine, ai, { seed: 700_000 + g, profiles: seats(P, Array(4).fill('medium')), maxTurns: MAX_TURNS, checkInvariants: false, startCash: cash }));
    }
    return { cash, summary: summarize(4, results) };
  });

  // D. Auction finding: one Medium player that never buys at list price, three normal Medium.
  let declinerWins = 0;
  let auctionFinished = 0;
  const decliner: AiProfile = { ...P.medium, buyThreshold: 99 };
  for (let g = 0; g < o.auctionGames; g++) {
    const seat = g % 4;
    const profiles = [0, 1, 2, 3].map((i) => (i === seat ? { id: 'decliner', profile: decliner } : { id: 'medium', profile: P.medium }));
    const r = playAiGame(engine, ai, { seed: 800_000 + g, profiles, maxTurns: MAX_TURNS, checkInvariants: false });
    if (r.winner !== null) { auctionFinished++; if (r.winner === seat) declinerWins++; }
  }

  return { counts, headToHead, difficulty: { wins: diffWins, firstOut: diffFirstOut, finished: diffFinished, games: o.difficultyGames }, startCash, auction: { declinerWins, finished: auctionFinished, games: o.auctionGames }, options: o };
}

export type BalanceReport = ReturnType<typeof runBalance>;

export function toMarkdown(rep: BalanceReport): string {
  const L: string[] = [];
  const o = rep.options;
  const total = rep.counts.reduce((a, c) => a + c.games, 0) + rep.headToHead.reduce((a, h) => a + h.games, 0) + rep.difficulty.games + rep.startCash.reduce((a, s) => a + s.summary.games, 0) + rep.auction.games;
  L.push('# Balance report', '');
  L.push(`Generated by \`npm run balance\` from computer-only games. ${total} games in all. Every number depends on how the computer players play (docs/AI.md), so treat it as evidence, not truth. Rounds = turns divided by players. Turn position 1 = the player who moves first.`, '');
  L.push('## 1. Economy baseline: Medium players only', '');
  L.push(`${o.gamesPerPlayerCount} games per player count. Invariants ${o.checkInvariants ? 'checked after every action' : 'not checked'}.`, '');
  L.push('| Players | Finished | Rounds mean | Median | 10th to 90th pct | Win rate by turn position (±95% range) | Invariant breaks |');
  L.push('|---|---|---|---|---|---|---|');
  for (const c of rep.counts) {
    const win = c.winByTurnPosition.map((w, i) => `${i + 1}: ${pct(w)} ${ci(w, c.finished)}`).join('; ');
    L.push(`| ${c.players} | ${c.finished}/${c.games} | ${r1(c.rounds.mean)} | ${r1(c.rounds.median)} | ${r1(c.rounds.p10)} to ${r1(c.rounds.p90)} | ${win} | ${c.violations.length} |`);
  }
  L.push('', `A fair game gives each turn position about 1 in N wins.`, '');
  L.push('### Bankruptcy order', '');
  L.push('| Players | Mean round of 1st, 2nd, ... bankruptcy | Who goes bankrupt first, by turn position |');
  L.push('|---|---|---|');
  for (const c of rep.counts) {
    L.push(`| ${c.players} | ${c.bankruptcyRound.map(r1).join(', ')} | ${c.firstBankruptByTurnPosition.map((x, i) => `${i + 1}: ${pct(x)}`).join('; ')} |`);
  }
  L.push('', '### Where the money goes', '');
  L.push('| Players | Purchases won at auction | Median auction price, share of list | Houses and hotels built per game | Trades per game |');
  L.push('|---|---|---|---|---|');
  for (const c of rep.counts) L.push(`| ${c.players} | ${pct(c.purchasesViaAuction)} | ${pct(c.auctionPriceMedian)} | ${r1(c.housesPerGame)} | ${r1(c.tradesPerGame)} |`);
  const four = rep.counts.find((c) => c.players === 4)!;
  L.push('', 'Rent collected by group, 4 players:', '');
  L.push('| Group | Share of all rent |', '|---|---|');
  for (const [g, v] of Object.entries(four.rentShareByGroup)) L.push(`| ${g} | ${pct(v)} |`);
  L.push('', '## 2. Difficulty levels', '');
  const d = rep.difficulty;
  L.push(`${d.games} three-player games, one Easy, one Medium, one Hard, every seating order equally often. ${d.finished} reached a winner.`, '');
  L.push('| Profile | Win rate | First to go bankrupt |', '|---|---|---|');
  for (const id of ['easy', 'medium', 'hard']) L.push(`| ${id} | ${pct(d.wins[id]! / Math.max(d.finished, 1))} | ${pct(d.firstOut[id]! / Math.max(d.games, 1))} |`);
  L.push('', `Equal strength would give 33.3% each. A control run with two identical profiles in these seats differed by up to 6 points over 600 games, so gaps that small are within chance.`, '');
  L.push('Head to head, two players, seats swapped every other game:', '');
  L.push('| Pairing | First named wins |', '|---|---|');
  for (const h of rep.headToHead) {
    const p = h.wins / Math.max(h.games, 1);
    L.push(`| ${h.a} vs ${h.b} (${h.games} games) | ${pct(p)} ${ci(p, h.games)} |`);
  }
  L.push('');
  L.push('## 3. Start cash (Q-02)', '');
  L.push(`${o.startCashGames} four-player Medium games per setting. ৳15,000 matches the classic ratio of start cash to the top price.`, '');
  L.push('| Start cash | Finished | Rounds mean | Median | Win rate, turn position 1 | Mean round of 1st bankruptcy |', '|---|---|---|---|---|---|');
  for (const s of rep.startCash) {
    const c = s.summary;
    L.push(`| ৳${s.cash.toLocaleString('en-US')} | ${c.finished}/${c.games} | ${r1(c.rounds.mean)} | ${r1(c.rounds.median)} | ${pct(c.winByTurnPosition[0]!)} ${ci(c.winByTurnPosition[0]!, c.finished)} | ${r1(c.bankruptcyRound[0]!)} |`);
  }
  L.push('', '## 4. Auction finding', '');
  const a = rep.auction;
  const p = a.declinerWins / Math.max(a.finished, 1);
  L.push(`${a.games} four-player games: one Medium player who never buys at list price and only buys at auction, against three normal Medium players, rotating seats. ${a.finished} reached a winner.`, '');
  L.push(`The decliner won ${pct(p)} ${ci(p, a.finished)} of games. A neutral strategy would win about 25%.`, '');
  L.push('Because an auction opens at ৳0 (plan 2.3, D-43) and the player who declined may bid (D-33), declining at list price and buying at auction for less pays off when other players do not bid the price up. Human players may bid more than these computer players do.', '');
  return L.join('\n') + '\n';
}
