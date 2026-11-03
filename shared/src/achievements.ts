import type { Difficulty } from './types';

/** Everything an achievement check can look at after an attempt finishes. */
export interface AchievementContext {
  attempt: {
    status: 'solved' | 'revealed' | 'skipped';
    difficulty: Difficulty;
    guessCount: number;
    firstError: number | null;
    bestError: number | null;
  };
  totals: {
    played: number;
    solved: number;
    solvedCategories: number;
    totalCategories: number;
  };
  dailyStreak: number;
  endlessStreak: number;
}

export interface AchievementDef {
  key: string;
  name: string;
  description: string;
  /** lucide-react icon name */
  icon: string;
  check: (ctx: AchievementContext) => boolean;
}

const within = (ratio: number) => Math.log10(ratio) + 1e-9;
const solved = (ctx: AchievementContext) => ctx.attempt.status === 'solved';

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    key: 'first_blood',
    name: 'First Blood',
    description: 'Solve your first question.',
    icon: 'Droplet',
    check: (c) => solved(c) && c.totals.solved >= 1,
  },
  {
    key: 'sharp_mind',
    name: 'Sharp Mind',
    description: 'Land a guess within 5% of the answer.',
    icon: 'Crosshair',
    check: (c) => c.attempt.bestError !== null && c.attempt.bestError <= within(1.05),
  },
  {
    key: 'perfectionist',
    name: 'Perfectionist',
    description: 'Land a guess within 1% of the answer.',
    icon: 'Gem',
    check: (c) => c.attempt.bestError !== null && c.attempt.bestError <= within(1.01),
  },
  {
    key: 'hot_hand',
    name: 'Hot Hand',
    description: 'Hit 5 in a row in Endless mode.',
    icon: 'Sparkles',
    check: (c) => c.endlessStreak >= 5,
  },
  {
    key: 'regular',
    name: 'Regular',
    description: 'Play 50 questions.',
    icon: 'Repeat',
    check: (c) => c.totals.played >= 50,
  },
  {
    key: 'double_digits',
    name: 'Double Digits',
    description: 'Hit 10 questions.',
    icon: 'TrendingUp',
    check: (c) => c.totals.solved >= 10,
  },
  {
    key: 'explorer',
    name: 'Explorer',
    description: 'Solve questions from 5 different categories.',
    icon: 'Compass',
    check: (c) => c.totals.solvedCategories >= 5,
  },
  {
    key: 'worldly',
    name: 'Worldly',
    description: 'Solve a question in every category.',
    icon: 'Globe2',
    check: (c) => c.totals.totalCategories > 0 && c.totals.solvedCategories >= c.totals.totalCategories,
  },
  {
    key: 'insane_mind',
    name: 'Insane Mind',
    description: 'Solve an Insane-difficulty question.',
    icon: 'Brain',
    check: (c) => solved(c) && c.attempt.difficulty === 'insane',
  },
  {
    key: 'week_warrior',
    name: 'Week Warrior',
    description: 'Keep a 7-day daily challenge streak.',
    icon: 'Flame',
    check: (c) => c.dailyStreak >= 7,
  },
  {
    key: 'marathoner',
    name: 'Marathoner',
    description: 'Reach a streak of 25 in Endless mode.',
    icon: 'Infinity',
    check: (c) => c.endlessStreak >= 25,
  },
  {
    key: 'centurion',
    name: 'Centurion',
    description: 'Solve 100 questions.',
    icon: 'Trophy',
    check: (c) => c.totals.solved >= 100,
  },
];

export const ACHIEVEMENT_MAP = new Map(ACHIEVEMENTS.map((a) => [a.key, a]));

export function evaluateAchievements(ctx: AchievementContext, alreadyUnlocked: Set<string>): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => !alreadyUnlocked.has(a.key) && a.check(ctx));
}
