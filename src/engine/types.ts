// Engine types. Plain data only, so state can be cloned, saved and sent over a network later.

export type TileType = 'corner' | 'property' | 'hub' | 'utility' | 'tax' | 'lucky' | 'dohs';

export interface Tile {
  pos: number;
  id: string;
  type: TileType;
  nameKey: string;
  corner?: string;
  tax?: string;
  group?: string;
  price?: number;
  houseCost?: number;
  hotelCost?: number;
  rent?: number[];
}

export interface Group {
  id: string;
  nameKey: string;
  side: number;
}

export interface Config {
  players: { min: number; max: number };
  board: { tiles: number };
  dice: { count: number; sides: number; doublesToJam: number };
  startCash: number;
  goSalary: number;
  hub: { price: number; rentByHubsOwned: number[] };
  utility: { price: number; diceMultiplierByUtilitiesOwned: number[] };
  tax: Record<string, number>;
  jam: { fine: number; maxFailedTurns: number };
  rent: { unbuiltFullSetMultiplier: number };
  building: { maxHouses: number; sellBackRate: number };
  mortgage: { rate: number; redeemInterest: number };
  auction: { openingBid: number; minRaise: number };
}

export interface Rules {
  tiles: Tile[];
  groups: Group[];
  config: Config;
  groupMembers: Record<string, string[]>;
  jamPos: number;
}

// Resting phases from plan 3.2. MOVE, RESOLVE and END_TURN happen inside a single action.
export type Phase = 'START_TURN' | 'ROLL' | 'BUY_DECISION' | 'AUCTION' | 'MANAGE' | 'DEBT' | 'GAME_OVER';

export interface PlayerState {
  id: string;
  cash: number;
  position: number;
  inJam: boolean;
  jamFailedRolls: number;
}

// houses: 0 to maxHouses, and maxHouses + 1 means a hotel.
export interface PropertyState {
  owner: number;
  houses: number;
  mortgaged: boolean;
}

export interface TurnState {
  active: number;
  phase: Phase;
  doublesThisTurn: number;
  extraRoll: boolean;
  lastDice: number[] | null;
  pendingTile: string | null;
}

export interface GameState {
  version: 1;
  rng: number;
  players: PlayerState[];
  properties: Record<string, PropertyState>;
  turn: TurnState;
  turnCount: number;
}

export type Action =
  | { type: 'BEGIN_TURN' }
  | { type: 'ROLL' }
  | { type: 'PAY_JAM_FINE' }
  | { type: 'BUY' }
  | { type: 'DECLINE' }
  | { type: 'END_TURN' };

export type GameEvent =
  | { type: 'gameCreated'; players: string[]; seed: number }
  | { type: 'orderRoll'; rolls: Array<{ player: number; dice: number[]; total: number }> }
  | { type: 'firstPlayer'; player: number }
  | { type: 'turnStarted'; player: number }
  | { type: 'diceRolled'; player: number; dice: number[]; total: number; doubles: boolean }
  | { type: 'moved'; player: number; from: number; to: number; steps: number }
  | { type: 'salary'; player: number; amount: number }
  | { type: 'landed'; player: number; tileId: string }
  | { type: 'offerPurchase'; player: number; tileId: string; price: number; mortgageValue: number; rentKind: 'property' | 'hub' | 'utility'; rent: number[] }
  | { type: 'purchased'; player: number; tileId: string; price: number }
  | { type: 'declined'; player: number; tileId: string }
  | { type: 'auctionStub'; tileId: string }
  | { type: 'rentPaid'; from: number; to: number; tileId: string; amount: number }
  | { type: 'rentWaived'; tileId: string; reason: 'mortgaged' }
  | { type: 'taxPaid'; player: number; tileId: string; amount: number }
  | { type: 'cardStub'; player: number; tileId: string; deck: 'lucky' | 'dohs' }
  | { type: 'sentToJam'; player: number; reason: 'threeDoubles' | 'goToJamTile' }
  | { type: 'jamFinePaid'; player: number; amount: number; forced: boolean }
  | { type: 'leftJam'; player: number; by: 'fine' | 'doubles' | 'forcedFine' }
  | { type: 'stayedInJam'; player: number; failedRolls: number }
  | { type: 'extraRoll'; player: number }
  | { type: 'turnPassed'; from: number; to: number };

export interface StepResult {
  state: GameState;
  events: GameEvent[];
}

export interface NewGameOptions {
  playerIds: string[];
  seed: number;
  startCash?: number;
}
