Dhaka Business Game

SDLC plan for a browser board game set in Dhaka

------------------------------------------------------------------------

Version 0.2, 8 November 2026. Owner: Marouf Hossain. Approved by the owner in chat on 8 November 2026. This is a personal project, shared with friends by link. Plan only: nothing is built yet. This document is the build brief for Claude Code.

Working title: Babsha (ব্যবসা, Bangla for business). The title is a placeholder.

# How this plan is organized

The plan follows the classic software development life cycle: planning, requirements, design, implementation, testing, deployment and maintenance. The front half (phases 1 to 3) is done in a waterfall style, with decisions locked at a gate before the next phase starts. The back half (phases 4 to 6) runs as short iterations. The reason for the split: in a board game, an unclear rule found late costs more than any other kind of bug, so rules are frozen early and code is built in small, testable pieces afterward.

Each phase ends with a gate. Gates 1 and 2 are approved. The rest are reviewed by you as each sprint finishes.

### **Decisions already made**

| **Topic** | **Decision** | **Note** |
|----|----|----|
| Project type | Personal, shared with friends | Not a Get Levrg project. Friends-only means a plain link, no store listing. |
| Platform | Browser game, no install | Runs from a link on a phone or laptop. |
| Release 1 modes | Pass & Play and vs Computer | No server needed. Online rooms are designed for later, not built. |
| Primary device | Phone, portrait | Desktop works but is not the design target. |
| Renderer | Three.js, r186 | Isometric look from a fixed orthographic camera. Version matches the installed game development skills. |
| Art | Made by Claude Code, in code | You give direction and style screenshots. See section 3.7 for what this can and cannot produce. |
| Language | Bangla and English with a toggle | Approved. Every string in both languages. |
| Currency | Taka (৳) | Approved, with the ×10 scaling in section 2.4. |
| Builder | Claude Code on Opus 5.5 | Game development skills installed. Section 4.2 maps them to sprints. |

# Phase 1. Planning

## 1.1 Goal

A property trading board game, mechanically based on your Business spec and the classic Monopoly layout, re-set in Dhaka, that you and your friends can play in a phone browser with no install, no account and no server in release 1.

## 1.2 Scope

In scope for release 1: the full rules engine from the spec, Pass & Play for 2 to 6 players, vs Computer at three difficulty levels, a bilingual interface, an isometric 3D board with animated tokens and dice, save and resume where feasible, and offline play after the first load.

Out of scope for release 1: online matchmaking, private rooms with 6-character codes, accounts, leaderboards, ads, purchases, chat, and camera pan and zoom. The engine is built so online play can be added in release 2 without a rewrite.

## 1.3 Roles

| **Role** | **Who and what they do** |
|----|----|
| Product owner | Marouf. Approves each sprint, owns rule decisions, supplies style screenshots, reviews Dhaka content for authenticity. |
| Builder and artist | Claude Code. Writes the engine, interface, tests, art and deployment setup from this plan. |
| Bangla reviewer | You or a friend who reads Bangla well. Checks every string and card before sharing. |
| Playtesters | Your friends. Two sessions of four to six people. |

## 1.4 Feasibility

Technical: a 40-tile board with up to six players is light for the logic. The real risks are performance of 3D on low-end phones and how good code-made art can look. Both are tested early, at the sprint 5 gate.

Cost: the toolchain and static hosting can run on free tiers. I have not verified current limits of any hosting plan, so check them when you pick a host. The main cost is your Claude Code usage.

Schedule: I am not giving dates. The art prototype in sprint 5 is where the schedule becomes realistic.

## 1.5 Success criteria

1.  A group of four finishes a full game on phones without a rules dispute that the game itself cannot settle.

2.  A computer-only game of any difficulty runs to a winner without errors, thousands of times in a row in the simulator.

3.  The game holds a playable frame rate on a mid-range Android phone. You set the test phone and the target frame rate before sprint 5.

4.  A Bangladeshi player looking at the board with the names covered still says Dhaka, not India.

## 1.6 Gates

| **Gate** | **Closes** | **Outputs you confirm** | **Status** |
|----|----|----|----|
| G1 | Phase 1 Planning | Scope, success criteria, roles. | Approved 8 Nov 2026 |
| G2 | Phase 2 Requirements | Requirement list, rule decisions, economy numbers and names. | Approved 8 Nov 2026 |
| G3 | Phase 3 Design | Architecture, board layout, camera and art style, content files. | Approved in this version; art style confirmed again at sprint 5 |
| G4 | Phase 4 Implementation | Engine, interface and art complete, sprint checks passed. | Open |
| G5 | Phase 5 Testing | Test report, playtest notes, Bangla review. | Open |
| G6 | Phase 6 Deployment | Live link, rollback tested, release checklist. | Open |

