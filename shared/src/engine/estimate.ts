import type { Difficulty } from '../types';

/** The parts of a question the engine needs. The answer stays server-side until the attempt ends. */
export interface AnswerSpec {
  answer: number;
  /** Optional acceptable range: guesses inside [low, high] count as exact. */
  answerLow?: number | null;
  answerHigh?: number | null;
  /** Ratio within which the question counts as solved (e.g. 1.25 → within 25% either way). */
  toleranceRatio: number;
}

export type Direction = 'high' | 'low' | 'exact';

export type TierKey = 'exceptional' | 'almost' | 'very_close' | 'good' | 'not_bad' | 'getting_there' | 'keep_thinking';

export interface Tier {
  key: TierKey;
  label: string;
  /** Upper bound on guess/answer ratio (symmetrical in log space). */
  maxRatio: number;
  /** 0 (cold) → 6 (hot); used to colour the meter. */
  heat: number;
}

export const TIERS: Tier[] = [
  { key: 'exceptional', label: 'Exceptional!', maxRatio: 1.05, heat: 6 },
  { key: 'almost', label: 'Almost perfect!', maxRatio: 1.1, heat: 5 },
  { key: 'very_close', label: 'Very close!', maxRatio: 1.25, heat: 4 },
  { key: 'good', label: 'Good estimate!', maxRatio: 1.5, heat: 3 },
  { key: 'not_bad', label: 'Not bad!', maxRatio: 2, heat: 2 },
  { key: 'getting_there', label: 'Getting there!', maxRatio: 10, heat: 1 },
  { key: 'keep_thinking', label: 'Keep thinking!', maxRatio: Infinity, heat: 0 },
];

export const DEFAULT_TOLERANCE: Record<Difficulty, number> = {
  easy: 1.25,
  medium: 1.5,
  hard: 2,
  insane: 2,
};

// Floating-point slack so a guess of exactly 1.25× counts as "within 25%".
const EPS = 1e-9;

/** The value a guess is measured against: the answer, or the nearest range bound. */
export function referenceFor(guess: number, spec: AnswerSpec): number {
  const low = spec.answerLow ?? null;
  const high = spec.answerHigh ?? null;
  if (low !== null && high !== null && low <= high) {
    if (guess < low) return low;
    if (guess > high) return high;
    return guess;
  }
  return spec.answer;
}

/** |log10(guess / reference)|: 0 is perfect, 1 is 10× off, 2 is 100× off. */
export function logError(guess: number, spec: AnswerSpec): number {
  if (!(guess > 0)) throw new RangeError('guess must be a positive number');
  const ref = referenceFor(guess, spec);
  return Math.abs(Math.log10(guess / ref));
}

export function directionOf(guess: number, spec: AnswerSpec): Direction {
  const ref = referenceFor(guess, spec);
  if (Math.abs(Math.log10(guess / ref)) < EPS) return 'exact';
  return guess > ref ? 'high' : 'low';
}

export function tierFor(err: number): Tier {
  for (const tier of TIERS) {
    if (err <= Math.log10(tier.maxRatio) + EPS) return tier;
  }
  return TIERS[TIERS.length - 1];
}

/** 100% at exact, 50% at 10× off, 0% at 100× off or worse. */
export function accuracyPct(err: number): number {
  return Math.max(0, Math.min(100, 100 * (1 - err / 2)));
}

/** Percentage off, e.g. 0.3 → "within 30%". Uses ratio so it is symmetric for high and low guesses. */
export function percentOff(err: number): number {
  return (Math.pow(10, err) - 1) * 100;
}

export function isSolved(err: number, spec: Pick<AnswerSpec, 'toleranceRatio'>): boolean {
  return err <= Math.log10(spec.toleranceRatio) + EPS;
}

/** 0..1 closeness used by the meter: 1 at exact, 0 at 1000× off. */
export function meterValue(err: number): number {
  return Math.max(0, 1 - err / 3);
}

const HIGH_HINTS: Record<TierKey, string> = {
  exceptional: 'A hair high — basically spot on.',
  almost: 'Just slightly high.',
  very_close: 'A little high. Nudge it down.',
  good: 'Too high, but you are in the ballpark.',
  not_bad: 'Too high — try bringing it down.',
  getting_there: 'Too high. Think smaller.',
  keep_thinking: 'Way too high. Orders of magnitude off.',
};

const LOW_HINTS: Record<TierKey, string> = {
  exceptional: 'A hair low — basically spot on.',
  almost: 'Just slightly low.',
  very_close: 'A little low. Nudge it up.',
  good: 'Too low, but you are in the ballpark.',
  not_bad: 'Too low — try going higher.',
  getting_there: 'Too low. Think bigger.',
  keep_thinking: 'Way too low. Orders of magnitude off.',
};

export function hintFor(direction: Direction, tier: Tier): string {
  if (direction === 'exact') return 'Dead on. Incredible.';
  return direction === 'high' ? HIGH_HINTS[tier.key] : LOW_HINTS[tier.key];
}

export interface Evaluation {
  logError: number;
  direction: Direction;
  tier: Tier;
  accuracy: number;
  solved: boolean;
  hint: string;
}

export function evaluateGuess(guess: number, spec: AnswerSpec): Evaluation {
  const err = logError(guess, spec);
  const direction = directionOf(guess, spec);
  const tier = tierFor(err);
  return {
    logError: err,
    direction,
    tier,
    accuracy: accuracyPct(err),
    solved: isSolved(err, spec),
    hint: hintFor(direction, tier),
  };
}
