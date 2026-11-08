# Babsha style guide

Status: confirmed by the owner at the S5 gate (D-78). Camera: tabletop (D-76). Set bands per owner feedback (D-77). Sources: plan 3.6 to 3.10, the owner's references in docs/reference (D-71), and the owner's choice of the tilted 3D city (D-70). All art is made in code (CLAUDE.md): low-poly geometry, canvas textures, no image files, no image generation.

## 1. What the look is

A warm, bold, tilted 3D Dhaka board. Low-poly flat-shaded buildings sit on cream tiles around a deep green board. Color comes from rickshaw art: hot pink, red, yellow, teal and deep blue against Bangladesh green. Every sign is in Bangla. The interface is chunky and readable: bold rounded buttons, dialogs with a colored header band, big numbers.

What code-made art can and cannot do: it gives clean faceted shapes, flat color, simple painted patterns on canvas, and crisp Bangla text. It does not give hand-painted illustration, soft painterly light or detailed textures. Where the references show glossy painted icons, we use simple flat shapes instead.

## 2. Palette tokens

Stored in data/scene.json (`colors`) and mirrored as CSS variables in src/ui/styles.css. Code uses the token, never a raw value.

| Token | Value | Use |
|---|---|---|
| ink | #1E1B18 | All text on light surfaces |
| paper | #FBF4E4 | Tile faces, dialog bodies |
| paperEdge | #E6D9BC | Tile borders, dividers |
| boardGreen | #0E6B47 | Board base, the main field (Bangladesh green family) |
| boardGreenDark | #094C33 | Board edge, primary button |
| road | #3B3F45 | Roads around landmarks |
| roadLine | #F3E2A9 | Road markings |
| water | #3E9CC4 | Lakes and rivers |
| waterLight | #8FD0E6 | Water highlights |
| leaf | #3E9B48 | Trees, grass |
| leafDark | #2A7335 | Tree shade side |
| concrete | #DCD3C3 | Building walls |
| concreteShade | #B9AE9A | Plinths, building bases |
| glass | #7FB8D3 | Glass towers, windows |
| tinRoof | #9AA6AE | Tin roofs |
| terracotta | #C35F3A | Brick and old buildings |
| rickRed | #E0262F | Accent: rickshaw art red |
| rickPink | #EC3E8C | Accent: rickshaw art pink |
| rickYellow | #F7C631 | Accent: rickshaw art yellow |
| rickTeal | #12A5B5 | Accent: rickshaw art teal |
| rickBlue | #2443A0 | Accent: rickshaw art deep blue |

Color set colors (functional, tuned to the palette, each also has a symbol so color is never the only cue, plan 2.2):

| Set | Value | Symbol |
|---|---|---|
| Brown | #8A5232 | ● |
| Light blue | #67BFE6 | ▲ |
| Pink | #EC3E8C | ■ |
| Orange | #EE7D2B | ◆ |
| Red | #E0262F | ★ |
| Yellow | #F7C631 | ✚ |
| Green | #2E9E4F | ♥ |
| Dark blue | #2443A0 | ⬟ |

Player colors (plan 2.4: red, blue, green, yellow, purple, cyan): #E0262F, #2E6FE0, #2E9E4F, #F2B91F, #8A3FD1, #12A5B5.

Avoid: saffron-heavy schemes and orange-white-green tricolor groupings (plan 3.7). Orange appears only as the Orange set color.

## 3. Interface (from the references, D-71)

- **Buttons**: rounded 12 px corners, solid fill, a 3 px darker bottom edge for a chunky pressed-in look, bold label. White text only on fills dark enough for 4.5:1 contrast; yellow fills use ink text.
  - Primary (Roll, End turn, Buy): boardGreenDark.
  - Action bar: Build #1F7A3A, Sell #0E7C88, Mortgage #2443A0, Redeem #6A3FB0, Trade #C81E27.
  - Danger (bankruptcy): #C81E27 outline.
- **Dialogs and sheets**: paper body, a colored header band with white bold title: deed uses its set color, auction rickYellow (ink title), trade #0E7C88, debt #C81E27, Lucky card #C42A72, DOHS card #0E7C88.
- **Player cards**: a grid of cards (2 per row) with a color swatch for the token, name, and cash in large bold digits. The last roll shows as two small dice in the middle of the grid. Active player: thick ink border.
- **Text**: Noto Sans Bengali for Bangla, system sans for English (plan 2.4). Cash and prices bold. Minimum 14 px for body text, 16 px for buttons.
- **Tap targets**: at least 44 by 44 px (plan 2.2).

## 4. Board and proportions

World units: one side tile is 1 wide and 1.6 deep, corners 1.6 square, board 12.2 square.

- **Tile face**: paper with a 2 px paperEdge border drawn in the texture. Name and price in ink, upright for the fixed camera (D-67), kept clear of the owner band on the outer edge.
- **Set color band**: on the edge facing the board centre, with the set symbol (D-77): top edge on the bottom row, bottom edge on the top row, right edge on the left column, left edge on the right column. 0.3 units deep.
- **Tile layout when dressed**: the outer 45 percent of the tile depth carries the name and price; the landmark fills the middle; the color band at the inner edge holds houses and hotels. Text never sits under a building or a house.
- **Buildings**: footprint at most 0.85 by 0.85 units, height at most 1.3 units, so a building hides at most part of the tile behind it (plan risk R2). Ownership is a flat band on the outer edge, readable even when a building overlaps.
- **Houses and hotels**: white houses with a red roof, 0.15 wide; a terracotta hotel block. They stand on the set color band, on every property tile.
- **Tokens**: about 0.4 units tall, footprint up to 0.45.
- **Board base**: boardGreen with a boardGreenDark rim.

