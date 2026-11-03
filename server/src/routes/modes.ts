import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/http';
import { resolvePlayerDate } from '../lib/dates';
import { currentUser, ensureUser } from '../middleware/user';
import { validQuery, validate } from '../middleware/validate';
import { getDaily, startDaily } from '../services/dailyService';
import { endRun, getActiveRun, getRun, nextInRun, startRun } from '../services/endlessService';
import { filterSchemaShape } from './play';

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.');

export const dailyRouter = Router();

const dailyQuery = z.object({ date: dateString.optional() });

dailyRouter.get(
  '/',
  validate(dailyQuery, 'query'),
  asyncHandler(async (req, res) => {
    const { date } = validQuery<z.infer<typeof dailyQuery>>(req);
    res.json(await getDaily(req.user?.id ?? null, resolvePlayerDate(date)));
  }),
);

const dailyStart = z.object({ date: dateString.optional(), practice: z.boolean().optional() });

dailyRouter.post(
  '/start',
  ensureUser,
  validate(dailyStart),
  asyncHandler(async (req, res) => {
    const { date, practice } = req.body as z.infer<typeof dailyStart>;
    res.status(201).json(await startDaily(currentUser(req).id, resolvePlayerDate(date), !!practice));
  }),
);

export const endlessRouter = Router();
endlessRouter.use(ensureUser);

const runFilters = z.object(filterSchemaShape);
const runParams = z.object({ id: z.string().uuid('Invalid run id.') });

endlessRouter.get(
  '/active',
  asyncHandler(async (req, res) => {
    res.json(await getActiveRun(currentUser(req).id));
  }),
);

endlessRouter.post(
  '/start',
  validate(runFilters),
  asyncHandler(async (req, res) => {
    res.status(201).json(await startRun(currentUser(req).id, req.body as z.infer<typeof runFilters>));
  }),
);

endlessRouter.get(
  '/:id',
  validate(runParams, 'params'),
  asyncHandler(async (req, res) => {
    res.json(await getRun(currentUser(req).id, req.params.id));
  }),
);

endlessRouter.post(
  '/:id/next',
  validate(runParams, 'params'),
  validate(runFilters),
  asyncHandler(async (req, res) => {
    res.json(await nextInRun(currentUser(req).id, req.params.id, req.body as z.infer<typeof runFilters>));
  }),
);

endlessRouter.post(
  '/:id/end',
  validate(runParams, 'params'),
  asyncHandler(async (req, res) => {
    res.json(await endRun(currentUser(req).id, req.params.id));
  }),
);
