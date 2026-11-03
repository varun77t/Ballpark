import { and, desc, eq, sql } from 'drizzle-orm';
import { accuracyPct, type AttemptDTO, type EndlessRunDTO, type FinishStatus } from '@ballpark/shared';
import { db, type Tx } from '../db/client';
import { attempts, endlessRuns, userStats, type EndlessRun } from '../db/schema';
import { conflict, notFound } from '../lib/http';
import { selectQuestion, type SelectFilters } from './questionService';
import { buildAttemptDTO, createAttempt } from './attemptService';

export async function getRunDTO(tx: Tx, run: EndlessRun): Promise<EndlessRunDTO> {
  const [latest] = await tx
    .select({ id: attempts.id })
    .from(attempts)
    .where(eq(attempts.runId, run.id))
    .orderBy(desc(attempts.startedAt))
    .limit(1);
  return {
    id: run.id,
    status: run.status,
    solvedCount: run.solvedCount,
    currentStreak: run.currentStreak,
    bestStreak: run.bestStreak,
    questionsPlayed: run.questionsPlayed,
    averageAccuracy: run.questionsPlayed > 0 ? run.totalAccuracy / run.questionsPlayed : null,
    startedAt: run.startedAt.toISOString(),
    endedAt: run.endedAt?.toISOString() ?? null,
    currentAttemptId: latest?.id ?? null,
  };
}

async function ownRun(tx: Tx, userId: string, runId: string, lock = false): Promise<EndlessRun> {
  const q = tx.select().from(endlessRuns).where(and(eq(endlessRuns.id, runId), eq(endlessRuns.userId, userId)));
  const [run] = lock ? await q.for('update') : await q;
  if (!run) throw notFound('Run not found.');
  return run;
}

async function runQuestionIds(tx: Tx, runId: string): Promise<number[]> {
  const rows = await tx.select({ id: attempts.questionId }).from(attempts).where(eq(attempts.runId, runId));
  return rows.map((r) => r.id);
}

export async function startRun(userId: string, filters: Omit<SelectFilters, 'excludeIds'>): Promise<{ run: EndlessRunDTO; attempt: AttemptDTO }> {
  return db.transaction(async (tx) => {
    // Only one live run at a time; starting over ends the previous one.
    await tx
      .update(endlessRuns)
      .set({ status: 'ended', endedAt: new Date() })
      .where(and(eq(endlessRuns.userId, userId), eq(endlessRuns.status, 'active')));
    const [run] = await tx.insert(endlessRuns).values({ userId }).returning();
    const question = await selectQuestion(tx, userId, filters);
    const attempt = await createAttempt(tx, userId, { mode: 'endless', questionId: question.id, runId: run.id });
    return { run: await getRunDTO(tx, run), attempt: await buildAttemptDTO(tx, attempt, question) };
  });
}

export async function getActiveRun(userId: string): Promise<EndlessRunDTO | null> {
  const [run] = await db
    .select()
    .from(endlessRuns)
    .where(and(eq(endlessRuns.userId, userId), eq(endlessRuns.status, 'active')))
    .orderBy(desc(endlessRuns.startedAt))
    .limit(1);
  return run ? getRunDTO(db, run) : null;
}

export async function getRun(userId: string, runId: string): Promise<EndlessRunDTO> {
  return getRunDTO(db, await ownRun(db, userId, runId));
}

export async function nextInRun(userId: string, runId: string, filters: Omit<SelectFilters, 'excludeIds'>): Promise<{ run: EndlessRunDTO; attempt: AttemptDTO }> {
  return db.transaction(async (tx) => {
    const run = await ownRun(tx, userId, runId, true);
    if (run.status !== 'active') throw conflict('This run has ended. Start a new one!', 'run_ended');
    const [current] = await tx.select().from(attempts).where(eq(attempts.runId, runId)).orderBy(desc(attempts.startedAt)).limit(1);
    // Resuming mid-question returns the same attempt instead of stacking a new one.
    if (current && current.status === 'active') return { run: await getRunDTO(tx, run), attempt: await buildAttemptDTO(tx, current) };

    const question = await selectQuestion(tx, userId, { ...filters, excludeIds: await runQuestionIds(tx, runId) });
    const attempt = await createAttempt(tx, userId, { mode: 'endless', questionId: question.id, runId });
    return { run: await getRunDTO(tx, run), attempt: await buildAttemptDTO(tx, attempt, question) };
  });
}

export async function endRun(userId: string, runId: string): Promise<EndlessRunDTO> {
  return db.transaction(async (tx) => {
    const run = await ownRun(tx, userId, runId, true);
    if (run.status === 'ended') return getRunDTO(tx, run);
    // An unanswered question at the end of the run counts as skipped.
    await tx
      .update(attempts)
      .set({ status: 'skipped', finishedAt: new Date() })
      .where(and(eq(attempts.runId, runId), eq(attempts.status, 'active')));
    const [ended] = await tx.update(endlessRuns).set({ status: 'ended', endedAt: new Date() }).where(eq(endlessRuns.id, runId)).returning();
    return getRunDTO(tx, ended);
  });
}

/** A hit extends the streak; a miss or skip resets it to zero. The run itself only ends when the player ends it. */
export async function applyEndlessResult(tx: Tx, runId: string, status: FinishStatus, bestError: number | null): Promise<EndlessRun> {
  const [run] = await tx.select().from(endlessRuns).where(eq(endlessRuns.id, runId)).for('update');
  const accuracy = bestError === null ? 0 : accuracyPct(bestError);
  const solved = status === 'solved';
  const currentStreak = solved ? run.currentStreak + 1 : 0;
  const bestStreak = Math.max(run.bestStreak, currentStreak);
  const [updated] = await tx
    .update(endlessRuns)
    .set({
      solvedCount: run.solvedCount + (solved ? 1 : 0),
      questionsPlayed: run.questionsPlayed + 1,
      totalAccuracy: run.totalAccuracy + accuracy,
      currentStreak,
      bestStreak,
    })
    .where(eq(endlessRuns.id, runId))
    .returning();
  await tx
    .update(userStats)
    .set({ bestEndlessStreak: sql`greatest(${userStats.bestEndlessStreak}, ${bestStreak})` })
    .where(eq(userStats.userId, run.userId));
  return updated;
}
