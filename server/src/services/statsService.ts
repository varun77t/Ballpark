import { and, asc, desc, eq, gte, inArray, ne, or, sql } from 'drizzle-orm';
import {
  ACHIEVEMENTS,
  DIFFICULTIES,
  DIFFICULTY_INFO,
  accuracyPct,
  levelFromXp,
  levelTitle,
  type BreakdownRow,
  type LeaderboardBoard,
  type LeaderboardDTO,
  type LeaderboardRow,
  type MetaDTO,
  type RecentAttemptDTO,
  type StatsDTO,
} from '@ballpark/shared';
import { db } from '../db/client';
import { attempts, categories, questions, userAchievements, userStats, users, type User } from '../db/schema';
import { addDays } from '../lib/dates';
import { toUserDTO } from './userService';

/** Mean accuracy over finished attempts with at least one guess, computed in SQL from best_error. */
const avgAccuracy = sql<number | null>`avg(greatest(0, 100 * (1 - ${attempts.bestError} / 2))) filter (where ${attempts.bestError} is not null)`;
const played = or(ne(attempts.status, 'active'), sql`${attempts.guessCount} > 0`);

export async function getMeta(): Promise<MetaDTO> {
  const cats = await db
    .select({
      slug: categories.slug,
      name: categories.name,
      icon: categories.icon,
      color: categories.color,
      description: categories.description,
      questionCount: sql<number>`count(${questions.id})::int`,
    })
    .from(categories)
    .leftJoin(questions, and(eq(questions.categorySlug, categories.slug), eq(questions.isActive, true)))
    .groupBy(categories.slug)
    .orderBy(asc(categories.sortOrder));
  const diffCounts = await db
    .select({ difficulty: questions.difficulty, n: sql<number>`count(*)::int` })
    .from(questions)
    .where(eq(questions.isActive, true))
    .groupBy(questions.difficulty);
  const byDiff = new Map(diffCounts.map((d) => [d.difficulty, d.n]));
  return {
    categories: cats,
    difficulties: DIFFICULTIES.map((key) => ({ key, ...DIFFICULTY_INFO[key], count: byDiff.get(key) ?? 0 })),
    totalQuestions: diffCounts.reduce((s, d) => s + d.n, 0),
  };
}

export async function getStats(user: User): Promise<StatsDTO> {
  const userId = user.id;
  const [totals] = await db
    .select({
      attempted: sql<number>`count(*)::int`,
      solved: sql<number>`count(*) filter (where ${attempts.status} = 'solved')::int`,
      revealed: sql<number>`count(*) filter (where ${attempts.status} = 'revealed')::int`,
      skipped: sql<number>`count(*) filter (where ${attempts.status} = 'skipped')::int`,
      totalGuesses: sql<number>`coalesce(sum(${attempts.guessCount}), 0)::int`,
      totalPoints: sql<number>`coalesce(sum(${attempts.points}), 0)::int`,
      averageAccuracy: avgAccuracy,
      bestError: sql<number | null>`min(${attempts.bestError})`,
      firstGuessAccuracy: sql<number | null>`avg(greatest(0, 100 * (1 - ${attempts.firstError} / 2))) filter (where ${attempts.firstError} is not null)`,
      averageGuesses: sql<number | null>`avg(${attempts.guessCount}) filter (where ${attempts.status} = 'solved')`,
    })
    .from(attempts)
    .where(and(eq(attempts.userId, userId), played));

  const breakdown = (column: typeof questions.categorySlug | typeof questions.difficulty) =>
    db
      .select({
        key: sql<string>`${column}::text`,
        attempted: sql<number>`count(*)::int`,
        solved: sql<number>`count(*) filter (where ${attempts.status} = 'solved')::int`,
        averageAccuracy: avgAccuracy,
      })
      .from(attempts)
      .innerJoin(questions, eq(questions.id, attempts.questionId))
      .where(and(eq(attempts.userId, userId), played))
      .groupBy(column);

  const [catRows, diffRows, cats, [stats], [{ unlocked }]] = await Promise.all([
    breakdown(questions.categorySlug),
    breakdown(questions.difficulty),
    db.select().from(categories).orderBy(asc(categories.sortOrder)),
    db.select().from(userStats).where(eq(userStats.userId, userId)),
    db
      .select({ unlocked: sql<number>`count(*)::int` })
      .from(userAchievements)
      .where(and(eq(userAchievements.userId, userId), inArray(userAchievements.key, ACHIEVEMENTS.map((a) => a.key)))),
  ]);

  const toRow = (key: string, label: string, rows: typeof catRows): BreakdownRow => {
    const r = rows.find((x) => x.key === key);
    return {
      key,
      label,
      attempted: r?.attempted ?? 0,
      solved: r?.solved ?? 0,
      averageAccuracy: r?.averageAccuracy === null || r?.averageAccuracy === undefined ? null : Number(r.averageAccuracy),
    };
  };

  const xp = stats?.xp ?? 0;
  const level = levelFromXp(xp);
  const today = new Date().toISOString().slice(0, 10);
  const streakAlive = stats?.lastDailyDate === today || stats?.lastDailyDate === addDays(today, -1);
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

  return {
    user: await toUserDTO(user),
    levelTitle: levelTitle(level.level),
    levelProgress: level.progress,
    nextLevelXp: level.nextLevel,
    levelStartXp: level.levelStart,
    attempted: totals.attempted,
    solved: totals.solved,
    revealed: totals.revealed,
    skipped: totals.skipped,
    totalGuesses: totals.totalGuesses,
    totalPoints: totals.totalPoints,
    averageAccuracy: num(totals.averageAccuracy),
    bestAccuracy: totals.bestError === null ? null : accuracyPct(Number(totals.bestError)),
    firstGuessAccuracy: num(totals.firstGuessAccuracy),
    averageGuesses: num(totals.averageGuesses),
    dailyStreak: streakAlive ? (stats?.dailyStreak ?? 0) : 0,
    bestDailyStreak: stats?.bestDailyStreak ?? 0,
    bestEndlessStreak: stats?.bestEndlessStreak ?? 0,
    byCategory: cats.map((c) => toRow(c.slug, c.name, catRows)),
    byDifficulty: DIFFICULTIES.map((d) => toRow(d, DIFFICULTY_INFO[d].label, diffRows)),
    achievementsUnlocked: unlocked,
    achievementsTotal: ACHIEVEMENTS.length,
  };
}

