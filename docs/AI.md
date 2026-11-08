# Computer players (FR-13)

Status: S3 design. The AI never changes rules. It only picks one of the engine's legal actions.

## Shape

- `src/ai` imports only the engine (ESLint enforces this).
- `decide(context)` returns one legal action for one player. It is a pure function: the same
  state, profile, memory and random seed give the same action. AI randomness uses its own seeded
  generator, never the game's dice, so a game still replays exactly.
- A driver picks who must act now (active player, auction bidder in rotation, trade responder,
  or debtor) and asks that player's profile.
- Profile numbers live in `data/ai-profiles.json`, so they can be tuned without code edits.

## How it decides

Utility scoring, from the `ai-behavior-trees-utility-ai` skill: each option gets considerations
mapped to 0..1 by response curves, combined by product with compensation, then compared with a
threshold or with other options. Easy adds random noise to its scores.

Inputs every profile uses:

- **Tile value**: price times a multiplier for set progress (completing a set, extending one,
  blocking an opponent's set). Hard also weights tiles by how often they are landed on, estimated
  once by rolling the dice through the board.
- **Cash reserve**: a base amount plus a share of the worst rent an opponent could charge now.
  Spending below the reserve scores low.

| Decision | Rule of thumb |
|---|---|
| Buy | Buy when tile value is worth it and cash after buying stays near the reserve. Always buy a set completion if cash allows. In two-player games, Hard declines a tile its opponent has not started, to win it cheaper at auction. |
| Bid | Bid the minimum while it is below the player's own value for the tile and cash stays above half the reserve. Otherwise fold. |
| Build | Build on the set with the best rent gain per Taka while cash stays above the reserve. |
| Redeem | Redeem when cash is well above the reserve, set properties first. |
| Trade | At most once per turn: first a swap that completes a set for both players, otherwise cash for the one tile that completes its own set. Cash offers start at 1.5 times the price and rise 25 percent after each refusal, up to a ceiling that grows with spare cash. Every profile answers offers by value gained, and asks a premium for handing over a set unless the trade also completes one of its own. |
| Jam | Leave early in the game while properties are still unowned; Hard stays in Jam later on. |
| Debt | Pay when possible. Otherwise raise cash with the least valuable asset first: lone properties, then hubs and utilities, then buildings, then set properties. Bankruptcy only when nothing is left. |

## Profiles

| | Easy | Medium | Hard |
|---|---|---|---|
| Noise on scores | some | none | none |
| Reserve | large (timid, holds cash) | moderate | moderate, plus a share of the worst rent on the board |
| Set completion and blocking | weak | normal | strong |
| Landing frequency | not used | not used | used |
| Declines uncontested tiles to buy them at auction | no | no | yes, two-player games only |
| Trade offer ceiling | low | normal | high |
| Stays in Jam late game | no | no | yes |

## Tuning notes (S3)

Final numbers are in sim/reports/balance.md, section 2. In short:

- Head to head (600 games each): Medium beats Easy 57 percent, Hard beats Easy 62 percent, Hard beats Medium 53 percent.
- Three-player games (1,800): Medium 37 percent, Hard 33 percent, Easy 30 percent. These gaps are close to chance; the levels are only clearly different head to head.
- A first draft gave the opposite order. Two causes: buying single tiles to consolidate holdings handed cash to the seller, and Easy's random declines exploited cheap auctions. Consolidation trades were removed, Easy became a cash-hoarding player, and Hard's auction tactic is limited to two-player games, where auctions are cheap.

Exact numbers: `data/ai-profiles.json`.
