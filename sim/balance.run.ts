import { it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import tilesDoc from '../data/tiles.json';
import config from '../data/config.json';
import cardsDoc from '../data/cards.json';
import profilesDoc from '../data/ai-profiles.json';
import { createEngine, makeRules } from '../src/engine';
import { createAi, type AiProfile } from '../src/ai';
import { runBalance, toMarkdown } from './balance';

// Run with `npm run balance`. Not part of `npm test`: thousands of games take several minutes.
it('writes the balance report', () => {
  const engine = createEngine(makeRules(tilesDoc, config, cardsDoc));
  const ai = createAi(engine);
  const games = Number(process.env['BALANCE_GAMES'] ?? 600);
  const rep = runBalance(engine, ai, profilesDoc.profiles as Record<'easy' | 'medium' | 'hard', AiProfile>, {
    gamesPerPlayerCount: games, difficultyGames: games * 3, headToHeadGames: games, startCashGames: Math.round(games * 2 / 3), auctionGames: Math.round(games * 2 / 3), checkInvariants: true,
  });
  mkdirSync(new URL('./reports/', import.meta.url), { recursive: true });
  writeFileSync(new URL('./reports/balance.md', import.meta.url), toMarkdown(rep));
  const slim = { ...rep, counts: rep.counts.map((c) => ({ ...c, violations: c.violations.slice(0, 20) })) };
  writeFileSync(new URL('./reports/balance.json', import.meta.url), JSON.stringify(slim, null, 2) + '\n');
}, 3_600_000);