# Phase 2. Requirements

Priority uses MoSCoW: Must, Should, Could. Spec references point to your Business specification document.

## 2.1 Functional requirements

| **ID** | **Requirement** | **Priority** | **Source** |
|----|----|----|----|
| FR-01 | 40-tile loop board in the classic Monopoly layout (9 tiles between corners on each side), clockwise movement by the sum of two six-sided dice, for 2 to 6 players. | Must | Spec 3, approved |
| FR-02 | Doubles give an immediate extra roll. Three doubles in a row send the player to Jam (jail). | Must | Spec 4 |
| FR-03 | Landing on an unowned property opens a title deed with price, mortgage value and rent schedule, and offers Buy or Auction. | Must | Spec 4 |
| FR-04 | Live auction when a player declines or the decision timer ends: bid buttons, slider, fold, log. Ends when one bidder remains. | Must | Spec 4 |
| FR-05 | Rent rules: property rent by houses, doubled on an unbuilt full set, transport hub rent doubling per hub owned, utility rent as a multiple of the dice total. | Must | Spec 3, approved |
| FR-06 | Build houses evenly across a full color set, up to 4 houses, then a hotel. Sell back at 50 percent with reverse even rule. | Must | Spec 5 |
| FR-07 | Mortgage unimproved property for 50 percent of face value. Redeem by paying the principal plus 10 percent. | Must | Spec 5 |
| FR-08 | Bilateral trade of properties and cash between any two active players, with the board visible or hidden. | Must | Spec 5 |
| FR-09 | Two card decks, Lucky and DOHS, drawn automatically with an overlay. | Must | Spec 3, approved names |
| FR-10 | Jam (jail) entry, exit options and Go to Jam tile. | Must | Approved defaults |
| FR-11 | Bankruptcy resolution and a defined winner. | Must | Approved defaults |
| FR-12 | Pass & Play with a hand-off screen between turns so the next player taps to reveal their view. | Must | Spec 2 |
| FR-13 | vs Computer with Easy, Medium and Hard profiles that buy, bid, build, mortgage and trade. | Must | Spec 2 |
| FR-14 | Game settings: player count, starting cash, optional turn timer. | Should | Spec 2 |
| FR-15 | Bangla and English interface with a live language toggle, including all cards and tile names. | Must | Approved |
| FR-16 | Taka formatting with an optional Bangla digit setting. | Should | Approved |
| FR-17 | Player HUD cards showing avatar, name, cash and token, and a fixed action bar for Build, Sell, Mortgage, Redeem and Trade. | Must | Spec 6 |
| FR-18 | Board pan, zoom and auto-focus on the active token. | Dropped | Not needed |
| FR-19 | Save and resume a game on the same device. | Should | Approved if feasible |
| FR-20 | Online matchmaking and private rooms with 6-character codes. | Won't (release 1) | Spec 2 |

## 2.2 Non-functional requirements

| **Area** | **Requirement** |
|----|----|
| Devices | Current Chrome on Android, current Safari on iOS, current Chrome and Edge on desktop. Exact versions fixed when the test phone is chosen. |
| Performance | Smooth animation on the chosen mid-range Android phone. Triangle, draw call and texture budgets are set by measurement in sprint 5, not guessed now. |
| Camera | One fixed orthographic camera that shows the whole board at once in portrait and landscape. No pan or zoom. |
| Offline | After the first visit the game starts and plays Pass & Play and vs Computer with no connection. |
| Touch | Every tap target at least 44 by 44 pixels. Bid and build controls reachable with one thumb in portrait. |
| Accessibility | Color sets are also marked by a symbol or pattern, never by color alone. Readable text sizes. Contrast checked on every text and background pair. |
| Privacy | No accounts and no tracking. Saved games stay on the device. |
| Localization | No text hard-coded in code. Every string comes from a language file. Layouts survive Bangla text, which runs taller and sometimes longer than English. |
| Maintainability | Rules live in a pure logic module with no drawing code. Prices, rents, cards and tile names live in data files so balance changes need no code edits. |

## 2.3 Rule decisions (approved)

These are the defaults I proposed for the gaps in your spec, now approved. Two values are my assumptions because you did not state them: the jail fine and the second tax tile. They are listed in Appendix C.

