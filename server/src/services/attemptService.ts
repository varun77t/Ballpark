import { and, asc, count, eq, lte, ne, sql } from 'drizzle-orm';
import {
  accuracyPct,
  evaluateGuess,
  levelFromXp,
  parseGuess,
  scoreAttempt,
  xpForAttempt,
  type AttemptDTO,
  type FinishPayload,
  type FinishStatus,
  type GuessDTO,
  type GuessResponse,
  type Mode,
  type ScoreBreakdown,
  type TierKey,
} from '@ballpark/shared';
import { db, type Tx } from '../db/client';
import { attempts, guesses, questions, userStats, type Attempt, type Guess, type Question } from '../db/schema';
import { badRequest, conflict, notFound } from '../lib/http';
import { getQuestion, toPublic, toReveal } from './questionService';
import { applyDailyCompletion } from './dailyService';
import { applyEndlessResult, getRunDTO } from './endlessService';
import { unlockAchievements } from './achievementService';

export interface StartOptions {
  mode: Mode;
  questionId: number;
  dailyDate?: string | null;
  runId?: string | null;
  practice?: boolean;
}

export async function createAttempt(tx: Tx, userId: string, opts: StartOptions): Promise<Attempt> {
  const [attempt] = await tx
    .insert(attempts)
    .values({
      userId,
      questionId: opts.questionId,
      mode: opts.mode,
      dailyDate: opts.dailyDate ?? null,
      runId: opts.runId ?? null,
      practice: opts.practice ?? false,
    })
    .returning();
  return attempt;
}

function guessToDTO(g: Guess): GuessDTO {
  return {
    value: g.value,
    logError: g.logError,
    direction: g.direction,
    tier: g.tier as TierKey,
    accuracy: accuracyPct(g.logError),
    createdAt: g.createdAt.toISOString(),
  };
}

export async function buildAttemptDTO(tx: Tx, attempt: Attempt, question?: Question): Promise<AttemptDTO> {
  const q = question ?? (await getQuestion(tx, attempt.questionId));
  const rows = await tx.select().from(guesses).where(eq(guesses.attemptId, attempt.id)).orderBy(asc(guesses.id));
  const [{ n }] = await tx
    .select({ n: count() })
    .from(attempts)
    // Compare in SQL: JS Dates drop the microseconds Postgres stores, which would exclude this attempt.
    .where(
      and(
        eq(attempts.userId, attempt.userId),
        lte(attempts.startedAt, sql`(select a2.started_at from ${attempts} a2 where a2.id = ${attempt.id})`),
      ),
    );
  const finished = attempt.status !== 'active';
  const breakdown = attempt.scoreBreakdown as ScoreBreakdown | null;

  return {
    id: attempt.id,
    mode: attempt.mode,
    status: attempt.status,
    dailyDate: attempt.dailyDate,
    runId: attempt.runId,
    // The answer only leaves the server once the attempt is over.
    question: finished ? toReveal(q) : toPublic(q),
    guesses: rows.map(guessToDTO),
    guessCount: attempt.guessCount,
    bestError: attempt.bestError,
    bestGuess: attempt.bestGuess,
    points: attempt.points,
    number: Number(n),
    practice: attempt.practice,
    startedAt: attempt.startedAt.toISOString(),
    finishedAt: attempt.finishedAt?.toISOString() ?? null,
    result:
      attempt.status !== 'active'
        ? {
            status: attempt.status,
            answer: q.answer,
            bestGuess: attempt.bestGuess,
            bestError: attempt.bestError,
            accuracy: attempt.bestError === null ? 0 : accuracyPct(attempt.bestError),
            guessCount: attempt.guessCount,
            score: breakdown ?? { base: 0, firstGuessBonus: 0, improvementBonus: 0, multiplier: 1, total: 0 },
            xpGained: attempt.xpGained,
            personalBest: attempt.personalBest,
          }
        : null,
  };
}

async function lockOwnAttempt(tx: Tx, userId: string, attemptId: string): Promise<Attempt> {
  const [attempt] = await tx
    .select()
    .from(attempts)
    .where(and(eq(attempts.id, attemptId), eq(attempts.userId, userId)))
    .for('update');
  if (!attempt) throw notFound('Attempt not found.');
  return attempt;
}

export async function getAttempt(userId: string, attemptId: string): Promise<AttemptDTO> {
  const [attempt] = await db
    .select()
    .from(attempts)
    .where(and(eq(attempts.id, attemptId), eq(attempts.userId, userId)));
  if (!attempt) throw notFound('Attempt not found.');
  return buildAttemptDTO(db, attempt);
}

