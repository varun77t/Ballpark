# Ballpark design system

One card, one guess, one verdict. A quiet paper ground; each question is a full-strength colored card; the card itself becomes the answer.

## Color
| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#ece8df` | Page ground (light only, no dark mode) |
| `--paper-deep` | `#e2ddd1` | Segmented controls, inactive pills, skeletons |
| `--paper-line` | `#d3cdbf` | Rules between list rows |
| `--ink` | `#1b1a17` | Text, primary pill on paper, menu button |
| `--ink-soft` / `--ink-faint` | `#57534a` / `#8a8579` | Secondary and tertiary text |
| Brand card | `#17694a` | Home, Record, empty states |

Card colors live in `src/lib/deck.ts`, one per deck, each with its readable text color:

- **White text:** science `#2f5fd8`, geography `#0b7a85`, food `#cc3c18`, everyday `#c92766`, animals `#2f7424`, space `#6526d1`, history `#97461f`, business `#87193d`, weird `#1b1a17`.
- **Ink text:** sports `#f0b606`, india `#ff8a1f`.

Inside a card, everything reads `--card`, `--on-card` and `--card-field` (a translucent fill for fields and quiet pills).

## Type
- **Family:** Archivo Variable (weight 100–900, width 62–125%), self-hosted via `@fontsource-variable/archivo/wdth.css`.
- **`.display`:** weight 850, width 96%, tracking −0.03em, leading 1.02. Used for questions, answers, headings and figures.
- **`.label-caps`:** weight 700, width 112%, tracking 0.16em, uppercase. Used for pills, card headers and captions.
- **Body:** 15–17px, weight 500–600.
- **Numbers:** tabular figures (`.tabular`).

## Shape and depth
- Cards: 2rem radius, a single soft offset shadow (`--shadow-card`), and nothing nested inside them.
- Pills are fully round.
- Navigation is round floating buttons in the top corners.

## Components
- **Buttons** (`ui/button.tsx`):
  - On a card: `card` is a white pill with the card color as text, `cardOutline`, `cardGhost`.
  - On paper: `ink`, `outline`, `ghost`.
- **Game card** (`game/GameView.tsx`): at most 640px wide. The header strip, streak line, skip link and explanation all share the card's content edge.
- **Verdict:**
  - A stamp (HIT / MISS / SKIPPED, plus a tier word) presses onto the card once.
  - The answer counts up in log space.
  - A log ruler shows decade ticks, the hit zone, the answer and your guess.
- **Decks:** pills filled with their own card color.
- **Stats:** figures set in display type, not tiles.

## Motion
- Exponential ease-out `[0.16, 1, 0.3, 1]`.
- The one authored moment is the stamp: a spring press. The ruler's guess marker travels out from the answer.
- `prefers-reduced-motion` disables all of it.

## Flow rules
- One guess per question; the verdict replaces the question on the same card.
- Next is the primary, autofocused action (Enter). Once the player scrolls past it, a floating Next pill appears in the card's color.
- In Endless, the next card arrives after 2.5 s unless the player scrolls, clicks or types. It never counts while the tab is hidden.
