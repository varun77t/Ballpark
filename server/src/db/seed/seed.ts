import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { DEFAULT_TOLERANCE } from '@ballpark/shared';
import { db, pool } from '../client';
import { categories, questionPacks, questions, type NewQuestion } from '../schema';
import { CATEGORIES } from './categories';
import { QUESTIONS_BY_CATEGORY } from './questions';
import type { GeneratedPack, SeedQuestion } from './types';
import { validateSeed } from './validate';

const here = path.dirname(fileURLToPath(import.meta.url));
// Works from src/db/seed (tsx) and from dist/db/seed (bundled build).
const GENERATED_DIRS = [path.join(here, 'generated'), path.resolve(here, '../../../src/db/seed/generated')];

/** Packs written by scripts/build-questions.ts. Missing directory = no generated packs. */
export async function loadGeneratedPacks(): Promise<GeneratedPack[]> {
  const dir = GENERATED_DIRS.find((d) => existsSync(d));
  if (!dir) return [];
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();
  return Promise.all(files.map(async (f) => JSON.parse(await readFile(path.join(dir, f), 'utf8')) as GeneratedPack));
}

function toRow(q: SeedQuestion, categorySlug: string, packId: number | null): NewQuestion {
  return {
    slug: q.slug,
    text: q.text,
    categorySlug,
    difficulty: q.difficulty,
    answer: q.answer,
    answerLow: q.low ?? null,
    answerHigh: q.high ?? null,
    unit: q.unit,
    toleranceRatio: q.tolerance ?? DEFAULT_TOLERANCE[q.difficulty],
    answerKind: q.kind,
    explanation: q.explanation,
    reasoning: q.reasoning,
    fact: q.fact,
    imageUrl: q.imageUrl ?? null,
    sources: q.sources,
    dailyEligible: q.dailyEligible ?? true,
    packId,
    isActive: true,
  };
}

/** Upserts categories, packs and questions by slug. Safe to run repeatedly. */
export async function seed(): Promise<{ categories: number; questions: number; packs: number }> {
  const packs = await loadGeneratedPacks();

  // Validate everything together so slugs stay unique across hand-written and generated questions.
  const byCategory: Record<string, SeedQuestion[]> = {};
  for (const [cat, list] of Object.entries(QUESTIONS_BY_CATEGORY)) byCategory[cat] = [...list];
  for (const p of packs) {
    for (const q of p.questions) {
      const cat = q.category ?? '';
      (byCategory[cat] ??= []).push(q);
    }
  }
  const problems = validateSeed(CATEGORIES, byCategory);
  if (problems.length) throw new Error(`Seed data has problems:\n  - ${problems.slice(0, 40).join('\n  - ')}${problems.length > 40 ? `\n  …and ${problems.length - 40} more` : ''}`);

  const rows: NewQuestion[] = [];
  await db.transaction(async (tx) => {
    for (const [i, c] of CATEGORIES.entries()) {
      await tx
        .insert(categories)
        .values({ ...c, sortOrder: i })
        .onConflictDoUpdate({
          target: categories.slug,
          set: { name: c.name, description: c.description, icon: c.icon, color: c.color, sortOrder: i },
        });
    }

    for (const [cat, list] of Object.entries(QUESTIONS_BY_CATEGORY)) rows.push(...list.map((q) => toRow(q, cat, null)));
    for (const p of packs) {
      const [pack] = await tx
        .insert(questionPacks)
        .values({ slug: p.pack.slug, name: p.pack.name, isPublic: true })
        .onConflictDoUpdate({ target: questionPacks.slug, set: { name: p.pack.name } })
        .returning({ id: questionPacks.id });
      rows.push(...p.questions.map((q) => toRow(q, q.category!, pack.id)));
    }

    // Chunked to stay well under Postgres' bind-parameter limit.
    for (let i = 0; i < rows.length; i += 400) {
      await tx
        .insert(questions)
        .values(rows.slice(i, i + 400))
        .onConflictDoUpdate({
          target: questions.slug,
          set: {
            text: sql`excluded.text`,
            categorySlug: sql`excluded.category_slug`,
            difficulty: sql`excluded.difficulty`,
            answer: sql`excluded.answer`,
            answerLow: sql`excluded.answer_low`,
            answerHigh: sql`excluded.answer_high`,
            unit: sql`excluded.unit`,
            toleranceRatio: sql`excluded.tolerance_ratio`,
            answerKind: sql`excluded.answer_kind`,
            explanation: sql`excluded.explanation`,
            reasoning: sql`excluded.reasoning`,
            fact: sql`excluded.fact`,
            imageUrl: sql`excluded.image_url`,
            sources: sql`excluded.sources`,
            dailyEligible: sql`excluded.daily_eligible`,
            packId: sql`excluded.pack_id`,
            isActive: sql`excluded.is_active`,
          },
        });
    }
  });

  return { categories: CATEGORIES.length, questions: rows.length, packs: packs.length };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  seed()
    .then((r) => {
      console.log(`✔ seeded ${r.categories} categories, ${r.packs} generated packs, ${r.questions} questions`);
      return pool.end();
    })
    .catch((err) => {
      console.error(err.message ?? err);
      process.exit(1);
    });
}
