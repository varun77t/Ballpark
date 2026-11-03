import type { AnswerKind, Difficulty, SourceRef } from '@ballpark/shared';

/**
 * Authoring format for a question. Files under ./questions export arrays of these;
 * the seed script upserts them by slug, so editing a file and re-running the seed
 * updates the live question without touching anyone's history.
 *
 * Integrity rules:
 * - kind 'fact': the answer is a documented figure; `sources` must point to where it comes from.
 * - kind 'estimate': the answer is a Fermi estimate; every assumption must appear in `reasoning`,
 *   and `low`/`high` should bracket the defensible range. The UI labels these as estimates.
 */
export interface SeedQuestion {
  slug: string;
  text: string;
  difficulty: Difficulty;
  answer: number;
  low?: number;
  high?: number;
  unit: string;
  kind: AnswerKind;
  /** Solve threshold as a ratio; defaults by difficulty (see DEFAULT_TOLERANCE). */
  tolerance?: number;
  explanation: string;
  reasoning: string[];
  fact: string;
  sources: SourceRef[];
  imageUrl?: string;
  dailyEligible?: boolean;
  /** Required for generated packs (hand-written files are grouped by category already). */
  category?: string;
}

/** A generated question pack (src/db/seed/generated/*.json), built by scripts/build-questions.ts. */
export interface GeneratedPack {
  pack: { slug: string; name: string };
  questions: SeedQuestion[];
}

export interface SeedCategory {
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}
