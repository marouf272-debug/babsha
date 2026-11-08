# Decision log

Two lists: decisions taken (with who decided and why), and open questions waiting for the owner. Rules are never invented to close a question. A question closes only when the owner answers it, and the answer moves to the decisions list with its date.

## Decisions

| ID | Date | Decision | By | Reason |
|---|---|---|---|---|
| D-01 | 2026-11-08 | Plan v0.2 approved. docs/PLAN.md is the source of truth. | Owner | Approved in chat. |
| D-02 | 2026-11-08 | Project lives in `babsha/` inside the "Gaming with Claude" folder. | Builder | That folder already holds an unrelated Phaser demo. Left untouched. |
| D-03 | 2026-11-08 | Three.js pinned to `0.186.0`. `0.186.1` (a patch, published 2026-09-24) also exists. | Builder | r186 is the 0.186.0 release. Checked with `npm view three versions` and `REVISION = '186'` in node_modules/three/build/three.core.js. See Q-24. |
| D-04 | 2026-11-08 | CLAUDE.md sits at the repository root. | Builder | Plan 3.4 lists it under /docs, plan 4.1 says repository root. Claude Code loads it from the root. |
| D-05 | 2026-11-08 | Bangla review status is tracked in data/bn-review.json, one entry per Bangla key. A test fails if a Bangla key is untracked. | Builder | Keeps en.json and bn.json as plain key to string maps. The reviewer deletes entries as they approve them. |
| D-06 | 2026-11-08 | Card and UI text uses placeholders such as `{amount}`, `{tile}`, `{salary}`. Numbers live in cards.json and config.json, not in text. | Builder | A balance change then needs no text edit in two languages. |
| D-07 | 2026-11-08 | Hub and utility prices, hub rents, utility multiples and tax amounts live in config.json. Per-property prices, house costs and rents live in tiles.json. | Builder | Plan 3.3 and 2.3: uniform economy values in config, per-tile values in tiles. One source for each number. |
| D-08 | 2026-11-08 | Tooling: TypeScript 6.0.3, Vite 8.3.6, Vitest 5.1.0, ESLint 10.14.0 with typescript-eslint 8.72.1, Playwright 1.65.0, all pinned exact. | Builder | Current releases at install time. ESLint uses `defineConfig` from `eslint/config` because `tseslint.config` is marked deprecated in the installed package. |
| D-09 | 2026-11-08 | `npm audit` reports a moderate minimatch advisory inside the ESLint toolchain. Not fixed. | Builder | Dev tooling only, not shipped. The suggested fix downgrades ESLint with breaking changes. Recheck at S8. |
| D-10 | 2026-11-08 | Repo-local git identity set to the owner's name and work email. | Builder | No global git identity was configured. Change with `git config user.email` if you want a personal address on this project. |
| D-11 | 2026-11-08 | Engine and AI import boundaries are enforced by ESLint `no-restricted-imports`. | Builder | Plan 3.1 and 3.4. |
| D-12 | 2026-11-08 | Sprint S0 approved, including docs/RULES.md. | Owner | Answered in chat. |
| D-13 | 2026-11-08 | Q-01 closed: property prices, house costs and hotel cost field as proposed. Rents use the formula: base = price / 10 - 40; 1 house = 5 x base; 2 houses = 15 x base; 3 houses = 3 x price; 4 houses = 4 x price; hotel = 5 x price. Numbers may still change through S3 tuning. | Owner | Matches plan 2.3 and tunes with a few parameters. Hotel cost and sell back rules stay open in Q-03. |
| D-14 | 2026-11-08 | Q-04 closed: the doubles extra roll happens at END_TURN, after MANAGE, as in plan 3.2. | Owner | |
| D-15 | 2026-11-08 | Q-05 closed: passing GO or landing exactly on GO pays the salary, once per move. | Owner | Matches cards lucky_02 and dohs_01. |
| D-16 | 2026-11-08 | Q-09 closed: a mortgaged property collects no rent. | Owner | |
| D-17 | 2026-11-08 | Q-18 closed: each player rolls the two dice, the highest total goes first, tied players re-roll among themselves. Play then continues clockwise in seat order from the first player. | Owner | Uses the seeded dice. |
| D-18 | 2026-11-08 | Q-23 closed: Jam fine ৳500 and City Tax ৳1,000 are approved values, no longer assumptions. | Owner | |
| D-19 | 2026-11-08 | Q-24 closed for now: keep `three@0.186.0`. Read the 0.186.1 patch notes at the start of S4 and ask again if it matters. | Owner | |
| D-20 | 2026-11-08 | Q-22 closed for now: শুরু for GO, লাকি and ডিওএইচএস for the decks, as drafts pending native review. | Owner | The Bangla reviewer can change them in bn.json without code changes. |

