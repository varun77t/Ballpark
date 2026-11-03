import { and, eq, sql } from 'drizzle-orm';
import { ACHIEVEMENTS, evaluateAchievements, type AchievementContext, type AchievementDTO } from '@ballpark/shared';
import { db, type Tx } from '../db/client';
import { attempts, categories, questions, userAchievements } from '../db/schema';

type PartialContext = Omit<AchievementContext, 'totals'>;

export async function unlockAchievements(tx: Tx, userId: string, partial: PartialContext): Promise<AchievementDTO[]> {
  const [totals] = await tx
    .select({
      played: sql<number>`count(*) filter (where ${attempts.guessCount} > 0)::int`,
      solved: sql<number>`count(*) filter (where ${attempts.status} = 'solved')::int`,
      solvedCategories: sql<number>`count(distinct ${questions.categorySlug}) filter (where ${attempts.status} = 'solved')::int`,
    })
    .from(attempts)
    .innerJoin(questions, eq(questions.id, attempts.questionId))
    .where(eq(attempts.userId, userId));
  const [{ totalCategories }] = await tx
    .select({ totalCategories: sql<number>`count(distinct ${categories.slug})::int` })
    .from(categories)
    .innerJoin(questions, and(eq(questions.categorySlug, categories.slug), eq(questions.isActive, true)));

  const owned = await tx.select({ key: userAchievements.key }).from(userAchievements).where(eq(userAchievements.userId, userId));
  const unlocked = evaluateAchievements({ ...partial, totals: { ...totals, totalCategories } }, new Set(owned.map((o) => o.key)));
  if (unlocked.length === 0) return [];

  const inserted = await tx
    .insert(userAchievements)
    .values(unlocked.map((a) => ({ userId, key: a.key })))
    .onConflictDoNothing()
    .returning();
  const at = new Map(inserted.map((r) => [r.key, r.unlockedAt.toISOString()]));
  return unlocked
    .filter((a) => at.has(a.key))
    .map((a) => ({ key: a.key, name: a.name, description: a.description, icon: a.icon, unlockedAt: at.get(a.key)! }));
}

export async function listAchievements(userId: string | null): Promise<AchievementDTO[]> {
  const owned = userId ? await db.select().from(userAchievements).where(eq(userAchievements.userId, userId)) : [];
  const at = new Map(owned.map((r) => [r.key, r.unlockedAt.toISOString()]));
  return ACHIEVEMENTS.map((a) => ({
    key: a.key,
    name: a.name,
    description: a.description,
    icon: a.icon,
    unlockedAt: at.get(a.key) ?? null,
  }));
}