| **Rule** | **Decision** |
|----|----|
| Board shape | Classic Monopoly layout: 4 corners and 9 tiles on each side, 40 in total. |
| Tile inventory | 22 properties, 4 transport hubs, 2 utilities, 2 taxes, 3 Lucky tiles and 3 DOHS tiles, 4 corners. |
| Jam (jail) exit | Pay a fine of ৳500, roll doubles, or use a held card. After 3 failed turns the fine is forced. |
| Rent tables | House and hotel prices and rents generated from a formula based on price, then tuned by simulation. Stored in tiles.json. |
| Monopoly rent | Unbuilt rent doubles when a player owns the full color set. |
| Bankruptcy | Debt to a player transfers all assets to that player. Debt to the bank returns properties to auction. Last solvent player wins. |
| Free Parking (Cha Adda) | Neutral rest stop, no money pool. A pool toggle can come later as a house rule. |
| House supply | Unlimited, as in the spec. |
| Auction | Opening bid zero, minimum raise ৳100. If everyone folds the property stays unowned. |
| Trading | Properties with buildings cannot be traded. A mortgaged property can be traded, and the receiver pays the 10 percent fee on redeeming. |
| Starting economy | Keep the spec ratio of start cash to prices. The simulator shows whether it snowballs, and numbers can change in config.json. |

## 2.4 India to Dhaka content mapping

Scaling: every spec amount is multiplied by 10 so the numbers feel like real Taka. Start cash is ৳10,000, GO pays ৳2,000, hubs cost ৳2,000, utilities cost ৳1,500, Super Tax is ৳1,000. Utility rent is ৳40 times the dice total with one utility and ৳100 times with both. Hub rent is ৳250, ৳500, ৳1,000 and ৳2,000.

| **Element** | **India spec** | **Dhaka version** |
|----|----|----|
| Currency | Rupee (₹) | Taka (৳). |
| Color sets | 8 groups of Indian cities | 8 groups of Dhaka areas, 22 in total, listed in section 3.9. |
| Transport hubs | Howrah, CST, New Delhi, Chennai Central | Kamalapur Railway Station, Sadarghat Launch Terminal, Gabtoli Bus Terminal, Hazrat Shahjalal Airport. |
| Utilities | Electric Company, Water Works | DESCO and Dhaka WASA. |
| Jail | Jail, Go To Jail | Jam (stuck in traffic) and Go to Jam. |
| Free Parking | Free Parking | Cha Adda (a tea stall chat break). |
| Start | GO | GO. |
| Chance deck | Chance | Lucky. |
| Community deck | Community Chest | DOHS. |
| Tokens | Six colored pawns | Rickshaw, CNG auto, Ilish (hilsa), kite, tea cup, bus. Colors stay Red, Blue, Green, Yellow, Purple, Cyan for the HUD. |
| Card themes | School fees, Indian cities | Traffic, road construction, rain and waterlogging, tea, Eid shopping, Pohela Boishakh, Boi Mela, load-shedding, Metro Rail. No sports. |
| Script and type | Likely Devanagari or Latin | Noto Sans Bengali for Bangla and a plain system sans for English. No decorative fonts. Check the font license when adding it. |

# Phase 3. Design

## 3.1 Architecture

The most important design choice is to split the game into a rules engine and everything else. The engine is plain TypeScript with no drawing code. It takes the current game state and a player action and returns the new state plus a list of events. The 3D scene reads those events and animates them. The AI players call the same engine. A future online server can run the same engine unchanged.

That split pays for itself four ways: the rules can be tested without a screen, computer players are easy to write, thousands of AI games can run in seconds to tune the economy, and release 2 online play does not need a rewrite.

| **Layer** | **Choice** | **Reason** |
|----|----|----|
| Language and build | TypeScript with Vite | Fast builds, type safety helps avoid rule bugs. |
| Rules engine | Pure module, seeded random numbers | The same dice sequence replays the same game, which makes bugs reproducible. |
| 3D scene | Three.js r186, orthographic camera | Your choice. Version matches the installed skills. Verify the exact npm version string before pinning. |
| Models | Procedural geometry built in code | No model files to author. Merge geometry and instance repeated parts to keep draw calls low. |
| Tile signage | Canvas-drawn textures after fonts load | The browser's text engine shapes Bangla correctly. Wait for the font to load before drawing. |
| Interface | HTML and CSS layered over the canvas | Modals, forms and sliders are easier to build and to make accessible in HTML. |
| Language files | en.json and bn.json with string keys | No hard-coded text. Numbers formatted with the browser's Intl support. |
| Audio | Web Audio, sounds synthesized in code | No sound files to license. |
| Saves | Browser local storage, versioned schema | Release 1 needs no backend. |
| Testing | Vitest for logic, Playwright for end to end and screenshots | Standard tools for this stack. |
| Hosting | Static host | Free options exist. Confirm limits when choosing. |

