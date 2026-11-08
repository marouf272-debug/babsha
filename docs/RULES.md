# Babsha rules

Status: APPROVED by the owner on 2026-11-08 (sprint S0), with answers D-13 to D-20 in docs/DECISIONS.md applied. Source: docs/PLAN.md sections 2.1 to 2.4, plus the turn states in section 3.2 and the board in section 3.9.

How to read this document:

- Every rule has an ID (R-xx) and names its source: a requirement ID from plan 2.1, or a plan section.
- This document contains only rules stated in the plan. Where the plan is silent or unclear, the rule says so and points to an open question (Q-xx) in docs/DECISIONS.md. Those gaps are not filled here.
- Numbers come from data/config.json and data/tiles.json. Property prices, house costs and rents are approved (D-13) and may still be tuned in S3.
- Rules added from owner answers name their decision ID (D-xx).
- I do not have your original Business spec. Where the plan cites "Spec N", I only know what the plan says about it.

## 1. Board

- **R-01** The board is a loop of 40 tiles in the classic layout: 4 corners with 9 tiles between each pair of corners. (FR-01, plan 2.3)
- **R-02** The tiles are: 22 properties in 8 color groups, 4 transport hubs, 2 utilities, 2 tax tiles, 3 Lucky tiles, 3 DOHS tiles and 4 corners. (plan 2.3)
- **R-03** The color groups, in board order, hold 2, 3, 3, 3, 3, 3, 3 and 2 properties: Brown, Light blue, Pink, Orange, Red, Yellow, Green, Dark blue. (plan 3.9)
- **R-04** The corners are GO (position 0), Jam (10), Cha Adda (20) and Go to Jam (30). The full tile order is in data/tiles.json and matches plan 3.9. (plan 3.9)
- **R-05** Transport hubs: Kamalapur Railway Station, Sadarghat Launch Terminal, Gabtoli Bus Terminal, Hazrat Shahjalal Airport. Utilities: DESCO and Dhaka WASA. (plan 2.4)

## 2. Players and setup

- **R-06** A game has 2 to 6 players. (FR-01)
- **R-07** Each player starts with ৳10,000. Starting cash can be changed in game settings. (plan 2.4, FR-14)
- **R-08** Tokens: Rickshaw, CNG auto, Ilish, kite, tea cup, bus. HUD colors: Red, Blue, Green, Yellow, Purple, Cyan. (plan 2.4)
- **R-09** To choose who goes first, each player rolls the two dice. The highest total goes first. Tied players re-roll among themselves. Play then continues clockwise in seat order from the first player. (D-17)

## 3. Turn sequence

- **R-10** A turn moves through these states: START_TURN, ROLL, MOVE, RESOLVE, then BUY_DECISION or AUCTION where they apply, then MANAGE, then END_TURN. A DEBT state can be entered at any time and returns to the previous state or ends in GAME_OVER. (plan 3.2)
- **R-11** In Pass & Play, START_TURN shows a hand-off screen and the next player taps to reveal their view. (FR-12, plan 3.2)
- **R-12** In MANAGE the active player may build, sell, mortgage, redeem and trade, also while in Jam. These happen only after the roll is resolved. (plan 3.2, D-42, D-46)

## 4. Dice, doubles and movement

- **R-13** The active player rolls two six-sided dice and moves clockwise by their sum. (FR-01)
- **R-14** Rolling doubles gives an extra roll. (FR-02) The extra roll happens at END_TURN, after the player has resolved the tile and had the chance to manage (build, sell, mortgage, redeem, trade). (plan 3.2, D-14)
- **R-15** Rolling doubles three times in a row sends the player to Jam. (FR-02, plan 3.2)
- **R-16** Passing GO or landing exactly on GO pays the salary of ৳2,000, once per move. (plan 2.4, plan 3.2, D-15)

## 5. Landing on a tile

### 5.1 Unowned property, hub or utility

- **R-17** Landing on an unowned property opens its title deed, showing price, mortgage value and rent schedule, and offers Buy or Auction. (FR-03)
- **R-18** If the player declines, or the decision timer ends, the property goes to a live auction. A timer expiry counts as declining. (FR-04, plan 3.2)

### 5.2 Auction