export async function getRecent(userId: string, limit = 10): Promise<RecentAttemptDTO[]> {
  const rows = await db
    .select({ a: attempts, q: { text: questions.text, category: questions.categorySlug, difficulty: questions.difficulty } })
    .from(attempts)
    .innerJoin(questions, eq(questions.id, attempts.questionId))
    .where(and(eq(attempts.userId, userId), played))
    .orderBy(desc(sql`coalesce(${attempts.finishedAt}, ${attempts.startedAt})`))
    .limit(limit);
  return rows.map(({ a, q }) => ({
    id: a.id,
    questionId: a.questionId,
    questionText: q.text,
    category: q.category,
    difficulty: q.difficulty,
    status: a.status,
    guessCount: a.guessCount,
    accuracy: a.bestError === null ? null : accuracyPct(a.bestError),
    points: a.points,
    finishedAt: a.finishedAt?.toISOString() ?? null,
    startedAt: a.startedAt.toISOString(),
  }));
}

const LEADERBOARD_SIZE = 25;

/** Leaderboards only list registered players; guests see where they would rank after signing up. */
export async function getLeaderboard(board: LeaderboardBoard, viewerId: string | null, date: string): Promise<LeaderboardDTO> {
  let ranked: { userId: string; username: string | null; value: number; secondary: number | null }[];

  if (board === 'xp') {
    ranked = await db
      .select({ userId: users.id, username: users.username, value: userStats.xp, secondary: userStats.bestDailyStreak })
      .from(userStats)
      .innerJoin(users, eq(users.id, userStats.userId))
      .where(and(eq(users.isGuest, false), sql`${userStats.xp} > 0`))
      .orderBy(desc(userStats.xp), asc(users.createdAt));
  } else if (board === 'weekly') {
    const since = new Date(Date.now() - 7 * 86_400_000);
    ranked = await db
      .select({
        userId: users.id,
        username: users.username,
        value: sql<number>`sum(${attempts.points})::int`,
        secondary: sql<number>`count(*) filter (where ${attempts.status} = 'solved')::int`,
      })
      .from(attempts)
      .innerJoin(users, eq(users.id, attempts.userId))
      .where(and(eq(users.isGuest, false), gte(attempts.finishedAt, since)))
      .groupBy(users.id)
      .having(sql`sum(${attempts.points}) > 0`)
      .orderBy(desc(sql`sum(${attempts.points})`));
  } else {
    ranked = await db
      .select({ userId: users.id, username: users.username, value: attempts.points, secondary: attempts.guessCount })
      .from(attempts)
      .innerJoin(users, eq(users.id, attempts.userId))
      .where(
        and(
          eq(users.isGuest, false),
          eq(attempts.mode, 'daily'),
          eq(attempts.practice, false),
          eq(attempts.status, 'solved'),
          eq(attempts.dailyDate, date),
        ),
      )
      .orderBy(desc(attempts.points), asc(attempts.guessCount), asc(attempts.finishedAt));
  }

  const rows: LeaderboardRow[] = ranked.map((r, i) => ({
    rank: i + 1,
    username: r.username ?? 'anonymous',
    value: Number(r.value),
    secondary: r.secondary === null ? null : Number(r.secondary),
    isMe: r.userId === viewerId,
  }));
  return { board, rows: rows.slice(0, LEADERBOARD_SIZE), me: rows.find((r) => r.isMe) ?? null };
}