### **What Three.js costs you**

Three.js was your pick, and it fits an isometric look well because a fixed orthographic camera gives a true isometric view with real depth and lighting. The costs are real, though. It is heavier than a 2D renderer on low-end Android phones, and every building has to exist as geometry. In this project that geometry is generated in code. The unverified part is how it runs on the phones your friends actually own, so the sprint 5 gate measures it on a real device before the full art is built. Performance practice: merge static geometry, instance repeated parts, cap the device pixel ratio, avoid post-processing, and keep shadows cheap.

### **The game development skills repository**

The repository you sent is awesome-gamedev-agent-skills. From the PDF: 77 skills, a router that picks skills for each request, installed with npx skills add gamedev-skills/awesome-gamedev-agent-skills or as a Claude Code plugin, Apache-2.0 licensed. Its web engines group is pinned to Phaser 4.2, PixiJS 8.22 and three.js r186, which is why this plan pins Three.js to r186. Section 4.2 lists the skills that apply here. I have read the catalog table in the PDF but not the individual skill files, so how good each one is remains unverified.

## 3.2 Turn state machine

| **State** | **What happens** | **Next** |
|----|----|----|
| START_TURN | Active player is set. In Pass & Play, show the hand-off screen. | ROLL |
| ROLL | Two dice roll. Doubles counter is updated. Three doubles go to Jam. | MOVE or JAM |
| MOVE | Token animates clockwise. Passing GO pays the salary. | RESOLVE |
| RESOLVE | Landing tile is evaluated: pay rent, open deed, draw card, pay tax, or go to Jam. | BUY_DECISION, AUCTION, or MANAGE |
| BUY_DECISION | Player buys or declines. A timer expiry counts as declining. | AUCTION or MANAGE |
| AUCTION | Live bidding until one bidder remains. | MANAGE |
| MANAGE | Build, sell, mortgage, redeem and trade are available. | END_TURN |
| END_TURN | If the player rolled doubles and is not in Jam, roll again. Otherwise pass the turn. | START_TURN or ROLL |
| DEBT | Entered any time a player owes more than they hold. Resolve by selling, mortgaging or declaring bankruptcy. | Previous state or GAME_OVER |
| GAME_OVER | One solvent player remains. | Results screen |

## 3.3 Data files

Game content lives in data so balance and wording can change without touching code: tiles.json for the 40 tiles with prices, rents and group, cards.json for the Lucky and DOHS decks, config.json for the economy numbers, and en.json plus bn.json for all text. Every card and tile name has a key in both language files. A build check fails if a key exists in one language and not the other.

## 3.4 Repository layout

| **Folder** | **Purpose** |
|----|----|
| /docs | This plan, the rules document, CLAUDE.md working agreement, decision log. |
| /docs/reference | Your style screenshots and notes. |
| /docs/style-guide.md | The locked visual target written in sprint 5: palette tokens, proportions, edge and lighting rules. |
| /src/engine | Rules engine. No imports from the interface or the scene. |
| /src/ai | AI profiles (Easy, Medium, Hard) that only call the engine. |
| /src/scene | Three.js scene, camera presets, tokens, dice and animations driven by engine events. |
| /src/scene/models | Procedural builders for tiles, buildings, houses, hotels and tokens. |
| /src/ui | HTML and CSS screens, HUD, modals for deed, auction, trade and cards. |
| /src/i18n | Language loader and number formatting. |
| /src/audio | Synthesized sound effects. |
| /data | tiles.json, cards.json, config.json, en.json, bn.json. |
| /sim | Headless AI-versus-AI simulation harness and its reports. |
| /tests | Unit, simulation and end-to-end tests. |

## 3.5 Interface design

Portrait phone layout from top to bottom: a slim top strip with the current turn and a menu button, the board taking most of the screen, a compact player strip showing cash for every player, and a fixed action bar at the bottom with Roll and the management buttons. Deeds, auctions, trades and cards open as sheets that slide up from the bottom so the board stays partly visible. Desktop uses the landscape layout from the spec: player cards on the sides, board in the middle, action bar along the bottom.

