import { describe, expect, it } from 'vitest';
import { levelFromXp, scoreAttempt, xpForAttempt, xpForLevel } from '../src/engine/scoring';
import { evaluateAchievements, type AchievementContext } from '../src/achievements';
import { formatNumber } from '../src/engine/format';

const solved = (guessCount: number, firstError: number, bestError: number, difficulty: 'easy' | 'insane' = 'easy') =>
  scoreAttempt({ status: 'solved', difficulty, guessCount, firstError, bestError }).total;

describe('scoreAttempt', () => {
  it('awards a perfect single guess the maximum (base + first-guess + hit bonus)', () => {
    expect(solved(1, 0, 0)).toBe(1000);
  });

  it('still scores a single missed guess on closeness, below a hit', () => {
    const miss = scoreAttempt({ status: 'revealed', difficulty: 'easy', guessCount: 1, firstError: 0.3, bestError: 0.3 });
    expect(miss.total).toBeGreaterThan(0);
    expect(miss.improvementBonus).toBe(0);
    expect(miss.total).toBeLessThan(solved(1, 0.3, 0.3));
    const wayOff = scoreAttempt({ status: 'revealed', difficulty: 'easy', guessCount: 1, firstError: 2, bestError: 2 });
    expect(wayOff.total).toBe(0);
  });

  it('rewards closer final guesses', () => {
    expect(solved(3, 0.5, 0.01)).toBeGreaterThan(solved(3, 0.5, 0.09));
  });

  it('rewards better first guesses', () => {
    expect(solved(3, 0.2, 0.05)).toBeGreaterThan(solved(3, 0.9, 0.05));
  });

  it('decays with extra guesses but never makes guessing pointless', () => {
    const few = solved(2, 0.5, 0.05);
    const many = solved(40, 0.5, 0.05);
    expect(few).toBeGreaterThan(many);
    expect(many).toBeGreaterThan(0);
  });

  it('rewards improvement even with a bad start', () => {
    const r = scoreAttempt({ status: 'solved', difficulty: 'easy', guessCount: 6, firstError: 2, bestError: 0.05 });
    expect(r.firstGuessBonus).toBe(0);
    expect(r.improvementBonus).toBeGreaterThan(90);
    expect(r.total).toBeGreaterThan(300);
  });

  it('applies difficulty multipliers', () => {
    expect(solved(1, 0, 0, 'insane')).toBe(2000);
  });

  it('pays less for misses than hits and nothing for skips', () => {
    const revealed = scoreAttempt({ status: 'revealed', difficulty: 'easy', guessCount: 3, firstError: 1, bestError: 0.3 });
    expect(revealed.total).toBeGreaterThan(0);
    expect(revealed.total).toBeLessThan(solved(3, 1, 0.3));
    expect(scoreAttempt({ status: 'skipped', difficulty: 'easy', guessCount: 0, firstError: null, bestError: null }).total).toBe(0);
    expect(scoreAttempt({ status: 'revealed', difficulty: 'easy', guessCount: 0, firstError: null, bestError: null }).total).toBe(0);
  });
});

describe('levels', () => {
  it('has a monotonic curve', () => {
    for (let l = 1; l < 50; l++) expect(xpForLevel(l + 1)).toBeGreaterThan(xpForLevel(l));
  });
  it('derives level and progress from XP', () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(100).level).toBe(2);
    const mid = levelFromXp(50);
    expect(mid.progress).toBeCloseTo(0.5);
  });
  it('awards XP per attempt', () => {
    expect(xpForAttempt(900, 'solved')).toBe(100);
    expect(xpForAttempt(0, 'skipped')).toBe(0);
  });
});

describe('achievements', () => {
  const base: AchievementContext = {
    attempt: { status: 'solved', difficulty: 'easy', guessCount: 1, firstError: 0.001, bestError: 0.001 },
    totals: { played: 1, solved: 1, solvedCategories: 1, totalCategories: 11 },
    dailyStreak: 1,
    endlessStreak: 0,
  };
  it('unlocks the expected first-solve badges', () => {
    const keys = evaluateAchievements(base, new Set()).map((a) => a.key);
    expect(keys).toEqual(expect.arrayContaining(['first_blood', 'sharp_mind', 'perfectionist']));
    expect(keys).not.toContain('explorer');
  });
  it('does not re-award unlocked badges', () => {
    const keys = evaluateAchievements(base, new Set(['first_blood'])).map((a) => a.key);
    expect(keys).not.toContain('first_blood');
  });
  it('detects streaks and volume milestones', () => {
    const ctx = { ...base, endlessStreak: 5, totals: { ...base.totals, played: 50, solved: 10 } };
    const keys = evaluateAchievements(ctx, new Set()).map((a) => a.key);
    expect(keys).toEqual(expect.arrayContaining(['hot_hand', 'regular', 'double_digits']));
  });
});

describe('formatNumber', () => {
  it('renders human-friendly numbers', () => {
    expect(formatNumber(2_500_000)).toBe('2.5 million');
    expect(formatNumber(38_400)).toBe('38,400');
    expect(formatNumber(7.8e9)).toBe('7.8 billion');
    expect(formatNumber(0.42)).toBe('0.42');
  });
});