## 5. Shape language and edge treatment

- Low-poly, flat-shaded faces (`flatShading`), boxes and simple prisms. No smooth curves except water discs.
- No outlines. Shapes separate by value: lit faces light, side faces mid, plinths dark.
- Every building stands on a concreteShade plinth slightly wider than the building.
- Windows are a shared canvas texture of darker rectangles, not separate meshes.
- Signs: Bangla text on a plain board on the building face that looks most toward the camera, drawn to a canvas texture after the font loads. Building signs are always Bangla, whatever the interface language; tile labels follow the language toggle (FR-15).
- Detail density: one landmark idea per tile, at most about 6 parts. Readability beats detail.

## 6. Lighting

- One HemisphereLight (sky #FFF4E0, ground #6B5B45) for warm fill, one DirectionalLight (#FFE7C2) from the upper front-left so the faces toward the camera are lit.
- No real-time shadows (plan 3.1 performance practice). Soft dark blob shapes under buildings and tokens stand in for contact shadows.
- No post-processing, no tone mapping. Color textures are tagged sRGB.

## 7. Dhaka anchors (plan 3.7)

Every tile gets one Dhaka-specific anchor: a rickshaw with rickshaw-art colors, kites, an ilish, a nouka or launch on water, the Metro Rail, or a named landmark. No domes or minarets as filler. Bangla script on every sign.

Review test for each tile: with the name covered, would a Bangladeshi viewer still say Dhaka? If not, redo it.

All 40 tiles are dressed (S6). The anchor list is in code: src/scene/models/dressing.ts.

### S5 hero group: Dark Blue

| Tile | Anchor | Parts |
|---|---|---|
| Gulshan | Gulshan Lake and a modern glass office tower | Glass tower with a Bangla sign, lake strip with a small nouka, two trees |
| Baridhara | Baridhara lakeside, quiet and green | Low white residential block with a tin-roof top, lakeside strip, a parked rickshaw with a pink and yellow hood, trees |

## 8. Camera

**Chosen: tabletop (D-76).** Three presets were compared in S5 (plan 3.6; the middle one was added so the owner could see the trade-off): tabletop (58 degrees), tilted45 (45 degrees) and the isometric diamond. Values live in data/scene.json; open any page with `?camera=tabletop`, `?camera=tilted45` or `?camera=isometric`. No pan or zoom.

What the S5 screenshots show (docs/screenshots/s5-*.png, iPhone 13 Pro size):

- **Isometric**: buildings read clearly as a 3D city, but the board is a small diamond in the middle of a portrait screen and tile text is too small to read.
- **Tabletop and tilted45**: the board fills the screen width and text is readable; buildings show mostly roofs, with a little more of their sides at 45 degrees.

## 9. Performance budget

Target: 40 frames per second on the iPhone 13 Pro (D-69), plus one mid-range Android check. Measure with `?bench=1` (every token hopping, dice rolling, readout of frames per second, draw calls and triangles) or `?fps=1` during a real game.

Budgets: pixel ratio at most 1.5, under 200 draw calls, under 60,000 triangles for the full board.

S6 measurement with all 40 tiles dressed: 17 draw calls and about 10,700 triangles (static scenery merged, labels and signs in atlases, houses and owner bands instanced). S5, Dark Blue only, had 185 draw calls. Headless desktop Chrome (software rendering) held 60 fps, and 49 to 58 fps with the CPU slowed 4 times; the owner measured 40 or more on the iPhone 13 Pro (D-78). Triangles are far under budget; draw calls are the constraint. Before S6 dresses all tiles: draw the 40 tile signs into one shared texture (about 40 fewer calls) and merge each tile's static landmark parts into one mesh per material.

## 10. Small anchors at phone scale

On a 390-point-wide phone a side tile is about 31 points wide. A rickshaw or nouka at true scale is a few points, so anchors are drawn about 1.4 times larger than the buildings around them would suggest, and each tile shows one big, simple anchor rather than many small ones.

## 11. Tokens, motion and sound (S6)

- **Tokens**: rickshaw, CNG auto, ilish, kite, tea cup and bus (plan 2.4), each a merged low-poly model standing on a disc in the player's color, so color stays the first cue.
- **Motion**: tokens hop tile by tile, stretching in the air and squashing on landing; dice tumble and bounce lower each time; new owner bands, houses and hotels pop in with a small overshoot. All motion returns to rest. When the phone asks for reduced motion, hops become short slides and nothing squashes or pops.
- **Sound**: synthesized in code (plan 3.1): dice rattle, hop ticks, a cash chime for buying, coins for rent and salary, a paper swish for cards, an auction bell, a two-tone jam horn, a knock for building, falling notes for bankruptcy and a short fanfare for the win. All sound goes through one bus and a limiter. A sound toggle sits in the top strip and is remembered per device.
- **Cards**: a rickshaw-art border of flowers and dots in the deck color, with a lucide icon for the card's effect.
- **Tap to build**: Build, Sell, Mortgage and Redeem highlight the tiles they can use with a pulsing yellow overlay; tapping a tile acts there. The list stays as a fallback.