## 3.6 Camera

The camera is fixed because pan and zoom were dropped. That makes the choice of angle matter more. A square board rotated 45 degrees becomes a diamond whose width equals the board's diagonal, about 1.4 times a side, which wastes portrait phone screens. Tall buildings can also hide tiles behind them, which hurts reading ownership.

Sprint 5 builds the camera as a config of azimuth, elevation and zoom and tests at least two presets on the real phone: the classic isometric diamond, and a tilted tabletop view with no rotation. Tile ownership is also shown with flat colored bands and flags on tile edges so it reads even when a building overlaps. You pick the preset after seeing both.

## 3.7 Visual direction and how the art gets made

The look is a warm, bold isometric Dhaka city with rickshaw-art color and Bangla signage. Tiles are modular: one base tile plus a small set of building shapes recolored per group.

All art is made by Claude Code in code: low-poly buildings from Three.js geometry, canvas and SVG-style textures for signage and rickshaw-art patterns, and synthesized sound. You provide direction and style screenshots. In sprint 5 Claude Code studies your screenshots, writes them into a style guide, and then checks each model against that guide by rendering the scene and taking screenshots with Playwright.

One limit to accept up front: code-made art gives a stylized low-poly or flat-shaded look. It does not give a hand-painted raster illustration. The create-game-assets skill covers art direction and a production pipeline, and may offer more, but I have not verified that, so treat it as unconfirmed. If you want painted textures, you will need to supply the image files.

### **Keeping the India look out**

- No Devanagari or Latin-only signage. Bangla script on every sign is the strongest single signal of Dhaka.

- Palette from Bangladesh and rickshaw art: deep green, red, bright floral and bird motifs. Avoid saffron-heavy palettes and tricolor schemes.

- No generic subcontinental skyline filler such as domes and minarets. Every tile has one Dhaka-specific anchor: a rickshaw, kites, an Ilish, river launches, Metro Rail, or a named landmark.

- Review test for every tile: if the name is covered, would a Bangladeshi viewer still say Dhaka. If not, redo it.

## 3.8 Content tone for cards

Keep cards to shared daily life humor: traffic, road construction, rain, tea, Eid shopping, load-shedding. No sports. Keep party politics, religion and poverty out, and never make a neighborhood the punchline. Plan on 16 cards per deck, 32 in total, each in both languages, and have the Bangla read by someone who reads it well.

## 3.9 Board draft, 40 tiles

Position order follows the classic layout. Your swaps are applied. The art hooks are my suggestions and should be checked against your own knowledge of each area.

| **Pos** | **Tile** | **Type** | **Art hook or note** |
|----|----|----|----|
| 0 | GO | Corner | Collect ৳2,000 |
| 1 | Puran Dhaka | Brown | Old Dhaka rooftops and kites |
| 2 | DOHS | Community deck |  |
| 3 | Chawk Bazar | Brown | Narrow lanes, old balconies |
| 4 | Super Tax | Tax | ৳1,000 flat |
| 5 | Kamalapur Railway Station | Transport hub |  |
| 6 | Jatrabari | Light blue | Flyover |
| 7 | Lucky | Chance deck |  |
| 8 | Motijheel | Light blue | Commercial district |
| 9 | Basabo | Light blue |  |
| 10 | Jam (Stuck in Traffic) | Corner | Just passing, or stuck |
| 11 | Mirpur | Pink | Zoo area |
| 12 | DESCO | Utility |  |
| 13 | Mohammadpur | Pink |  |
| 14 | Shyamoli | Pink |  |
| 15 | Sadarghat Launch Terminal | Transport hub | River launches |
| 16 | Farmgate | Orange |  |
| 17 | DOHS | Community deck |  |
| 18 | Karwan Bazar | Orange | Wholesale market |
| 19 | Tejgaon | Orange | Industrial area |
| 20 | Cha Adda | Corner | Free rest stop |
| 21 | TSC | Red | University area |
| 22 | Lucky | Chance deck |  |
| 23 | Paltan | Red |  |
| 24 | Shahbag | Red | National Museum area |
| 25 | Gabtoli Bus Terminal | Transport hub |  |
| 26 | Mohakhali | Yellow | Bus terminal area |
| 27 | Bashundhara R/A | Yellow | Large shopping mall |
| 28 | Dhaka WASA | Utility |  |
| 29 | Lalmatia | Yellow |  |
| 30 | Go to Jam | Corner | Sends player to Jam |
| 31 | Dhanmondi | Green | Lake |
| 32 | Banani | Green |  |
| 33 | DOHS | Community deck |  |
| 34 | Uttara | Green | Metro Rail |
| 35 | Hazrat Shahjalal Airport | Transport hub |  |
| 36 | Lucky | Chance deck |  |
| 37 | Gulshan | Dark blue | Lake and circle |
| 38 | City Tax | Tax | ৳1,000 flat (my assumption) |
| 39 | Baridhara | Dark blue | Lakeside |

