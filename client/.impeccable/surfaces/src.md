---
version: 1
slug: "src"
primary_target: "src"
related_targets: []
---

# Surface brief: Ballpark client (all routes)

Scope: whole client redesign (home, play, daily, endless, profile, leaderboard, menu, auth). Mode: operate (a short daily game loop).
Audience/job: casual daily players; read one question, make one guess, see the truth, tap next.
Constraints: frontend only plus the user-requested one-shot rule; light paper only; floating corner buttons; card color per category.

## Direction contract

THESIS: One card, one guess, one verdict. The question is the only thing on screen; the card itself turns into the answer. Refuses the dashboard-of-tiles game page and the dark neon glow.

OWN-WORLD: Quiet warm-grey paper ground (#ECE8DF), ink #1B1A17. Each card is a full-strength category color (cobalt, teal, tomato, yolk, raspberry, leaf, violet, sienna, wine, saffron, ink) with 32px radius and one soft offset shadow. Archivo variable throughout: 800–900 weight for questions and answers, expanded width for letter-spaced uppercase pill buttons. White pills on color, outline pills secondary. Round floating buttons in the corners. No tiles, gradients, glows or mono costume.

STORY: Visitor sees a giant question in color, types a number, presses Guess. The same card flips to the verdict: a stamped HIT or MISS, the answer, how far off on a log ruler, then Next. Below the card: the "wait, what?" fact and the reasoning.

FIRST VIEWPORT: Home: centered brand card (max 860px) with mark, a two-line heavy headline, today's daily teaser and a white PLAY pill. Deck chips on paper below. Play: the category card fills the width, question at about 3.5rem left-aligned, guess field and pill inside the card.

FORM: pinned user direction (minimal card game); raise from challenger 4, the jet-age ticket wallet: state stamps itself onto the card (HIT/MISS stamp, rotated, pressed once). Seed key 7dffe15a.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
