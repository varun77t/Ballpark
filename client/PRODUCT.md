# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Casual daily players who want a short brain-teaser habit, the way people play a daily word game: a couple of minutes, on phone or laptop, often with friends. Sharing a result matters. They are not studying; the reasoning steps are a reward for curiosity, not homework.

## Product Purpose
Ballpark poses Fermi questions ("How many tennis balls fit in a 747?"). Each question gets exactly one guess; the answer, how far off you were (log scale, too high or too low), the reasoning and a surprising fact appear instantly. Questions are unlimited: there is no daily cap, so the next card is always one tap away. Success is the "wait, what?" moment, then "one more".

## Positioning
One shot per question, unlimited questions: no three-a-day ceiling. Scoring is by closeness on a log scale, so a near miss still scores. Every answer is either a documented figure with sources or a labelled Fermi estimate with its assumptions and accepted range.

## Operating Context
A daily question everyone shares, a random or category deck, an endless streak run, personal stats and badges, and leaderboards for registered players. Visitors play immediately as guests; signing up keeps progress.

## Capabilities and Constraints
- The frontend redesign must not change game logic, hooks, API calls, backend or endpoints (`client/src/api/*` is the contract).
- 127 questions across 11 categories, each with its own category color (from the API), and 4 difficulties.
- One guess per question (user decision); a hit is within the question's tolerance, a miss reveals the answer immediately.
- Guess input accepts words and scales ("2.5 million", "5 lakh", "2 crore").
- Light paper theme only (user decision); no dark mode.

## Brand Commitments
- Name: Ballpark. Its own mark (concentric rings), not another product's branding.
- User-pinned feel: minimal and card-centric, like a daily game. One big saturated rounded card per screen on a quiet paper ground, heavy grotesk type, letter-spaced pill buttons, floating round corner buttons for navigation.
- Card color follows the question's category.

## Evidence on Hand
Question content with real sources lives in `server/src/db/seed/questions/`. There are no testimonials, user counts or press; never invent them.

## Product Principles
- The question is the hero; nothing competes with it on screen.
- Feedback is instant, honest and directional; never shame a bad guess.
- One tap to play, from any screen.
- Results are worth sharing.