Check: 22 properties across 8 groups of 2, 3, 3, 3, 3, 3, 3 and 2, plus 4 hubs, 2 utilities, 2 taxes, 6 card tiles and 4 corners gives 40.

## 3.10 Art asset list

| **Asset** | **Count** | **Note** |
|----|----|----|
| Base tile, side and corner | 1 kit | Everything else sits on it. |
| Corner scenes | 4 | GO, Jam, Cha Adda, Go to Jam. |
| Property building kits | 8 to 22 | One kit per color group with variants, or one model per property. Decided at the sprint 5 gate. |
| House and hotel | 2 models | Reused everywhere. |
| Transport hubs and utilities | 6 | Rail, launch, bus, air, DESCO, WASA. |
| Card and tax tiles | 8 | Tile icons for Lucky, DOHS and taxes. |
| Tokens | 6 | Rickshaw, CNG, Ilish, kite, tea cup, bus. |
| Dice | 1 | One model, used twice. |
| Avatars and UI icons | 6 plus set | Consistent with the style guide. |
| Audio | Small set | Dice, buy, rent, card, auction bell, jam horn. Synthesized in code. |

# Phase 4. Implementation plan

This phase is written for Claude Code. The unit of work is a sprint, and each sprint has stories with acceptance checks. Claude Code works one sprint at a time, runs the tests, and stops at the sprint check for your review.

## 4.1 Working agreement with Claude Code

These rules go into a CLAUDE.md at the repository root so every session starts from the same instructions:

- This plan and the rules document are the source of truth. If the code and the rules document disagree, ask before changing either.

- The engine folder never imports from the scene or the interface. Tests for any new rule go in before the rule is coded.

- No text strings in code. Every visible string gets a key in both en.json and bn.json.

- Do not invent rules. If a rule is missing, list it in the decision log and wait for an answer.

- Pin Three.js to r186. Verify the exact npm version string before adding it.

- Work on one sprint at a time. Finish by running all tests and listing which acceptance checks pass.

- Commit after each completed story with a message that names the requirement ID.

- Record the license of every font and any third-party file added.

## 4.2 Installed skills and where they apply

The router skill picks skills automatically from the task, so these names are hints, not a script. Claude Code should still read a skill's instructions before relying on it.

| **Skill** | **Scope, from the repository catalog** | **Sprints** |
|----|----|----|
| router | Detects the engine and task and loads the matching skills. | All |
| threejs-scene-setup | Scene, camera, renderer, animation loop, resizing, controls. | S4, S5 |
| threejs-materials-lighting | Materials, lights, shadows, environment maps. | S5, S6 |
| threejs-gltf-loading | glTF and GLB loading and animation. Only if you supply model files. | S6, optional |
| create-game-assets | Art direction and production pipeline for cohesive tiles, textures, icons, UI art and 3D assets. | S5, S6 |
| card-game | Card data, deck and discard zones, play rules, turn structure. | S1, S2 |
| puzzle | Grid and board state, rule resolution, undo. | S1, S2 |
| procedural-gen | Noise, random numbers and seeds. | S1 (seeded dice and shuffles) |
| game-ai | Decision-making, state machines, behavior trees. | S3 |
| ai-behavior-trees-utility-ai | Utility AI with curves and considerations, hybrid AI. | S3 (buy, bid and build scoring) |
| level-design | Grid layout and whitebox structure. | S4 |
| game-ui-ux | HUD and menus, resolution scaling, safe areas. | S4 |
| input-systems | Input mapping and multi-device handling. | S4 (touch and mouse) |
| camera-systems | Camera behavior for 3D. | S4, S5 (presets) |
| prototype-fast | Greybox a playable slice quickly and validate it. | S4 |
| performance-optimization | Frame budget, draw calls, pooling, asset budgets. | S5, S7 |
| game-feel | Tweening, easing and feedback. | S6 |
| audio-design | Buses, mixing and sound effects. | S6 |
| shader-programming | Vertex and fragment shaders, UVs, common effects. | S6, optional |
| save-systems | Serialize and restore state, versioning, autosave. | S7 (FR-19) |
| itch-publish | Publishing on itch.io. Optional way to share with friends. | S8, optional |

