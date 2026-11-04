# Ballpark — the unlimited estimation game

> “Wait, I actually have no idea… let me take a guess.”

Ballpark serves Fermi-style questions (*How many tennis balls fit in a 747?*). Each question gets **one guess**, and the answer, how far off you were (log scale), the reasoning and a surprising fact appear instantly. There's no daily cap on how many you play.

## Quick start

Requirements: Node 20+, Docker.

```bash
npm install
cp server/.env.example server/.env    # then set SESSION_SECRET
npm run db:setup                      # start Postgres (port 5434), migrate, seed ~1,580 questions
npm run dev                           # API on :3001, web on http://localhost:5180
```

Other scripts:

| Script | What it does |
| --- | --- |
| `npm test` | Engine unit tests (`shared`) + API integration tests (`server`, uses the `ballpark_test` DB) |
| `npm run typecheck` | Type-checks all three workspaces |
| `npm run build` / `npm start` | Production build; Express serves the built client from the same origin |
| `npm run db:generate` | Generate a new Drizzle migration after editing `server/src/db/schema.ts` |
| `npm run db:seed` | Re-run the idempotent question seed (upserts by slug) |
| `npm run questions:build` | Rebuild the generated packs from World Bank + Wikidata (needs network, ~2 min) |

## Layout

```
shared/   Pure TypeScript used by both sides
  engine/parse.ts      "2.5 million", "1e6", "5 lakh", "2 crore" → number
  engine/estimate.ts   log error, direction, tiers, accuracy, ranges, solve check
  engine/scoring.ts    points, XP, levels
  achievements.ts      badge definitions + evaluation
server/   Express + Drizzle + Passport (sessions in Postgres)
  db/schema.ts         tables; drizzle/ holds migrations
  db/seed/questions/   one file per category — add questions here
  services/            attempts, daily, endless, stats, achievements, users
  routes/              thin zod-validated HTTP layer
client/   React + Vite + Tailwind v4 + shadcn-style UI + Framer Motion
  components/game/     GameView (card → verdict), GuessInput, Stamp, LogRuler, ResultPanel, share
  pages/               Home, Play, Daily, Endless, Profile, Leaderboard
```

## Game rules

- **Error** = `|log10(guess / answer)|`. If a question has an accepted range, guesses inside it count as exact and the error is measured to the nearest bound.
- **Tiers**: within 5% Exceptional · 10% Almost perfect · 25% Very close · 50% Good · 2× Not bad · 10× Getting there · beyond Keep thinking.
- **One guess per question.** It's a **hit** when within the question’s tolerance (defaults: easy 25%, medium 50%, hard/insane 2×); otherwise a **miss**, and the answer is shown immediately.
- **Points** = (600 × closeness + 300 × closeness² + 100 if it's a hit) × difficulty multiplier, where closeness(e) = max(0, 1 − e). A near miss still scores; anything 10× or more off scores 0. Skips score nothing.
- **Endless:** a hit grows the streak and a miss resets it to 0. The next card arrives automatically, and the run lasts until you end it.
- The answer never leaves the server until an attempt is finished.

## Adding questions

There are two sources:

- **Hand-written:** `server/src/db/seed/questions/<category>.ts`.
- **Generated packs:** `server/src/db/seed/generated/*.json`, built by `server/scripts/build-questions.ts`. The packs are:
  - World Bank population, land area, GDP, mobile subscriptions and urban population for every country.
  - Wikidata city populations (India's largest cities use Census 2011 counts) and river lengths, with sanity filters.
  - Computed "how many X fit in Y" and body-rate templates.

Random play picks a deck first, then a pack, then a question, so no single template dominates.

Edit either source and run `npm run db:seed`. The seed validator checks slugs, ranges, tolerances, reasoning and sources. Integrity rules:

- `kind: 'fact'`: a documented figure with a real source.
- `kind: 'estimate'`: a Fermi estimate. Every assumption goes in `reasoning`, and a `low`/`high` range is given. The UI labels these as estimates.

## Accounts

Visitors play immediately as **guests** (a server session). Signing up upgrades the guest in place. Logging in to an existing account merges the guest’s attempts, XP, streaks and badges into it. Leaderboards list registered players only.

## Deploying

Live: https://ballpark-game.onrender.com (Render free plan, so the first visit after idle takes about a minute).

`render.yaml` defines a Docker web service plus a Postgres database. Every push to `main` rebuilds and redeploys. On boot the container applies migrations and re-runs the idempotent question seed, so schema changes and new questions need no manual step. Keep `SESSION_SECRET` unchanged between deploys, or guests lose their progress.

## Built for later

`question_packs` / `author_id` (community packs and user submissions), a mode → selector strategy in `questionService`, and the engine living in `shared/` are there so multiplayer rooms, tournaments and AI-generated questions can be added without reshaping the core.
