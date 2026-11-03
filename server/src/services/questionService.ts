import { and, eq, notInArray, sql, type SQL } from 'drizzle-orm';
import type { Difficulty, QuestionPublic, QuestionReveal } from '@ballpark/shared';
import type { Tx } from '../db/client';
import { attempts, questions, type Question } from '../db/schema';
import { notFound } from '../lib/http';

export function toPublic(q: Question): QuestionPublic {
  return {
    id: q.id,
    slug: q.slug,
    text: q.text,
    category: q.categorySlug,
    difficulty: q.difficulty,
    unit: q.unit,
    answerKind: q.answerKind,
    toleranceRatio: q.toleranceRatio,
    imageUrl: q.imageUrl,
  };
}

export function toReveal(q: Question): QuestionReveal {
  return {
    ...toPublic(q),
    answer: q.answer,
    answerLow: q.answerLow,
    answerHigh: q.answerHigh,
    explanation: q.explanation,
    reasoning: q.reasoning,
    fact: q.fact,
    sources: q.sources,
  };
}

export async function getQuestion(tx: Tx, id: number): Promise<Question> {
  const [q] = await tx.select().from(questions).where(eq(questions.id, id));
  if (!q) throw notFound('Question not found.');
  return q;
}

export interface SelectFilters {
  category?: string;
  difficulty?: Difficulty;
  /** Never pick these (e.g. the question just played, or everything in the current endless run). */
  excludeIds?: number[];
}

/**
 * Picks the next question for a user: unseen questions first (in random order),
 * then the ones they played longest ago. Filters narrow the pool; if the filters
 * plus exclusions leave nothing, exclusions are dropped before giving up.
 */
export async function selectQuestion(tx: Tx, userId: string, filters: SelectFilters): Promise<Question> {
  const picked = (await pick(tx, userId, filters)) ?? (filters.excludeIds?.length ? await pick(tx, userId, { ...filters, excludeIds: [] }) : null);
  if (!picked) throw notFound('No questions match those filters yet.');
  return picked;
}

async function pick(tx: Tx, userId: string, filters: SelectFilters): Promise<Question | null> {
  const conds: SQL[] = [eq(questions.isActive, true)];
  if (filters.category) conds.push(eq(questions.categorySlug, filters.category));
  if (filters.difficulty) conds.push(eq(questions.difficulty, filters.difficulty));
  if (filters.excludeIds?.length) conds.push(notInArray(questions.id, filters.excludeIds));

  // Balance the deck: choose a category, then a pack within it (hand-written questions count
  // as one pack), then the question. Otherwise thousands of generated questions would drown
  // out every hand-written one and one template would repeat endlessly.
  const bucket = sql`coalesce(${questions.packId}, 0)`;
  const [choice] = await tx
    .select({ category: questions.categorySlug, bucket: sql<number>`${bucket}` })
    .from(questions)
    .where(and(...conds))
    .groupBy(questions.categorySlug, bucket)
    // Weighted pick (key = u^(1/w)) with w = 1 / packs-in-category: every category gets equal weight.
    .orderBy(sql`power(random(), count(*) over (partition by ${questions.categorySlug})) desc`)
    .limit(1);
  if (!choice) return null;
  conds.push(eq(questions.categorySlug, choice.category), sql`${bucket} = ${choice.bucket}`);

  const lastPlayed = sql<Date | null>`max(${attempts.startedAt})`;
  const [row] = await tx
    .select({ id: questions.id })
    .from(questions)
    .leftJoin(attempts, and(eq(attempts.questionId, questions.id), eq(attempts.userId, userId)))
    .where(and(...conds))
    .groupBy(questions.id)
    .orderBy(sql`${lastPlayed} asc nulls first`, sql`random()`)
    .limit(1);
  if (!row) return null;
  return getQuestion(tx, row.id);
}