- **R-19** The auction is live, with bid buttons, a slider, fold and a log. It ends when one bidder remains. (FR-04)
- **R-20** The opening bid is ৳0 and the minimum raise is ৳100: the first bid may be ৳0, each later bid at least ৳100 more. The high bidder cannot fold, and wins when everyone else has folded. (plan 2.3, D-43)
- **R-21** If every player folds, the property stays unowned. (plan 2.3)
- **R-22** Every active player may bid, including the player who declined. A bid cannot exceed the bidder's cash. (D-33)

### 5.3 Rent

- **R-23** Property rent depends on the number of houses, using the property's rent schedule. (FR-05)
- **R-24** Rent on an unbuilt property doubles when its owner holds the full color set. (FR-05, plan 2.3)
- **R-25** Transport hub rent depends on how many hubs the owner holds: ৳250, ৳500, ৳1,000 or ৳2,000 for 1, 2, 3 or 4 hubs. (FR-05, plan 2.4)
- **R-26** Utility rent is the dice total times ৳40 if the owner holds one utility, or times ৳100 if the owner holds both. (FR-05, plan 2.4)
- **R-27** A mortgaged property collects no rent. (D-16)
- **R-27a** An owner in Jam still collects rent. (D-22) Unbuilt rent still doubles when one member of the full set is mortgaged. (D-32) Mortgaged hubs and utilities still count toward the number owned. (D-35)

### 5.4 Tax tiles

- **R-28** Super Tax (position 4) charges a flat ৳1,000. (plan 2.4, plan 3.9)
- **R-29** City Tax (position 38) charges a flat ৳1,000. (plan 3.9, D-18)

### 5.5 Card tiles

- **R-30** There are two decks, Lucky and DOHS. Landing on a Lucky or DOHS tile draws a card automatically and shows it in an overlay. (FR-09)
- **R-31** Each deck has 16 cards. (plan 3.8) Card effects and amounts are in data/cards.json, approved (D-41). A card that moves a player to a tile then resolves that tile normally. (D-41)
- **R-32** A Jam exit card can be held and used later. (plan 2.3, "use a held card")
- **R-33** Each deck is shuffled once at game start. A drawn card goes to the bottom of its deck. A held Jam exit card leaves the deck until used, then goes to the bottom. On bankruptcy it returns to the bottom of its deck. (D-40)

### 5.6 Corners

- **R-34** Cha Adda is a neutral rest stop. Nothing happens and there is no money pool. (plan 2.3)
- **R-35** Landing on Go to Jam sends the player to Jam. (FR-10, plan 3.9)
- **R-36** Landing on Jam by a normal move means just passing. (plan 3.9, "Just passing, or stuck")

## 6. Building

- **R-37** A player may build houses only on a full color set they own. Houses go on evenly across the set. (FR-06)
- **R-38** Up to 4 houses per property, then a hotel. (FR-06)
- **R-39** Buildings sell back to the bank at 50 percent of their cost, following the even rule in reverse. (FR-06)
- **R-40** House supply is unlimited. (plan 2.3)
- **R-41** No property in a set may carry buildings while any property in that set is mortgaged. (plan 4.3, D-31)
- **R-42** House costs are set per color group in data/tiles.json. (D-13) A hotel needs 4 houses on every property in the set and costs one more house cost. Selling a hotel returns 50 percent of its cost and leaves 4 houses. (D-29)

## 7. Mortgage

- **R-43** A property can be mortgaged for 50 percent of its face value only when its whole color set has no buildings. (FR-07, D-30)
- **R-44** Redeeming costs the principal plus 10 percent. (FR-07)

## 8. Trading

- **R-45** Any two active players may trade properties and cash with each other. (FR-08)
- **R-46** Properties with buildings cannot be traded, and a property can be traded only when its whole color set has no buildings. (plan 2.3, D-44) Trades cover properties and cash only. (D-51)
- **R-47** A mortgaged property can be traded. The receiver redeems it at the normal cost, principal plus 10 percent, with no extra fee at the trade. (plan 2.3, D-37)
- **R-48** The trade sheet can be collapsed to show the board. This is an interface feature, not an engine rule. (FR-08, D-36)

## 9. Jam