export async function submitGuess(userId: string, attemptId: string, raw: string | number): Promise<GuessResponse> {
  const parsed = parseGuess(raw);
  if (!parsed.ok) throw badRequest(parsed.message, `guess_${parsed.reason}`);

  return db.transaction(async (tx) => {
    const attempt = await lockOwnAttempt(tx, userId, attemptId);
    if (attempt.status !== 'active') throw conflict('This question is already finished.', 'attempt_finished');
    const question = await getQuestion(tx, attempt.questionId);

    const evaluation = evaluateGuess(parsed.value, {
      answer: question.answer,
      answerLow: question.answerLow,
      answerHigh: question.answerHigh,
      toleranceRatio: question.toleranceRatio,
    });

    const [guess] = await tx
      .insert(guesses)
      .values({
        attemptId,
        value: parsed.value,
        logError: evaluation.logError,
        direction: evaluation.direction,
        tier: evaluation.tier.key,
      })
      .returning();

    const isBest = attempt.bestError === null || evaluation.logError < attempt.bestError;
    const [updated] = await tx
      .update(attempts)
      .set({
        guessCount: attempt.guessCount + 1,
        firstError: attempt.firstError ?? evaluation.logError,
        bestError: isBest ? evaluation.logError : attempt.bestError,
        bestGuess: isBest ? parsed.value : attempt.bestGuess,
      })
      .where(eq(attempts.id, attemptId))
      .returning();

    // One shot per question: a hit is solved, a miss reveals the answer immediately.
    const finish = await finishAttempt(tx, updated, question, evaluation.solved ? 'solved' : 'revealed');

    return {
      feedback: {
        ...guessToDTO(guess),
        tierLabel: evaluation.tier.label,
        hint: evaluation.hint,
        solved: evaluation.solved,
        improved: attempt.bestError !== null && evaluation.logError < attempt.bestError,
        isBest,
      },
      attempt: finish.attempt,
      finish,
    };
  });
}

export async function endAttempt(userId: string, attemptId: string, status: 'revealed' | 'skipped'): Promise<FinishPayload> {
  return db.transaction(async (tx) => {
    const attempt = await lockOwnAttempt(tx, userId, attemptId);
    if (attempt.status !== 'active') throw conflict('This question is already finished.', 'attempt_finished');
    const question = await getQuestion(tx, attempt.questionId);
    return finishAttempt(tx, attempt, question, status);
  });
}

/**
 * Single place where an attempt ends: scores it, awards XP, moves streaks,
 * updates the endless run and unlocks achievements — all inside the caller's transaction.
 */
async function finishAttempt(tx: Tx, attempt: Attempt, question: Question, status: FinishStatus): Promise<FinishPayload> {
  const score = scoreAttempt({
    status,
    difficulty: question.difficulty,
    guessCount: attempt.guessCount,
    firstError: attempt.firstError,
    bestError: attempt.bestError,
  });
  const points = attempt.practice ? 0 : score.total;
  const xpGained = attempt.practice ? 0 : xpForAttempt(points, status);

  const [{ prevBest }] = await tx
    .select({ prevBest: sql<number | null>`max(${attempts.points})` })
    .from(attempts)
    .where(and(eq(attempts.userId, attempt.userId), eq(attempts.questionId, attempt.questionId), ne(attempts.id, attempt.id), ne(attempts.status, 'active')));
  const personalBest = status === 'solved' && points > 0 && prevBest !== null && points > Number(prevBest);

  const [finished] = await tx
    .update(attempts)
    .set({
      status,
      points,
      xpGained,
      personalBest,
      scoreBreakdown: attempt.practice ? { ...score, total: 0 } : { ...score },
      finishedAt: new Date(),
    })
    .where(eq(attempts.id, attempt.id))
    .returning();

  const [stats] = await tx
    .update(userStats)
    .set({ xp: sql`${userStats.xp} + ${xpGained}`, updatedAt: new Date() })
    .where(eq(userStats.userId, attempt.userId))
    .returning();
  const xpAfter = stats?.xp ?? xpGained;
  const levelBefore = levelFromXp(xpAfter - xpGained).level;
  const levelAfter = levelFromXp(xpAfter).level;

  const daily =
    // Playing the daily (any guess) keeps the streak alive; skipping does not.
    finished.mode === 'daily' && !finished.practice && finished.dailyDate && finished.guessCount > 0
      ? await applyDailyCompletion(tx, attempt.userId, finished.dailyDate)
      : null;

  let endless = null;
  let endlessStreak = 0;
  if (finished.runId) {
    const run = await applyEndlessResult(tx, finished.runId, status, finished.bestError);
    endlessStreak = run.currentStreak;
    endless = await getRunDTO(tx, run);
  }

  const newAchievements = await unlockAchievements(tx, attempt.userId, {
    attempt: {
      status,
      difficulty: question.difficulty,
      guessCount: finished.guessCount,
      firstError: finished.firstError,
      bestError: finished.bestError,
    },
    dailyStreak: daily?.streak ?? 0,
    endlessStreak,
  });

  return {
    attempt: await buildAttemptDTO(tx, finished, question),
    newAchievements,
    levelUp: levelAfter > levelBefore ? { from: levelBefore, to: levelAfter } : null,
    endless,
    daily,
  };
}

/** Starts a fresh attempt at a question the user has played before. */
export async function replayQuestion(userId: string, questionId: number): Promise<AttemptDTO> {
  return db.transaction(async (tx) => {
    const [q] = await tx.select().from(questions).where(and(eq(questions.id, questionId), eq(questions.isActive, true)));
    if (!q) throw notFound('Question not found.');
    const attempt = await createAttempt(tx, userId, { mode: 'random', questionId });
    return buildAttemptDTO(tx, attempt, q);
  });
}
