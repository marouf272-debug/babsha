// Engine types. Plain data only, so state can be cloned, saved and sent over a network later.

export type TileType = 'corner' | 'property' | 'hub' | 'utility' | 'tax' | 'lucky' | 'dohs';
export type DeckId = 'lucky' | 'dohs';

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

export type CardEffect =
  | { type: 'collect'; amount: number }
  | { type: 'pay'; amount: number }
  | { type: 'collectFromEach'; amount: number }
  | { type: 'payEach'; amount: number }
  | { type: 'moveTo'; tile: string }
  | { type: 'moveBy'; steps: number }
  | { type: 'goToJam' }
  | { type: 'jamFreeCard' }
  | { type: 'repairs'; perHouse: number; perHotel: number };

export interface Card {
  id: string;
  textKey: string;
  effect: CardEffect;
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
  cards: Record<DeckId, Card[]>;
  groupMembers: Record<string, string[]>;
  jamPos: number;
}

// Resting phases from plan 3.2. MOVE, RESOLVE and END_TURN happen inside a single action.
export type Phase = 'START_TURN' | 'ROLL' | 'BUY_DECISION' | 'AUCTION' | 'MANAGE' | 'DEBT' | 'GAME_OVER';

export interface HeldCard {
  deck: DeckId;
  cardId: string;
}

export interface PlayerState {
  id: string;
  cash: number;
  position: number;
  inJam: boolean;
  jamFailedRolls: number;
  bankrupt: boolean;
  jamCards: HeldCard[];
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

export interface AuctionState {
  tileId: string;
  highBid: number | null;
  highBidder: number | null;
  // Players still in the auction, in seat order. Folded players are removed.
  inPlayers: number[];
}

export interface TradeOffer {
  from: number;
  to: number;
  giveTiles: string[];
  giveCash: number;
  getTiles: string[];
  getCash: number;
}

// Who a debt is owed to. `split` is a "pay each player" card (D-45).
export type Creditor = { kind: 'player'; player: number } | { kind: 'bank' } | { kind: 'split'; players: number[] };

export type DebtReason = 'rent' | 'tax' | 'jamFine' | 'card';

export interface Debt {
  debtor: number;
  creditor: Creditor;
  amount: number;
  reason: DebtReason;
}

export interface GameState {
  version: 2;
  rng: number;
  players: PlayerState[];
  properties: Record<string, PropertyState>;
  turn: TurnState;
  turnCount: number;
  // Top of each deck is index 0 (D-40).
  decks: Record<DeckId, string[]>;
  auction: AuctionState | null;
  auctionQueue: string[];
  trade: TradeOffer | null;
  debts: Debt[];
  // Steps still to move after a debt is settled (D-50, forced Jam fine).
  pendingMove: number | null;
  winner: number | null;
}

// `player` names who acts. It may be left out when the actor is obvious (the active player);
// legalActions always fills it in.
export type Action =
  | { type: 'BEGIN_TURN'; player?: number }
  | { type: 'ROLL'; player?: number }
  | { type: 'PAY_JAM_FINE'; player?: number }
  | { type: 'USE_JAM_CARD'; player?: number }
  | { type: 'BUY'; player?: number }
  | { type: 'DECLINE'; player?: number }
  | { type: 'BID'; player: number; amount: number }
  | { type: 'FOLD'; player: number }
  | { type: 'BUILD'; player?: number; tileId: string }
  | { type: 'SELL_BUILDING'; player?: number; tileId: string }
  | { type: 'MORTGAGE'; player?: number; tileId: string }
  | { type: 'REDEEM'; player?: number; tileId: string }
  | { type: 'PROPOSE_TRADE'; player?: number; offer: Omit<TradeOffer, 'from'> }
  | { type: 'ACCEPT_TRADE'; player: number }
  | { type: 'REJECT_TRADE'; player: number }
  | { type: 'PAY_DEBT'; player?: number }
  | { type: 'DECLARE_BANKRUPTCY'; player?: number }
  | { type: 'END_TURN'; player?: number };

export type ActionType = Action['type'];

export type CashTarget = number | 'bank';

export type GameEvent =
  | { type: 'gameCreated'; players: string[]; seed: number }
  | { type: 'orderRoll'; rolls: Array<{ player: number; dice: number[]; total: number }> }
  | { type: 'firstPlayer'; player: number }
  | { type: 'decksShuffled'; decks: Record<DeckId, string[]> }
  | { type: 'turnStarted'; player: number }
  | { type: 'diceRolled'; player: number; dice: number[]; total: number; doubles: boolean }
  | { type: 'moved'; player: number; from: number; to: number; steps: number }
  | { type: 'salary'; player: number; amount: number }
  | { type: 'landed'; player: number; tileId: string }
  | { type: 'offerPurchase'; player: number; tileId: string; price: number; mortgageValue: number; rentKind: 'property' | 'hub' | 'utility'; rent: number[] }
  | { type: 'purchased'; player: number; tileId: string; price: number }
  | { type: 'declined'; player: number; tileId: string }
  | { type: 'auctionStarted'; tileId: string; players: number[] }
  | { type: 'bid'; player: number; tileId: string; amount: number }
  | { type: 'folded'; player: number; tileId: string }
  | { type: 'auctionWon'; player: number; tileId: string; price: number }
  | { type: 'auctionUnsold'; tileId: string }
  | { type: 'rentPaid'; from: number; to: number; tileId: string; amount: number }
  | { type: 'rentWaived'; tileId: string; reason: 'mortgaged' }
  | { type: 'taxPaid'; player: number; tileId: string; amount: number }
  | { type: 'cardDrawn'; player: number; deck: DeckId; cardId: string }
  | { type: 'cardCollected'; player: number; cardId: string; amount: number }
  | { type: 'cardPaid'; from: number; to: CashTarget; cardId: string; amount: number }
  | { type: 'cardHeld'; player: number; deck: DeckId; cardId: string }
  | { type: 'sentToJam'; player: number; reason: 'threeDoubles' | 'goToJamTile' | 'card' }
  | { type: 'jamFinePaid'; player: number; amount: number; forced: boolean }
  | { type: 'jamCardUsed'; player: number; deck: DeckId; cardId: string }
  | { type: 'leftJam'; player: number; by: 'fine' | 'doubles' | 'forcedFine' | 'card' }
  | { type: 'stayedInJam'; player: number; failedRolls: number }
  | { type: 'buildingBought'; player: number; tileId: string; cost: number; houses: number }
  | { type: 'buildingSold'; player: number; tileId: string; refund: number; houses: number }
  | { type: 'mortgaged'; player: number; tileId: string; amount: number }
  | { type: 'redeemed'; player: number; tileId: string; cost: number }
  | { type: 'tradeProposed'; offer: TradeOffer }
  | { type: 'tradeAccepted'; offer: TradeOffer }
  | { type: 'tradeRejected'; offer: TradeOffer }
  | { type: 'debtCreated'; debt: Debt }
  | { type: 'debtPaid'; debt: Debt; transfers: Array<{ to: CashTarget; amount: number }> }
  | { type: 'bankrupt'; player: number; creditor: Creditor; transfers: Array<{ to: CashTarget; amount: number }>; tilesTo: CashTarget | 'auction' }
  | { type: 'gameOver'; winner: number }
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
