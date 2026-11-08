# Asset manifest

Every visual and sound asset in plan 3.10, its status and where it comes from. All assets are made in code; no image, model or sound files are shipped. docs/LICENSES.md lists the third-party pieces: the Bangla font and the lucide icons.

| Asset (plan 3.10) | Status | Made by |
|---|---|---|
| Base tile, side and corner | Styled (S5) | src/scene/board.ts, canvas tile texture |
| Corner scenes: GO, Jam, Cha Adda, Go to Jam | Clean tiles by owner choice (D-84) | |
| Property building kits | 22 landmarks, one Dhaka anchor each, shown once built (D-84) | src/scene/models/kit.ts, dressing.ts |
| House and hotel | Styled, instanced (S6) | src/scene/board.ts |
| Transport hubs and utilities | Clean tiles by owner choice (D-84) | |
| Card and tax tiles | Clean tiles by owner choice (D-84) | |
| Tokens: rickshaw, CNG, ilish, kite, tea cup, bus | Modeled (S6) on player-colored discs | src/scene/models/tokens.ts |
| Dice | Styled, one texture (S6) | src/scene/board.ts |
| Avatars and UI icons | Color swatches as avatars; lucide icons (ISC) for sound and cards | src/ui/icons.ts |
| Audio | Synthesized (S6): dice, hop, buy, rent, coin, card, bell, horn, build, fall, fanfare | src/audio/sfx.ts |
| Interface (buttons, sheets, player cards) | Styled (S5) | src/ui/styles.css |
| Card artwork | Rickshaw-art border with an effect icon (S6) | src/ui/cardArt.ts |
