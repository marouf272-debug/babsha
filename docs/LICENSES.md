# Third-party files and licenses

Every font, image, sound or other third-party file shipped with the game is listed here (plan 4.1, 4.5).

| What | Source | Version | License | Where it is used |
|---|---|---|---|---|
| Noto Sans Bengali (weights 400 and 700) | npm `@fontsource/noto-sans-bengali`, font by The Noto Project Authors | 5.3.0 | SIL Open Font License 1.1 (see node_modules/@fontsource/noto-sans-bengali/LICENSE) | Bangla interface text and tile signs. Served with the game, no request to Google. |
| Rozha One (weight 400) | npm `@fontsource/rozha-one`, font by Indian Type Foundry | 5.3.0 | SIL Open Font License 1.1 (see node_modules/@fontsource/rozha-one/LICENSE) | Titles and pop-up bands in the Night Map look (D-111), matching the website. Latin letters only; Bangla falls back to Noto Sans Bengali. |
| Figtree (weights 500, 700, 800) | npm `@fontsource/figtree`, font by Erik Kennedy | 5.3.0 | SIL Open Font License 1.1 (see node_modules/@fontsource/figtree/LICENSE) | English interface text in the Night Map look (D-111). |
| Gaegu (weight 700) | npm `@fontsource/gaegu`, font by JIKJI SOFT | 5.3.0 | SIL Open Font License 1.1 (see node_modules/@fontsource/gaegu/LICENSE) | Hand-lettered labels (player names, section titles) in the Night Map look (D-111). |

| Lucide icons (Volume2, VolumeX, HandCoins, Wallet, Users, Gift, MapPin, Undo2, TrafficCone, KeyRound, Hammer, Coins) | npm `lucide` | 1.70.0 | ISC (see node_modules/lucide/LICENSE) | Sound toggle and card artwork icons, built into the bundle |

Code libraries (Three.js MIT, build and test tools) are listed in package.json and are not shipped as separate files.

The home screen icons in assets/icons are drawn in code by scripts/make-icons.ts (D-102). They show one Bangla letter rendered with Noto Sans Bengali, which the SIL Open Font License 1.1 allows in images.
