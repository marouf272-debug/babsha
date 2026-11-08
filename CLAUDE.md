# CLAUDE.md: working agreement for Babsha

Babsha (working title) is a Dhaka-themed property trading board game for the browser, phone portrait first. Personal project, shared with friends by link.

## Sources of truth

- docs/PLAN.md is the approved plan. docs/RULES.md is the rules document. Do not re-open approved decisions.
- If the code and docs/RULES.md disagree, ask the owner before changing either.
- If the plan is ambiguous or contradicts itself, stop and ask. Do not choose silently.
- docs/DECISIONS.md is the decision log. Log every builder decision there with its reason.

## Rules

- Do not invent rules. If a rule is missing, add it to docs/DECISIONS.md as an open question and wait for an answer.
- Never invent an API, function name or library option. Check the installed package in node_modules or its documentation, and say what you checked. If you cannot confirm it, say so.
- Three.js is pinned to r186 (`three@0.186.0`, exact). Check any skill example code against the installed version before using it. Upgrade only on purpose.

## Architecture

- src/engine is plain TypeScript. It never imports from src/scene, src/ui, src/audio, src/ai, src/i18n or Three.js (ESLint enforces this).
- The engine takes state and an action and returns new state plus events. Dice and shuffles use a seeded random generator.
- src/ai only calls the engine.
- Design so online play can be added later. Do not build it. Out of scope for release 1: online play, accounts, tracking, ads.
- The camera is fixed. No pan or zoom. Camera angle, elevation and zoom are config values.

## Text and language

- No visible text in code. Every visible string has a key in both data/en.json and data/bn.json. The build fails if a key is missing from either.
- Bangla on tile signs is drawn to canvas textures after the font has loaded. Interface text is HTML and CSS.
- Every new Bangla string is added to data/bn-review.json as "needs native review".
- No em dashes anywhere: code comments, documents, interface strings, card text, commit messages. Use commas, colons or full stops.

## Art

- All art is made in code: procedural low-poly geometry, canvas textures, synthesized Web Audio. No external image generation service or paid API without asking first.
- Sprints S0 to S4 use flat greybox colors only. Do not invent a visual style.
- Before S5 the owner sends style screenshots, saved in docs/reference. S5 writes docs/style-guide.md and checks each model against it with Playwright screenshots.
- Be honest about limits: code-made art gives a stylized low-poly or flat-shaded look, not hand-painted illustration.
- Keep the India look out: Bangla script on all signage, palette from Bangladesh and rickshaw art, no domes or minarets as filler, one Dhaka-specific anchor per tile.

## Process

- One sprint at a time (plan 4.3). At the end of a sprint: run all tests, list each acceptance check with pass or fail, list open questions, and stop for owner approval.
- Write tests before rules code in the engine. Every requirement ID in plan 2.1 needs at least one test that names it.
- Commit after each finished story. Name the requirement ID in the commit message.
- Record the license of every font and any third-party file added.
- Before relying on a skill, read its instructions. If a skill conflicts with the plan, follow the plan and tell the owner.
- Definition of done (plan 4.5): tests pass, no new lint errors, strings in both languages, license notes for new files, and demonstrated in the browser.
- Reports are short and plain: what was done, what passed, what failed, what is needed from the owner.

## Commands

- `npm run dev`: dev server on http://127.0.0.1:5180
- `npm run build`: type check, i18n parity check, production build
- `npm test`: Vitest unit and data tests
- `npm run test:e2e`: Playwright against the production preview
- `npm run lint`: ESLint
- `npm run sim`: headless simulation, report written to sim/reports
- `npm run balance`: balance report over thousands of computer games (about 3 minutes), written to sim/reports/balance.md
- `npm run phone`: production build served on the local network (port 5181) to open on a phone on the same Wi-Fi
- Test mode: open the game with `?test=1` for instant animations and no computer delay (used by Playwright)
