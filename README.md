# Ballpark — the unlimited estimation game

### ▶ Play now: **https://ballpark-game.onrender.com**


> “Wait, I actually have no idea… let me take a guess.”

Ballpark serves Fermi-style questions (*How many tennis balls fit in a 747?*). Each question gets **one guess**, and the answer, how far off you were (log scale), the reasoning and a surprising fact appear instantly. There's no daily cap on how many you play.

## Quick start

Requirements: Node 20+, Docker.

```bash
npm install
cp server/.env.example server/.env    # then set SESSION_SECRET
npm run db:setup                      # start Postgres (port 5434), migrate, seed ~250 questions
npm run dev                           # API on :3001, web on http://localhost:5180
```



| Script | What it does |
| --- | --- |
| `npm test` | Engine unit tests (`shared`) + API integration tests (`server`, uses the `ballpark_test` DB) |
| `npm run typecheck` | Type-checks all three workspaces |
| `npm run build` / `npm start` | Production build; Express serves the built client from the same origin |
| `npm run db:generate` | Generate a new Drizzle migration after editing `server/src/db/schema.ts` |
| `npm run db:seed` | Re-run the idempotent question seed (upserts by slug) |
| `npm run questions:build` | Rebuild the computed "how many fit" pack (no network needed) |








`render.yaml` defines a Docker web service plus a Postgres database. Every push to `main` rebuilds and redeploys. On boot the container applies migrations and re-runs the idempotent question seed, so schema changes and new questions need no manual step. Keep `SESSION_SECRET` unchanged between deploys, or guests lose their progress.