## 4.3 Sprint plan

| **Sprint** | **Stories** | **Skills** | **Acceptance check** |
|----|----|----|----|
| S0 | Project setup. Rules document written from sections 2.1 to 2.4. Data files drafted. Lint, test runner and build working. CLAUDE.md and decision log created. | router | Empty project builds and tests run. You approve the rules document. |
| S1 | Engine core: board, dice with doubles, movement, passing GO, buying, rent for properties, hubs and utilities. | card-game, puzzle, procedural-gen | Unit tests for FR-01, 02, 03, 05 pass. A simulation of 1,000 random games finishes with no crash. |
| S2 | Engine economy: auction, building and selling with even rule, mortgage and redeem, trade, cards, Jam, debt and bankruptcy. | card-game, puzzle | Tests for FR-04 and FR-06 to FR-11 pass. Invariants hold in every simulated game: no property with two owners, no buildings on mortgaged sets. |
| S3 | AI profiles and simulation reports. | game-ai, ai-behavior-trees-utility-ai | Report shows average game length, win rate by seat and bankruptcy order over thousands of games. You approve the economy numbers or send them back for tuning. |
| S4 | Greybox 3D interface in flat colors: board, tokens, dice, HUD, deed, auction, trade, build and card sheets, hand-off screen, language toggle. | prototype-fast, threejs-scene-setup, camera-systems, level-design, game-ui-ux, input-systems | A full Pass & Play game completes on your phone. Language toggle changes every visible string. |
| S5 | Art prototype gate. Study your style screenshots and write the style guide. Dress the Dark Blue group. Test camera presets. Measure on the target phone. | create-game-assets, threejs-materials-lighting, camera-systems, performance-optimization | You choose camera preset and confirm the style. Frame rate meets the target on the phone, or the art budget is cut until it does. |
| S6 | Full art, token and dice animation, synthesized audio, card artwork, polish. | create-game-assets, game-feel, audio-design, threejs-materials-lighting | All 40 tiles dressed. The India-avoidance review passes. |
| S7 | Hardening: save and resume, offline mode, accessibility fixes, performance fixes, Bangla review changes. | save-systems, performance-optimization | All phase 5 exit criteria met. |
| S8 | Release build and deployment to a static host. | itch-publish, optional | Live link works on the target devices. Rollback tested. |

## 4.4 Style references

Before sprint 5 you send style screenshots: games, illustrations or city scenes whose look you want, with a short note on what to take from each and what to avoid. Claude Code saves them in /docs/reference and does not guess a style before they arrive. Sprints 0 to 4 use flat greybox colors on purpose.

## 4.5 Definition of done for any story

The story has tests that pass, no new lint errors, strings in both languages, no new font or third-party file without a license note, and it is demonstrated in the browser. A story is not done because the code exists.

# Phase 5. Testing and quality assurance

| **Test type** | **What it covers** |
|----|----|
| Unit tests | Every rule in the spec with concrete cases: even-build refusal, 50 percent sell and mortgage values, redeem at principal plus 10 percent, hub rent at 1, 2, 3 and 4 hubs, utility multiples, unbuilt set rent doubling, third double to Jam. |
| Simulation tests | Thousands of AI-versus-AI games. Fails on any crash, stuck turn, or broken invariant. Also gives the balance report for the economy. |
| Traceability | Every FR in section 2.1 maps to at least one test. A missing mapping blocks gate G5. |
| End to end | Playwright runs scripted full games in the browser: buy, auction, build, trade, bankruptcy, language switch, save and resume. |
| Visual checks | Playwright screenshots of the scene at both camera presets and in both languages, compared against the style guide by eye. |
| Device matrix | Your chosen Android phone, one iPhone if a friend has one, one desktop browser. Check layout, frame rate and touch targets. |
| Bangla and content review | Someone who reads Bangla well checks every string and card for correctness, tone and fit. Check that text does not overflow on the narrowest screen. |
| Accessibility | Contrast checks, tap target sizes, color sets distinguishable without color. |
| Playtest | Two sessions with four to six friends. Log rules disputes, confusing screens and games that felt decided too early. |

Exit criteria for G5: no known crash or rules bug, all traceability rows filled, the Bangla review done, and the playtest disputes either fixed or logged as accepted.

