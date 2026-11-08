# Bangla review: instructions for the reviewer

Thank you for checking the Bangla. The sheet `docs/bangla-review.csv` lists every string in the game that still needs a native reader: tile names, card text, buttons, messages and the game log. Open it in Google Sheets, Excel or Numbers.

## Columns

| Column | What it is |
|---|---|
| key | Where the string is used. The first word gives the area: `tile` tile names, `card` card text, `ev` game log lines, `action` buttons, `deed` the property card, `trade`, `auction`, `debt`, `setup`, `info`, `save` and so on. Do not change it. |
| english | The English text, for meaning. |
| bangla | The Bangla text as it is now. |
| ok | Write `yes` if the Bangla is right as it is. |
| correction | If it needs a change, write the full corrected Bangla here. Leave `ok` empty. |
| note | Anything else: tone, a better word, a question. |

Leave both `ok` and `correction` empty for any row you have not checked yet. Those rows stay on the list for next time.

## Rules for corrections

- Keep every placeholder in curly brackets exactly as it is, for example `{name}`, `{amount}` or `{tile}`. The game puts the player name, a Taka amount or a tile name there.
- Do not use the long dash (em dash). Use a comma, a colon or a full stop.
- Tone: friendly and everyday, the way friends talk over a board game. Card text should be light and never mock a group of people (plan 3.8).
- Building signs on the board are always in Bangla, even in English mode, so tile names matter most.

## One question for you (Q-30)

Several strings attach an ending to a player name with a hyphen, for example `{name}-এর পালা` ("{name}'s turn") and `ফোনটি {name}-কে দিন` ("Pass the phone to {name}"). The player names are রিকশা, সিএনজি অটো, ইলিশ, ঘুড়ি, চায়ের কাপ and বাস. After a name that ends in a vowel, `রিকশা-এর` reads awkwardly where `রিকশার` is natural. Please choose one, and write it in the note column of `hud.turn`:

1. Accept the hyphen form as it is.
2. Reword these strings so no ending is attached to the name, for example `পালা: {name}`.
3. Store the right forms for each of the six names (more work, most natural).

## Sending it back

Send the filled-in sheet back. The builder runs `npm run review:import -- <your file>`. Approved rows leave the list, corrections go into the game, and a correction that drops a placeholder or uses an em dash is refused with the row named, so nothing breaks.