## Open questions

Each needs an owner answer. The Blocks column names the sprint that cannot code the rule until it is answered. Closed questions move to the decisions list.

| ID | Question | Where it came from | Blocks |
|---|---|---|---|
| Q-02 | Plan 2.3 says keep the spec ratio of start cash to prices. The plan does not give the spec property prices, so I cannot check the ratio. With the proposal, start cash ৳10,000 is 2.5 times the top price. Is that the ratio you intended? | Plan 2.3 | S3 |
| Q-03 | Hotel cost and hotel sell back. Proposal: a hotel costs one more house cost; selling a hotel returns 50 percent of the hotel cost and leaves 4 houses. The plan states neither. | FR-06 | S2 |
| Q-06 | Jam, third failed turn: the fine is forced. Does the player then move by that third roll, or wait for the next turn? | Plan 2.3 | S2 |
| Q-07 | Leaving Jam by rolling doubles: does the player move by that roll, and do they get an extra roll? | Plan 2.3, 3.2 | S2 |
| Q-08 | While in Jam, can a player collect rent, buy, build, mortgage and trade? | Not in plan | S2 |
| Q-10 | Does unbuilt rent still double when one property in the full set is mortgaged? | Not in plan | S2 |
| Q-11 | Mortgage needs an "unimproved" property. Does that mean that property has no buildings, or the whole color set has none? | FR-07 | S2 |
| Q-12 | Confirm the S2 invariant "no buildings on mortgaged sets" as a rule: no building anywhere in a set while any property in it is mortgaged. | Plan 4.3 | S2 |
| Q-13 | Auction: may the player who declined bid? May a bid exceed the bidder's cash? How long is the decision timer, and is it on by default? | FR-04 | S2 |
| Q-14 | FR-08 says trades happen "with the board visible or hidden". What does that mean in practice? | FR-08 | S2 (engine), S4 (UI) |
| Q-15 | Trading a mortgaged property: "the receiver pays the 10 percent fee on redeeming". Is that the normal redeem cost (principal plus 10 percent), or an extra 10 percent on top? | Plan 2.3 | S2 |
| Q-16 | Bankruptcy to a player: are buildings sold to the bank first, and does the receiver of mortgaged property follow Q-15? Bankruptcy to the bank: are buildings removed before the auction? | Plan 2.3 | S2 |
| Q-17 | Decks: shuffled once at game start? Does a drawn card go to the bottom? Does a held Jam card leave the deck until used, and where does it go on bankruptcy? | Not in plan | S2 |
| Q-19 | Card effects are proposals: collect, pay, collect from each, pay each, move to a tile (clockwise, salary if GO is passed), move back, go to Jam, Jam exit card, repairs per house and hotel. Approve the effect set and the amounts. | Plan 3.8 | S2 |
| Q-20 | Turn timer (FR-14): default length, and what expiry does outside the buy decision (MANAGE, auction, DEBT). | FR-14, plan 3.2 | S2 |
| Q-21 | In DEBT, may a player trade to raise cash? Must buildings be sold before mortgaging? | Plan 3.2 | S2 |