# Phase 6. Deployment

Release 1 is a static site, which keeps cost and operations close to zero. A build pipeline runs the tests, builds the site and publishes it on each approved release. Versions use semantic numbering, and each release keeps its previous build so a rollback is a redeploy of the last good one.

Make it installable as a progressive web app with a service worker so it works offline after the first load. This matters for a phone-first game that friends may play with a weak connection.

Release checklist: all tests green, device check passed, font licenses recorded, no tracking in the build, rollback rehearsed once, and your sign-off at G6. Since the game is for friends, a trademark check is not needed now. Do one before any public release, because the classic game's name and some of its terms belong to Hasbro. I am not a lawyer.

# Phase 7. Maintenance and release 2

After release, bugs are triaged by severity: rules errors first, crashes second, display problems third. Because prices, rents and cards live in data files, balance and content patches are small and safe. New card packs, for example an Eid or Pohela Boishakh pack, can ship as data.

Release 2, if you want it, adds online play. The plan is a small Node server that runs the same engine as the authority, with WebSocket rooms, 6-character room codes, reconnect handling and the turn timer behavior from the spec. Because the server decides outcomes, clients cannot cheat. This is a separate project with its own planning cycle.

# Appendix A. Risk register

Likelihood and impact are my judgment, not measured.

| **ID** | **Risk** | **Likelihood** | **Impact** | **Mitigation** |
|----|----|----|----|----|
| R1 | Code-made 3D art looks flat or generic, or misses your taste. | High | Medium | Style screenshots first, written style guide, screenshot checks, and the sprint 5 gate with a fallback to a simpler flat-shaded style. |
| R2 | Fixed camera hides tiles or wastes space on portrait phones. | High | Medium | Camera presets tested in sprint 5. Ownership shown by flat tile-edge marks. |
| R3 | Rule gaps cause late changes. | Medium | High | Decisions in section 2.3 are locked. Claude Code must not invent rules. |
| R4 | Economy snowballs or drags with the spec's cash and price ratio. | Medium | Medium | Simulation in S3 before art and balance lock. |
| R5 | Bangla text renders badly on tile signs or overflows layouts. | Medium | Medium | Canvas text after font load, HTML for the interface, narrowest-screen test, native review. |
| R6 | Names and terms drawn from the classic game cause trouble if the game ever goes public. | Low now | High if public | Own deck names already chosen. Legal check before any public release. |
| R7 | Cards or tile names offend or stereotype. | Medium | Medium | Tone rules in 3.8 and a Bangla-reader review of every card. |
| R8 | Three.js runs poorly on low-end Android phones. | Medium | High | Real device test in S5 and S7. Merge geometry, instance parts, cap pixel ratio, no post-processing. |
| R9 | Scope creep toward online play in release 1. | Medium | High | FR-20 is Won't for release 1. |
| R10 | Newer Three.js versions break patterns the skills teach. | Low | Medium | Pin to r186 and upgrade only on purpose. |

# Appendix B. Open items

Everything else in the plan is approved. These are what Claude Code or I still need from you.

1.  Style reference screenshots with notes, before sprint 5.

2.  The mid-range Android phone you will test on, and the frame rate you consider acceptable.

3.  Who reads the Bangla for review.

4.  The final game name. Babsha is a placeholder.

5.  Confirm or change my three assumptions: jail fine of ৳500, City Tax of ৳1,000 as the second tax tile, and Bangla names for the Lucky and DOHS decks (a transliteration unless you give another).

# Appendix C. What is known, assumed and unverified

### **Known**

Your spec's turn lifecycle, auction, building, mortgage and trade rules, HUD layout, color groups and rent rules. Your approvals and changes made in chat on 8 November 2026. The skills catalog as shown in the PDF you sent.

### **Assumptions I made**

The ×10 scaling, jail fine of ৳500, City Tax of ৳1,000, 16 cards per deck, Jam and Cha Adda as corner names (you did not change them), and that Three.js r186 corresponds to a published npm version.

### **Unverified**

The art hooks for each area, accuracy of my Bangla words, how Three.js performs on low-end phones, whether the create-game-assets skill can do more than code-made art, how good each individual skill file is, current free hosting limits, and the exact npm version string for Three.js r186.

### **Recommendation and confidence**

Run sprints S0 to S3 first, so rules and economy are settled before any art effort. Confidence: high that the engine and scene split is right, medium that code-made art can reach a look you like, and low on 3D performance on low-end phones until the sprint 5 measurement exists.