- **R-49** A player goes to Jam by rolling a third double (R-15), landing on Go to Jam (R-35), or by a card. Going to Jam is a direct jump and never pays the GO salary. (FR-02, FR-10, D-23)
- **R-50** To leave Jam, a player pays a fine of ৳500, rolls doubles, or uses a held card. A held card is used before rolling, like the fine. (plan 2.3, D-18, D-47)
- **R-51** A player who pays the fine does so before rolling, then rolls and moves normally. (D-21, D-25) A player who rolls doubles leaves Jam and moves by that roll. (D-21) After 3 failed rolls, the fine is forced and the player moves by that third roll. (plan 2.3, D-21)
- **R-52** A player in Jam does not take the doubles extra roll, and leaving Jam by rolling doubles gives no extra roll. (plan 3.2, D-21) After being sent to Jam the turn ends with no extra roll. (D-26)

## 10. Debt, bankruptcy and winning

- **R-53** A player who owes more than they hold enters DEBT and must resolve it by selling buildings, mortgaging, trading, or declaring bankruptcy. Several debts are settled one debtor at a time, then the turn continues. (plan 3.2, D-39, D-49)
- **R-54** A player bankrupt to another player transfers all their assets to that player. (plan 2.3)
- **R-55** A player bankrupt to the bank returns their properties to auction, one at a time in board order. (plan 2.3, D-50) A player made bankrupt by a "pay each player" card splits remaining cash equally among the players owed, remainder to the bank, and their properties go to auction. (D-45, D-48)
- **R-56** The last solvent player wins. (FR-11, plan 2.3)
- **R-57** In a bankruptcy, buildings are first sold to the bank at 50 percent. Bankrupt to a player: cash and properties pass on, mortgages stay. Bankrupt to the bank: mortgages are cleared and the properties are auctioned. (D-38) A player in DEBT may trade, sell buildings and mortgage. (D-39)

## 11. Modes and settings

- **R-58** Release 1 has Pass & Play and vs Computer. (plan decisions table, FR-12, FR-13)
- **R-59** vs Computer has Easy, Medium and Hard profiles that buy, bid, build, mortgage and trade. (FR-13)
- **R-60** Settings: player count, starting cash, optional turn timer. (FR-14) The timer is off by default, 30 seconds per decision when on. Expiry takes the passive choice: decline the buy, fold the bid, end the turn, reject a waiting trade. No timer in DEBT or before the roll. (D-34, D-52)
- **R-61** A game can be saved and resumed on the same device, if feasible. (FR-19)
- **R-62** Not in release 1: board pan, zoom and auto-focus (FR-18, dropped), online matchmaking and rooms (FR-20, Won't).

## 12. Language, currency and interface

- **R-63** The whole interface, every card and every tile name is available in Bangla and English, with a live toggle. (FR-15)
- **R-64** Money is in Taka (৳), with an optional Bangla digit setting. (FR-16)
- **R-65** The HUD shows each player's avatar, name, cash and token. A fixed action bar offers Build, Sell, Mortgage, Redeem and Trade. (FR-17)

## 13. Economy numbers

All amounts are the spec amounts times 10. (plan 2.4)

| Item | Value | Source |
|---|---|---|
| Start cash | ৳10,000 | plan 2.4 |
| GO salary | ৳2,000 | plan 2.4 |
| Hub price | ৳2,000 | plan 2.4 |
| Hub rent, 1 to 4 hubs | ৳250, ৳500, ৳1,000, ৳2,000 | plan 2.4 |
| Utility price | ৳1,500 | plan 2.4 |
| Utility rent | dice x ৳40 (one), dice x ৳100 (both) | plan 2.4 |
| Super Tax | ৳1,000 | plan 2.4 |
| City Tax | ৳1,000 | plan 3.9, D-18 |
| Jam fine | ৳500 | plan 2.3, D-18 |
| Mortgage value | 50 percent of face value | FR-07 |
| Redeem cost | principal plus 10 percent | FR-07 |
| Building sell back | 50 percent | FR-06 |
| Auction | opens at ৳0, minimum raise ৳100 | plan 2.3 |
| Property prices, house costs, rents | data/tiles.json, rent formula in D-13 | D-13 |

## 14. Content mapping

From plan 2.4: currency Taka (৳); 8 groups of Dhaka areas; Jail is Jam (stuck in traffic) and Go to Jam; Free Parking is Cha Adda; Start is GO; Chance is Lucky; Community Chest is DOHS. Card themes: traffic, road construction, rain and waterlogging, tea, Eid shopping, Pohela Boishakh, Boi Mela, load-shedding, Metro Rail. No sports. Card tone (plan 3.8): shared daily life humor; no party politics, religion or poverty; never a neighborhood as the punchline.
