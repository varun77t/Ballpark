import { DEFAULT_TOLERANCE, DIFFICULTIES, SHAPES } from '@ballpark/shared';
import type { SeedCategory, SeedQuestion } from './types';

/** Catches authoring mistakes before they reach the database. Returns a list of problems. */
export function validateSeed(categories: SeedCategory[], byCategory: Record<string, SeedQuestion[]>): string[] {
  const problems: string[] = [];
  const catSlugs = new Set(categories.map((c) => c.slug));
  const seen = new Set<string>();

  for (const [category, list] of Object.entries(byCategory)) {
    if (!catSlugs.has(category)) problems.push(`unknown category "${category}"`);
    for (const q of list) {
      const where = `${category}/${q.slug}`;
      if (seen.has(q.slug)) problems.push(`${where}: duplicate slug`);
      seen.add(q.slug);
      if (!/^[a-z0-9-]+$/.test(q.slug)) problems.push(`${where}: slug must be kebab-case`);
      if (!DIFFICULTIES.includes(q.difficulty)) problems.push(`${where}: bad difficulty`);
      if (!SHAPES.includes(q.shape)) problems.push(`${where}: shape must be one of ${SHAPES.join(', ')}`);
      if (q.qualifier !== undefined && (!q.qualifier.trim() || q.qualifier.includes('?'))) problems.push(`${where}: qualifier is fine print, not a question`);
      if (!(q.answer > 0) || !Number.isFinite(q.answer)) problems.push(`${where}: answer must be a positive number`);
      if ((q.low === undefined) !== (q.high === undefined)) problems.push(`${where}: low and high must be set together`);
      if (q.low !== undefined && q.high !== undefined && !(q.low > 0 && q.low <= q.answer && q.answer <= q.high)) {
        problems.push(`${where}: range must satisfy 0 < low ≤ answer ≤ high`);
      }
      const tol = q.tolerance ?? DEFAULT_TOLERANCE[q.difficulty];
      if (!(tol > 1)) problems.push(`${where}: tolerance must be > 1`);
      if (q.reasoning.length < 2) problems.push(`${where}: needs at least two reasoning steps`);
      if (q.sources.length === 0) problems.push(`${where}: needs at least one source`);
      if (!q.text.includes('?')) problems.push(`${where}: question text should be a question`);
    }
  }
  return problems;
}
