import type { Direction, TierKey } from './engine/estimate';
import type { ScoreBreakdown } from './engine/scoring';

export const DIFFICULTIES = ['easy', 'medium', 'hard', 'insane'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const MODES = ['random', 'daily', 'category', 'endless'] as const;
export type Mode = (typeof MODES)[number];

export type AttemptStatus = 'active' | 'solved' | 'revealed' | 'skipped';
export type AnswerKind = 'fact' | 'estimate';

/**
 * What kind of number a question asks for. A good bank mixes these and keeps plain
 * lookups (`trivia`) rare: the fun is reasoning toward a number nobody has memorised.
 * - stock: how many exist right now · flow: how many per second/day/year
 * - tally: how many ever, or over a lifetime · fit: how many X fit in Y
 * - scale: laid end to end, stacked up, compared · clock: how long would it take
 */
export const SHAPES = ['stock', 'flow', 'tally', 'fit', 'scale', 'clock', 'trivia'] as const;
export type QuestionShape = (typeof SHAPES)[number];

export const DIFFICULTY_INFO: Record<Difficulty, { label: string; blurb: string }> = {
  easy: { label: 'Easy', blurb: 'Everyday objects and intuitive quantities.' },
  medium: { label: 'Medium', blurb: 'A few assumptions and some multiplication.' },
  hard: { label: 'Hard', blurb: 'Multi-step estimation chains.' },
  insane: { label: 'Insane', blurb: 'Counterintuitive. Your gut will lie to you.' },
};

export interface CategoryDTO {
  slug: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  questionCount: number;
}

export interface SourceRef {
  label: string;
  url?: string;
}

/** What the client sees while an attempt is active: no answer, no explanation. */
export interface QuestionPublic {
  id: number;
  slug: string;
  text: string;
  /** Pins down exactly what is being counted ("Averaged over 2024, counting…"). */
  qualifier: string | null;
  shape: QuestionShape | null;
  category: string;
  difficulty: Difficulty;
  unit: string;
  answerKind: AnswerKind;
  toleranceRatio: number;
  imageUrl: string | null;
}

/** Revealed once an attempt is finished. */
export interface QuestionReveal extends QuestionPublic {
  answer: number;
  answerLow: number | null;
  answerHigh: number | null;
  explanation: string;
  reasoning: string[];
  fact: string;
  sources: SourceRef[];
}

export interface GuessDTO {
  value: number;
  logError: number;
  direction: Direction;
  tier: TierKey;
  accuracy: number;
  createdAt: string;
}

export interface GuessFeedback extends GuessDTO {
  tierLabel: string;
  hint: string;
  solved: boolean;
  improved: boolean;
  isBest: boolean;
}

export interface AttemptDTO {
  id: string;
  mode: Mode;
  status: AttemptStatus;
  dailyDate: string | null;
  runId: string | null;
  question: QuestionPublic | QuestionReveal;
  guesses: GuessDTO[];
  guessCount: number;
  bestError: number | null;
  bestGuess: number | null;
  points: number;
  /** Position in the user's history (1-based) — shown as "Question #N". */
  number: number;
  /** Set when the daily attempt is a replay and earns no points. */
  practice: boolean;
  startedAt: string;
  finishedAt: string | null;
  result: AttemptResult | null;
}

export interface AchievementDTO {
  key: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: string | null;
}

export interface AttemptResult {
  status: Exclude<AttemptStatus, 'active'>;
  answer: number;
  bestGuess: number | null;
  bestError: number | null;
  accuracy: number;
  guessCount: number;
  score: ScoreBreakdown;
  xpGained: number;
  personalBest: boolean;
}

export interface FinishPayload {
  attempt: AttemptDTO;
  newAchievements: AchievementDTO[];
  levelUp: { from: number; to: number } | null;
  endless: EndlessRunDTO | null;
  daily: { streak: number; best: number } | null;
}

export interface GuessResponse {
  feedback: GuessFeedback;
  attempt: AttemptDTO;
  /** Always present: every guess ends the attempt. */
  finish: FinishPayload;
}

export interface UserDTO {
  id: string;
  username: string | null;
  isGuest: boolean;
  xp: number;
  level: number;
}

export interface EndlessRunDTO {
  id: string;
  status: 'active' | 'ended';
  solvedCount: number;
  currentStreak: number;
  bestStreak: number;
  averageAccuracy: number | null;
  questionsPlayed: number;
  startedAt: string;
  endedAt: string | null;
  currentAttemptId: string | null;
}

export interface DailyDTO {
  date: string;
  question: QuestionPublic;
  attempt: AttemptDTO | null;
  completed: boolean;
  streak: number;
  bestStreak: number;
  /** How many players finished today's question. */
  solvers: number;
}

export interface BreakdownRow {
  key: string;
  label: string;
  attempted: number;
  solved: number;
  averageAccuracy: number | null;
}

export interface StatsDTO {
  user: UserDTO;
  levelTitle: string;
  levelProgress: number;
  nextLevelXp: number;
  levelStartXp: number;
  attempted: number;
  solved: number;
  revealed: number;
  skipped: number;
  totalGuesses: number;
  totalPoints: number;
  averageAccuracy: number | null;
  bestAccuracy: number | null;
  firstGuessAccuracy: number | null;
  averageGuesses: number | null;
  dailyStreak: number;
  bestDailyStreak: number;
  bestEndlessStreak: number;
  byCategory: BreakdownRow[];
  byDifficulty: BreakdownRow[];
  achievementsUnlocked: number;
  achievementsTotal: number;
}

export interface RecentAttemptDTO {
  id: string;
  questionId: number;
  questionText: string;
  category: string;
  difficulty: Difficulty;
  status: AttemptStatus;
  guessCount: number;
  accuracy: number | null;
  points: number;
  finishedAt: string | null;
  startedAt: string;
}

export type LeaderboardBoard = 'xp' | 'weekly' | 'daily';

export interface LeaderboardRow {
  rank: number;
  username: string;
  value: number;
  secondary: number | null;
  isMe: boolean;
}

export interface LeaderboardDTO {
  board: LeaderboardBoard;
  rows: LeaderboardRow[];
  me: LeaderboardRow | null;
}

export interface MetaDTO {
  categories: CategoryDTO[];
  difficulties: { key: Difficulty; label: string; blurb: string; count: number }[];
  totalQuestions: number;
}

export interface ApiError {
  error: string;
  code: string;
  details?: unknown;
}
