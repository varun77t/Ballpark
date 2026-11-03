import type { Difficulty } from '../types';

export const DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = {
  easy: 1,
  medium: 1.25,
  hard: 1.5,
  insane: 2,
};

export type FinishStatus = 'solved' | 'revealed' | 'skipped';

export interface ScoreInput {
  status: FinishStatus;
  difficulty: Difficulty;
  guessCount: number;
  /** Log error of the first guess (null when no guesses were made). */
  firstError: number | null;
  /** Best (lowest) log error across all guesses. */
  bestError: number | null;
}

export interface ScoreBreakdown {
  base: number;
  firstGuessBonus: number;
  improvementBonus: number;
  multiplier: number;
  total: number;
}

/** 1 at exact, 0 at 10× off or worse. */
export function closeness(err: number): number {
  return Math.max(0, 1 - err);
}

/** Base points decay gently with each extra guess but never below 40%. */
export function efficiencyFactor(guessCount: number): number {
  return Math.max(0.4, 1 - 0.05 * Math.max(0, guessCount - 1));
}

const ZERO: ScoreBreakdown = { base: 0, firstGuessBonus: 0, improvementBonus: 0, multiplier: 1, total: 0 };

export function scoreAttempt(input: ScoreInput): ScoreBreakdown {
  const { status, difficulty, guessCount, firstError, bestError } = input;
  const multiplier = DIFFICULTY_MULTIPLIER[difficulty];
  if (status === 'skipped' || guessCount === 0 || firstError === null || bestError === null) {
    return { ...ZERO, multiplier };
  }

  const fullBase = 600 * closeness(bestError) * efficiencyFactor(guessCount);

  // A guess that missed the tolerance still scores on closeness; only a hit earns the hit bonus.
  if (status === 'revealed') {
    const base = Math.round(fullBase);
    const firstGuessBonus = Math.round(300 * closeness(firstError) ** 2);
    return { base, firstGuessBonus, improvementBonus: 0, multiplier, total: Math.round((base + firstGuessBonus) * multiplier) };
  }

  const base = Math.round(fullBase);
  const firstGuessBonus = Math.round(300 * closeness(firstError) ** 2);
  const improvementRatio = firstError > 0 ? Math.min(1, Math.max(0, (firstError - bestError) / firstError)) : 0;
  // Kept for multi-guess compatibility; in one-shot play it is the 100-point hit bonus.
  const improvementBonus = guessCount === 1 ? 100 : Math.round(100 * improvementRatio);
  const total = Math.round((base + firstGuessBonus + improvementBonus) * multiplier);
  return { base, firstGuessBonus, improvementBonus, multiplier, total };
}

export const SOLVE_XP_BONUS = 10;

export function xpForAttempt(points: number, status: FinishStatus): number {
  if (status === 'skipped') return 0;
  // A reveal only earns a token amount when there was a real attempt (points > 0).
  return Math.round(points / 10) + (status === 'solved' ? SOLVE_XP_BONUS : 0);
}

/** Cumulative XP required to reach `level` (level 1 needs 0). */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(100 * Math.pow(level - 1, 1.5));
}

export interface LevelInfo {
  level: number;
  xp: number;
  /** XP at the start of the current level. */
  levelStart: number;
  /** XP needed for the next level. */
  nextLevel: number;
  /** 0..1 progress through the current level. */
  progress: number;
}

export function levelFromXp(xp: number): LevelInfo {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const levelStart = xpForLevel(level);
  const nextLevel = xpForLevel(level + 1);
  return { level, xp, levelStart, nextLevel, progress: (xp - levelStart) / (nextLevel - levelStart) };
}

export const LEVEL_TITLES: [number, string][] = [
  [1, 'Wild Guesser'],
  [3, 'Napkin Mathematician'],
  [6, 'Ballpark Regular'],
  [10, 'Order-of-Magnitude Ace'],
  [15, 'Fermi Apprentice'],
  [22, 'Estimation Savant'],
  [30, 'Human Calculator'],
  [40, 'Enrico Himself'],
];

export function levelTitle(level: number): string {
  let title = LEVEL_TITLES[0][1];
  for (const [min, name] of LEVEL_TITLES) if (level >= min) title = name;
  return title;
}
