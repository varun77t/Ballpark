import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  json,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import type { SourceRef } from '@ballpark/shared';

export const difficultyEnum = pgEnum('difficulty', ['easy', 'medium', 'hard', 'insane']);
export const modeEnum = pgEnum('play_mode', ['random', 'daily', 'category', 'endless']);
export const attemptStatusEnum = pgEnum('attempt_status', ['active', 'solved', 'revealed', 'skipped']);
export const answerKindEnum = pgEnum('answer_kind', ['fact', 'estimate']);
export const directionEnum = pgEnum('guess_direction', ['high', 'low', 'exact']);
export const runStatusEnum = pgEnum('run_status', ['active', 'ended']);

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    username: varchar('username', { length: 32 }),
    passwordHash: text('password_hash'),
    isGuest: boolean('is_guest').notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('users_username_lower_idx').on(sql`lower(${t.username})`)],
);

export const categories = pgTable('categories', {
  slug: varchar('slug', { length: 48 }).primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  icon: varchar('icon', { length: 48 }).notNull(),
  color: varchar('color', { length: 16 }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

/** Reserved for community/user-created packs; every seeded question has pack_id = null. */
export const questionPacks = pgTable('question_packs', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 64 }).notNull().unique(),
  name: text('name').notNull(),
  authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
  isPublic: boolean('is_public').notNull().default(false),
  createdAt: createdAt(),
});

export const questions = pgTable(
  'questions',
  {
    id: serial('id').primaryKey(),
    slug: varchar('slug', { length: 96 }).notNull().unique(),
    text: text('text').notNull(),
    categorySlug: varchar('category_slug', { length: 48 })
      .notNull()
      .references(() => categories.slug),
    difficulty: difficultyEnum('difficulty').notNull(),
    answer: doublePrecision('answer').notNull(),
    answerLow: doublePrecision('answer_low'),
    answerHigh: doublePrecision('answer_high'),
    unit: text('unit').notNull(),
    toleranceRatio: doublePrecision('tolerance_ratio').notNull(),
    answerKind: answerKindEnum('answer_kind').notNull(),
    explanation: text('explanation').notNull(),
    reasoning: jsonb('reasoning').$type<string[]>().notNull(),
    fact: text('fact').notNull(),
    imageUrl: text('image_url'),
    sources: jsonb('sources').$type<SourceRef[]>().notNull().default([]),
    dailyEligible: boolean('daily_eligible').notNull().default(true),
    isActive: boolean('is_active').notNull().default(true),
    packId: integer('pack_id').references(() => questionPacks.id, { onDelete: 'set null' }),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('questions_filter_idx').on(t.categorySlug, t.difficulty, t.isActive)],
);

export const endlessRuns = pgTable(
  'endless_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: runStatusEnum('status').notNull().default('active'),
    solvedCount: integer('solved_count').notNull().default(0),
    questionsPlayed: integer('questions_played').notNull().default(0),
    currentStreak: integer('current_streak').notNull().default(0),
    bestStreak: integer('best_streak').notNull().default(0),
    totalAccuracy: doublePrecision('total_accuracy').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (t) => [index('endless_runs_user_idx').on(t.userId, t.status)],
);

export const attempts = pgTable(
  'attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    questionId: integer('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    mode: modeEnum('mode').notNull(),
    dailyDate: date('daily_date', { mode: 'string' }),
    runId: uuid('run_id').references(() => endlessRuns.id, { onDelete: 'set null' }),
    status: attemptStatusEnum('status').notNull().default('active'),
    /** Practice attempts (daily replays) never earn points or move streaks. */
    practice: boolean('practice').notNull().default(false),
    guessCount: integer('guess_count').notNull().default(0),
    firstError: doublePrecision('first_error'),
    bestError: doublePrecision('best_error'),
    bestGuess: doublePrecision('best_guess'),
    points: integer('points').notNull().default(0),
    xpGained: integer('xp_gained').notNull().default(0),
    scoreBreakdown: jsonb('score_breakdown').$type<Record<string, number>>(),
    personalBest: boolean('personal_best').notNull().default(false),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [
    index('attempts_user_idx').on(t.userId, t.startedAt),
    index('attempts_question_idx').on(t.questionId),
    index('attempts_daily_idx').on(t.dailyDate),
    // One scored daily attempt per user per day; practice replays are unlimited.
    uniqueIndex('attempts_daily_unique_idx')
      .on(t.userId, t.dailyDate)
      .where(sql`${t.mode} = 'daily' and ${t.practice} = false`),
  ],
);

export const guesses = pgTable(
  'guesses',
  {
    id: serial('id').primaryKey(),
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => attempts.id, { onDelete: 'cascade' }),
    value: doublePrecision('value').notNull(),
    logError: doublePrecision('log_error').notNull(),
    direction: directionEnum('direction').notNull(),
    tier: varchar('tier', { length: 24 }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('guesses_attempt_idx').on(t.attemptId)],
);

export const dailyChallenges = pgTable('daily_challenges', {
  date: date('date', { mode: 'string' }).primaryKey(),
  questionId: integer('question_id')
    .notNull()
    .references(() => questions.id),
  createdAt: createdAt(),
});

export const userStats = pgTable('user_stats', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  xp: integer('xp').notNull().default(0),
  dailyStreak: integer('daily_streak').notNull().default(0),
  bestDailyStreak: integer('best_daily_streak').notNull().default(0),
  lastDailyDate: date('last_daily_date', { mode: 'string' }),
  bestEndlessStreak: integer('best_endless_streak').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userAchievements = pgTable(
  'user_achievements',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 48 }).notNull(),
    unlockedAt: timestamp('unlocked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);

/** Session store table, shaped the way connect-pg-simple expects. */
export const sessions = pgTable(
  'session',
  {
    sid: varchar('sid').primaryKey(),
    sess: json('sess').notNull(),
    expire: timestamp('expire', { precision: 6 }).notNull(),
  },
  (t) => [index('IDX_session_expire').on(t.expire)],
);

export type User = typeof users.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
export type Attempt = typeof attempts.$inferSelect;
export type Guess = typeof guesses.$inferSelect;
export type EndlessRun = typeof endlessRuns.$inferSelect;
