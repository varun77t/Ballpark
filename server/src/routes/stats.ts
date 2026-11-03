import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/http';
import { resolvePlayerDate } from '../lib/dates';
import { validQuery, validate } from '../middleware/validate';
import { listAchievements } from '../services/achievementService';
import { getLeaderboard, getMeta, getRecent, getStats } from '../services/statsService';

export const metaRouter = Router();

metaRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await getMeta());
  }),
);

export const statsRouter = Router();

// Anonymous visitors have no stats yet; the client renders an empty state for null.
statsRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    res.json(req.user ? await getStats(req.user) : null);
  }),
);

const recentQuery = z.object({ limit: z.coerce.number().int().min(1).max(50).default(10) });

statsRouter.get(
  '/recent',
  validate(recentQuery, 'query'),
  asyncHandler(async (req, res) => {
    const { limit } = validQuery<z.infer<typeof recentQuery>>(req);
    res.json(req.user ? await getRecent(req.user.id, limit) : []);
  }),
);

statsRouter.get(
  '/achievements',
  asyncHandler(async (req, res) => {
    res.json(await listAchievements(req.user?.id ?? null));
  }),
);

export const leaderboardRouter = Router();

const boardQuery = z.object({
  board: z.enum(['xp', 'weekly', 'daily']).default('xp'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

leaderboardRouter.get(
  '/',
  validate(boardQuery, 'query'),
  asyncHandler(async (req, res) => {
    const { board, date } = validQuery<z.infer<typeof boardQuery>>(req);
    res.json(await getLeaderboard(board, req.user?.id ?? null, resolvePlayerDate(date)));
  }),
);
