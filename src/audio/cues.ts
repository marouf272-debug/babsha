// Which sound each engine event plays (plan 3.10 audio set: dice, buy, rent, card, auction bell,
// jam horn), scaled by importance (game-feel skill). Pure, so it can be tested without audio.

import type { GameEvent } from '../engine';

export type Cue = 'dice' | 'hop' | 'buy' | 'rent' | 'coin' | 'card' | 'bell' | 'horn' | 'build' | 'fall' | 'fanfare';

export const CUES: Cue[] = ['dice', 'hop', 'buy', 'rent', 'coin', 'card', 'bell', 'horn', 'build', 'fall', 'fanfare'];

export function cueFor(e: GameEvent): Cue | null {
  switch (e.type) {
    case 'diceRolled': return 'dice';
    case 'moved': return 'hop';
    case 'purchased': case 'auctionWon': return 'buy';
    case 'rentPaid': case 'debtPaid': return 'rent';
    case 'salary': case 'cardCollected': return 'coin';
    case 'cardDrawn': return 'card';
    case 'auctionStarted': return 'bell';
    case 'sentToJam': return 'horn';
    case 'buildingBought': return 'build';
    case 'bankrupt': return 'fall';
    case 'gameOver': return 'fanfare';
    default: return null;
  }
}
