import type { Action, GameState } from '../engine';

export interface AiProfile {
  noise: number;
  reserve: { base: number; threatShare: number };
  buyThreshold: number;
  bidFactor: number;
  setBonus: { complete: number; extend: number; block: number };
  useLandingFrequency: boolean;
  // Decline at list price when no opponent is likely to bid above it, then win the auction.
  declineToAuction: boolean;
  redeemSpareFactor: number;
  trade: { propose: boolean; offerPremium: number; acceptMargin: number; setPremium: number; consolidatePremium: number };
  jam: { stayLate: boolean; payFineEarly: boolean };
}

// What a computer player remembers between decisions: the turn it last proposed a trade on,
// and the last cash it offered for each tile, so a refused offer can rise next time.
export interface AiMemory {
  proposedOnTurn: Record<number, number>;
  lastOffer: Record<string, number>;
}

export interface DecideInput {
  state: GameState;
  player: number;
  profile: AiProfile;
  memory: AiMemory;
  rng: number;
}

export interface DecideResult {
  action: Action;
  memory: AiMemory;
  rng: number;
}
