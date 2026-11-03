import { and, asc, desc, eq, gte, notInArray, sql } from 'drizzle-orm';
import type { DailyDTO } from '@ballpark/shared';
import { db, type Tx } from '../db/client';
import { attempts, dailyChallenges, questions, userStats } from '../db/schema';
import { addDays, hashString } from '../lib/dates';
import { notFound } from '../lib/http';
import { getQuestion, toPublic } from './questionService';
import { buildAttemptDTO, createAttempt } from './attemptService';

const NO_REPEAT_DAYS = 90;

/**
 * Returns the question for a calendar date, creating the assignment on first request.
 * The pick is a hash of the date over eligible questions not used recently; the date
 * primary key makes concurrent first requests converge on a single row.
 */
export async function getDailyQuestionId(date: string): Promise<number> {
  const [existing] = await db.select().from(dailyChallenges).where(eq(dailyChallenges.date, date));
  if (existing) return existing.questionId;

  const recent = db
    .select({ id: dailyChallenges.questionId })
    .from(dailyChallenges)
    .where(gte(dailyChallenges.date, addDays(date, -NO_REPEAT_DAYS)));
  let pool = await db
    .select({ id: questions.id })
    .from(questions)
    .where(and(eq(questions.isActive, true), eq(questions.dailyEligible, true), notInArray(questions.id, recent)))
    .orderBy(asc(questions.id));
  if (pool.length === 0) {
    pool = await db
      .select({ id: questions.id })
      .from(questions)
      .where(and(eq(questions.isActive, true), eq(questions.dailyEligible, true)))
      .orderBy(asc(questions.id));
  }
  if (pool.length === 0) throw notFound('No daily questions available.');

  const questionId = pool[hashString(`ballpark-daily:${date}`) % pool.length].id;
  await db.insert(dailyChallenges).values({ date, questionId }).onConflictDoNothing();
  const [row] = await db.select().from(dailyChallenges).where(eq(dailyChallenges.date, date));
  return row.questionId;
}

/** Streak shown to the player: it lapses if neither today nor yesterday was completed. */
function liveStreak(stats: { dailyStreak: number; lastDailyDate: string | null } | undefined, date: string): number {
  if (!stats?.lastDailyDate) return 0;
  return stats.lastDailyDate === date || stats.lastDailyDate === addDays(date, -1) ? stats.dailyStreak : 0;
}

export async function getDaily(userId: string | null, date: string): Promise<DailyDTO> {
  const questionId = await getDailyQuestionId(date);
  const question = await getQuestion(db, questionId);

  const [{ solvers }] = await db
    .select({ solvers: sql<number>`count(*)::int` })
    .from(attempts)
    .where(and(eq(attempts.dailyDate, date), eq(attempts.mode, 'daily'), eq(attempts.practice, false), eq(attempts.status, 'solved')));

  if (!userId) {
    return { date, question: toPublic(question), attempt: null, completed: false, streak: 0, bestStreak: 0, solvers };
  }

  // Prefer the scored attempt; otherwise the most recent practice replay.
  const [attempt] = await db
    .select()
    .from(attempts)
    .where(and(eq(attempts.userId, userId), eq(attempts.mode, 'daily'), eq(attempts.dailyDate, date)))
    .orderBy(asc(attempts.practice), desc(attempts.startedAt))
    .limit(1);
  const [stats] = await db.select().from(userStats).where(eq(userStats.userId, userId));

  return {
    date,
    question: toPublic(question),
    attempt: attempt ? await buildAttemptDTO(db, attempt, question) : null,
    completed: !!attempt && !attempt.practice && attempt.status !== 'active',
    streak: liveStreak(stats, date),
    bestStreak: stats?.bestDailyStreak ?? 0,
    solvers,
  };
}

/** Returns the scored daily attempt (creating it if needed), or a new practice attempt when `practice` is set. */
export async function startDaily(userId: string, date: string, practice: boolean) {
  const questionId = await getDailyQuestionId(date);
  return db.transaction(async (tx) => {
    const [scored] = await tx
      .select()
      .from(attempts)
      .where(and(eq(attempts.userId, userId), eq(attempts.mode, 'daily'), eq(attempts.dailyDate, date), eq(attempts.practice, false)));
    if (scored && (scored.status === 'active' || !practice)) return buildAttemptDTO(tx, scored);
    const attempt = await createAttempt(tx, userId, { mode: 'daily', questionId, dailyDate: date, practice: !!scored });
    return buildAttemptDTO(tx, attempt);
  });
}

/** Called when a scored daily is solved. Extends the streak if yesterday was solved, otherwise restarts it. */
export async function applyDailyCompletion(tx: Tx, userId: string, date: string) {
  const [stats] = await tx.select().from(userStats).where(eq(userStats.userId, userId)).for('update');
  if (!stats) return { streak: 1, best: 1 };
  if (stats.lastDailyDate === date) return { streak: stats.dailyStreak, best: stats.bestDailyStreak };
  // Completing an older daily (e.g. after midnight in another zone) never rewinds the streak.
  if (stats.lastDailyDate && stats.lastDailyDate > date) return { streak: stats.dailyStreak, best: stats.bestDailyStreak };

  const streak = stats.lastDailyDate === addDays(date, -1) ? stats.dailyStreak + 1 : 1;
  const best = Math.max(stats.bestDailyStreak, streak);
  await tx
    .update(userStats)
    .set({ dailyStreak: streak, bestDailyStreak: best, lastDailyDate: date, updatedAt: new Date() })
    .where(eq(userStats.userId, userId));
  return { streak, best };
}
